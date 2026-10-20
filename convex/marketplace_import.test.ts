import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { importAffiliateProduct, parseMercadoLibreItem, parseMercadoLibrePage } from "./lib/marketplace_affiliate_import";
import { mercadoLibreItemId, safeAffiliateFetchUrl, safeMarketplaceMediaUrl } from "./lib/marketplace_affiliate_urls";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const affiliate = "https://meli.la/AbC?reference_id=viso%2Fdeck&tag=affiliate";
const source = "https://articulo.mercadolibre.com.ar/MLA-123456789-stream-deck-_JM";
const picture = "https://http2.mlstatic.com/D_NQ_NP_1234-O.webp";
const html = (body: string) => new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

describe("affiliate URL boundaries", () => {
  it("rejects arbitrary hosts, credentials, ports and lookalike domains before any request", async () => {
    const fetcher = vi.fn();
    for (const value of ["http://meli.la/a", "https://127.0.0.1/a", "https://[::1]/a", "https://meli.la:444/a", "https://user:secret@meli.la/a", "https://mercadolibre.com.ar.evil.test/a", "https://evil.test/?next=https://meli.la/a", "https://localhost/a"]) {
      expect(safeAffiliateFetchUrl(value)).toBeNull();
      await expect(importAffiliateProduct(value, { fetcher })).rejects.toThrow("Mercado Libre");
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("only accepts direct provider media without embedding arbitrary remote scripts", () => {
    expect(safeMarketplaceMediaUrl(picture)).toBe(picture);
    expect(safeMarketplaceMediaUrl("https://http2.mlstatic.com/movie.mp4")).not.toBeNull();
    for (const url of ["https://evil.test/a.jpg", "https://http2.mlstatic.com/a.svg", "https://http2.mlstatic.com/page.html", "https://http2.mlstatic.com/iframe", "http://http2.mlstatic.com/a.jpg", "https://x:secret@http2.mlstatic.com/a.jpg"]) expect(safeMarketplaceMediaUrl(url)).toBeNull();
  });
  it("extracts only bounded item ids from provider URLs", () => {
    expect(mercadoLibreItemId(source)).toBe("MLA123456789");
    expect(mercadoLibreItemId("https://www.mercadolibre.com.ar/p/MLA987654321?wid=MLA123456789")).toBe("MLA123456789");
    expect(mercadoLibreItemId("https://www.mercadolibre.com.ar/p/MLA987654321")).toBeNull();
    expect(mercadoLibreItemId("https://evil.test/MLA123456789")).toBeNull();
    expect(mercadoLibreItemId("https://meli.la/short")).toBeNull();
  });
});

describe("safe affiliate import", () => {
  it("resolves an official shortlink, imports metadata and keeps the affiliate URL byte-for-byte", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: source } }))
      .mockResolvedValueOnce(html("<html></html>"))
      .mockResolvedValueOnce(json({ title: "Stream Deck usado", price: 12345.67, currency_id: "ARS", status: "active", available_quantity: 2, pictures: [{ secure_url: picture }] }))
      .mockResolvedValueOnce(json({ plain_text: "Equipo usado en muy buen estado." }));
    const result = await importAffiliateProduct(affiliate, { fetcher, accessToken: "private-test-token", now: 123 });
    expect(result.draft).toMatchObject({ title: "Stream Deck usado", description: "Equipo usado en muy buen estado.", externalUrl: affiliate, priceAmount: 1234567, currency: "ARS", importSource: { affiliateUrl: affiliate, sourceUrl: source, importedAt: 123, itemId: "MLA123456789", availability: "Disponible al importar" } });
    expect(result.draft.gallery).toEqual([{ id: `ml:${picture}`, name: "Foto del producto", mediaType: "image", externalUrl: picture }]);
    expect(fetcher.mock.calls[0][1].headers).not.toHaveProperty("Authorization");
    expect(fetcher.mock.calls[1][1].headers).not.toHaveProperty("Authorization");
    expect(fetcher.mock.calls[2]).toMatchObject(["https://api.mercadolibre.com/items/MLA123456789", { redirect: "error", headers: { Authorization: "Bearer private-test-token" } }]);
  });
  it("refuses an off-provider redirect without fetching its destination", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data" } }));
    const result = await importAffiliateProduct(affiliate, { fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.warnings.join(" ")).toContain("dominios permitidos");
    expect(result.draft.externalUrl).toBe(affiliate);
    expect(result.draft.priceAmount).toBeUndefined();
  });
  it("bounds redirect loops and large responses, offering manual completion", async () => {
    const loop = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: affiliate } }));
    const result = await importAffiliateProduct(affiliate, { fetcher: loop });
    expect(loop).toHaveBeenCalledTimes(1);
    expect(result.warnings.join(" ")).toContain("bucle");
    const large = vi.fn().mockResolvedValue(new Response("x", { headers: { "content-type": "text/html", "content-length": "99999999" } }));
    const blocked = await importAffiliateProduct(affiliate, { fetcher: large });
    expect(blocked.warnings.join(" ")).toContain("límite");
    expect(blocked.draft.gallery).toEqual([]);
  });
  it("returns partial blocked-provider results with no fabricated title or free price", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
    const result = await importAffiliateProduct(source, { fetcher });
    expect(result.draft.externalUrl).toBe(source);
    expect(result.draft.title).toBeUndefined();
    expect(result.draft.priceAmount).toBeUndefined();
    expect(result.draft.gallery).toEqual([]);
    expect(result.warnings.join(" ")).toContain("manualmente");
  });
  it("falls back to JSON-LD and uses direct videos only while the API is unavailable", async () => {
    const page = `<script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: "Key Light", description: "Luz regulable", image: [picture, "https://evil.test/image.jpg"], offers: { price: "45000.50", priceCurrency: "ARS" }, video: [{ contentUrl: "https://http2.mlstatic.com/portrait.mp4" }, { embedUrl: "https://evil.test/embed" }] })}</script>`;
    const fetcher = vi.fn().mockResolvedValueOnce(html(page)).mockResolvedValueOnce(new Response(null, { status: 401 }));
    const result = await importAffiliateProduct(source, { fetcher });
    expect(result.draft.title).toBe("Key Light");
    expect(result.draft.priceAmount).toBe(4500050);
    expect(result.draft.gallery.map((asset) => asset.mediaType)).toEqual(["image", "video"]);
    expect(result.warnings.join(" ")).not.toContain("video descargable");
  });
  it("does not trust malformed metadata, inactive prices or executable HTML", () => {
    expect(parseMercadoLibrePage('<script type="application/ld+json">not-json</script><meta content="Title &amp; more" property="og:title">')).toMatchObject({ title: "Title & more" });
    expect(parseMercadoLibreItem({ price: 0, currency_id: "INVALID", title: "\u0000", pictures: [{ url: "javascript:alert(1)" }] })).toMatchObject({ title: undefined, priceAmount: undefined, currency: undefined, gallery: [] });
  });
});

describe("affiliate import authorization", () => {
  it("rejects unauthenticated users and non-admin creators without network access", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) => ctx.db.insert("users", { email: "creator@example.test" }));
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(t.action(api.marketplace_import.previewAffiliate, { affiliateUrl: affiliate })).rejects.toThrow();
    await expect(t.withIdentity({ subject: `${userId}|session` }).action(api.marketplace_import.previewAffiliate, { affiliateUrl: affiliate })).rejects.toThrow("administrador");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("allows the configured administrator to preview without writing or publishing a product", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) => ctx.db.insert("users", { email: "operator@example.test" }));
    vi.stubEnv("MARKETPLACE_ADMIN_USER_IDS", userId);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(html('<meta property="og:title" content="Producto de prueba">')));
    const result = await t.withIdentity({ subject: `${userId}|session` }).action(api.marketplace_import.previewAffiliate, { affiliateUrl: affiliate });
    expect(result.draft.title).toBe("Producto de prueba");
    expect(result.draft.externalUrl).toBe(affiliate);
    expect(await t.run((ctx) => ctx.db.query("marketplaceProducts").collect())).toHaveLength(0);
  });
});
