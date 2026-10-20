import { mercadoLibreItemId, safeAffiliateFetchUrl, safeMarketplaceMediaUrl } from "./marketplace_affiliate_urls";

export type AffiliateGalleryItem = { id: string; name: string; mediaType: "image" | "video"; externalUrl: string };
export type AffiliateImportDraft = {
  title?: string;
  description?: string;
  priceAmount?: number;
  currency?: string;
  externalUrl: string;
  gallery: AffiliateGalleryItem[];
  importSource: { affiliateUrl: string; sourceUrl?: string; itemId?: string; importedAt: number; availability?: string };
};
export type AffiliateImportResult = { draft: AffiliateImportDraft; warnings: string[] };
type JsonObject = Record<string, unknown>;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_GALLERY = 24;

function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}
function text(value: unknown, max = 6000): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = [...value].filter((char) => {
    const code = char.charCodeAt(0);
    return !(code < 9 || code === 11 || code === 12 || (code >= 14 && code < 32));
  }).join("").trim();
  return clean ? clean.slice(0, max) : undefined;
}
function amount(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" && /^\d+(?:\.\d{1,2})?$/.test(value) ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 && Number.isSafeInteger(Math.round(n * 100)) ? Math.round(n * 100) : undefined;
}
function currency(value: unknown): string | undefined {
  return typeof value === "string" && ["ARS", "USD", "BRL", "CLP", "COP", "MXN", "PEN", "UYU"].includes(value) ? value : undefined;
}
function galleryItem(url: unknown, video = false): AffiliateGalleryItem | null {
  if (typeof url !== "string") return null;
  const safe = safeMarketplaceMediaUrl(url);
  if (!safe) return null;
  const mediaType = video || /\.(mp4|webm)(?:\?|$)/i.test(safe) ? "video" : "image";
  return { id: `ml:${safe}`, name: mediaType === "video" ? "Video del producto" : "Foto del producto", mediaType, externalUrl: safe };
}
function mergeGallery(current: AffiliateGalleryItem[], extra: AffiliateGalleryItem[]) {
  const urls = new Set(current.map((item) => item.externalUrl));
  for (const item of extra) if (!urls.has(item.externalUrl) && current.length < MAX_GALLERY) { current.push(item); urls.add(item.externalUrl); }
}

export function parseMercadoLibreItem(data: unknown): Partial<AffiliateImportDraft> & { availability?: string } {
  const item = object(data);
  if (!item) return {};
  const pictures = Array.isArray(item.pictures) ? item.pictures : [];
  const gallery = pictures.map((picture) => { const p = object(picture); return galleryItem(p?.secure_url ?? p?.url); }).filter((p): p is AffiliateGalleryItem => p !== null).slice(0, MAX_GALLERY);
  return {
    title: text(item.title, 100), priceAmount: amount(item.price), currency: currency(item.currency_id), gallery,
    availability: item.status === "active" && typeof item.available_quantity === "number" && item.available_quantity > 0 ? "Disponible al importar" : item.status === "active" ? "Publicación activa; verificar disponibilidad" : ["paused", "closed", "inactive"].includes(String(item.status)) ? "No disponible al importar" : undefined,
  };
}

function jsonLdObjects(value: unknown, depth = 0): JsonObject[] {
  if (depth > 8) return [];
  if (Array.isArray(value)) return value.slice(0, 60).flatMap((entry) => jsonLdObjects(entry, depth + 1));
  const obj = object(value);
  if (!obj) return [];
  return [obj, ...jsonLdObjects(obj["@graph"], depth + 1), ...jsonLdObjects(obj.mainEntity, depth + 1)];
}
function decodeHtml(value: string) {
  return value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export function parseMercadoLibrePage(html: string): Partial<AffiliateImportDraft> {
  const result: Partial<AffiliateImportDraft> = { gallery: [] };
  // Structured data is parsed, never inserted into the DOM or evaluated.
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    let entries: JsonObject[];
    try { entries = jsonLdObjects(JSON.parse(match[1])); } catch { continue; }
    for (const entry of entries) {
      const types = Array.isArray(entry["@type"]) ? entry["@type"] : [entry["@type"]];
      if (types.includes("Product")) {
        result.title ??= text(entry.name, 100);
        result.description ??= text(entry.description);
        const offer = object(Array.isArray(entry.offers) ? entry.offers[0] : entry.offers);
        result.priceAmount ??= amount(offer?.price);
        result.currency ??= currency(offer?.priceCurrency);
        const images = Array.isArray(entry.image) ? entry.image : [entry.image];
        mergeGallery(result.gallery!, images.map((item) => galleryItem(typeof item === "string" ? item : object(item)?.url)).filter((p): p is AffiliateGalleryItem => p !== null));
        const videos = Array.isArray(entry.video) ? entry.video : [entry.video];
        mergeGallery(result.gallery!, videos.map((item) => galleryItem(object(item)?.contentUrl, true)).filter((p): p is AffiliateGalleryItem => p !== null));
      }
      if (types.includes("VideoObject")) { const video = galleryItem(entry.contentUrl, true); if (video) mergeGallery(result.gallery!, [video]); }
    }
  }
  // Product pages sometimes expose only Open Graph metadata to unauthenticated readers.
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map((attr) => [attr[1].toLowerCase(), decodeHtml(attr[2])]));
    if (attrs.property === "og:title") result.title ??= text(attrs.content, 100);
    if (attrs.property === "og:description") result.description ??= text(attrs.content);
    if (attrs.property === "og:image") { const item = galleryItem(attrs.content); if (item) mergeGallery(result.gallery!, [item]); }
  }
  return result;
}

async function boundedBody(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (declared > MAX_RESPONSE_BYTES) throw new Error("La respuesta supera el límite de importación.");
  if (!response.body) return "";
  const reader = response.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_RESPONSE_BYTES) throw new Error("La respuesta supera el límite de importación.");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(data);
}

export async function importAffiliateProduct(original: string, options: { fetcher?: typeof fetch; accessToken?: string; now?: number } = {}): Promise<AffiliateImportResult> {
  const affiliateUrl = original.trim();
  const firstUrl = safeAffiliateFetchUrl(affiliateUrl);
  if (!firstUrl) throw new Error("Ingresá un enlace HTTPS de Mercado Libre o meli.la.");
  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  const warnings: string[] = [];
  const draft: AffiliateImportDraft = { externalUrl: affiliateUrl, gallery: [], importSource: { affiliateUrl, importedAt: options.now ?? Date.now() } };
  let sourceUrl = firstUrl;
  try {
    // Resolve every redirect manually so provider links cannot become an SSRF proxy.
    let html: string | undefined;
    const visited = new Set<string>();
    try {
      for (let redirects = 0; redirects <= 5; redirects++) {
        if (visited.has(sourceUrl)) throw new Error("El enlace redirige en un bucle.");
        visited.add(sourceUrl);
        const response = await fetcher(sourceUrl, { redirect: "manual", signal: controller.signal, headers: { Accept: "text/html,application/xhtml+xml" } });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          await response.body?.cancel();
          const target = response.headers.get("location");
          if (!target || redirects === 5) throw new Error("No se pudo resolver el enlace de afiliado.");
          const safe = safeAffiliateFetchUrl(new URL(target, sourceUrl).href);
          if (!safe) throw new Error("Mercado Libre redirigió fuera de sus dominios permitidos.");
          sourceUrl = safe;
          continue;
        }
        if (!response.ok) { await response.body?.cancel(); throw new Error(`Mercado Libre no permite leer esta página (HTTP ${response.status}).`); }
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) { await response.body?.cancel(); throw new Error("El enlace no devolvió una página de producto."); }
        html = await boundedBody(response);
        break;
      }
    } catch (error) { warnings.push(error instanceof Error && error.message.length < 200 ? error.message : "No se pudo leer la página de Mercado Libre."); }
    draft.importSource.sourceUrl = sourceUrl;
    const itemId = mercadoLibreItemId(sourceUrl) ?? mercadoLibreItemId(affiliateUrl);
    if (itemId) {
      draft.importSource.itemId = itemId;
      try {
        // OAuth tokens are sent only to the fixed official API origin. API
        // redirects are rejected, so an upstream redirect cannot receive them.
        const headers: Record<string, string> = { Accept: "application/json" };
        if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;
        const response = await fetcher(`https://api.mercadolibre.com/items/${itemId}`, { redirect: "error", signal: controller.signal, headers });
        if (!response.ok) { await response.body?.cancel(); throw new Error(`La API de Mercado Libre respondió HTTP ${response.status}.`); }
        const parsed = parseMercadoLibreItem(JSON.parse(await boundedBody(response)));
        draft.title = parsed.title; draft.priceAmount = parsed.priceAmount; draft.currency = parsed.currency;
        draft.importSource.availability = parsed.availability;
        mergeGallery(draft.gallery, parsed.gallery ?? []);
        const descriptionResponse = await fetcher(`https://api.mercadolibre.com/items/${itemId}/description`, { redirect: "error", signal: controller.signal, headers });
        if (descriptionResponse.ok) draft.description = text(object(JSON.parse(await boundedBody(descriptionResponse)))?.plain_text);
        else { await descriptionResponse.body?.cancel(); warnings.push("La descripción no está disponible por la API; podés completarla manualmente."); }
      } catch { warnings.push("La API no entregó todos los datos. Algunas publicaciones requieren una autorización vigente de Mercado Libre."); }
    }
    if (html) {
      const page = parseMercadoLibrePage(html);
      draft.title ??= page.title; draft.description ??= page.description; draft.priceAmount ??= page.priceAmount; draft.currency ??= page.currency;
      mergeGallery(draft.gallery, page.gallery ?? []);
    }
    if (!draft.title && !draft.description && !draft.gallery.length) warnings.push("No se pudieron obtener datos del producto. Conservá el enlace y completá los campos o subí los archivos manualmente.");
    if (!draft.gallery.some((asset) => asset.mediaType === "video")) warnings.push("No se encontró un video descargable autorizado. Podés subir un video propio vertical u horizontal.");
    return { draft, warnings: [...new Set(warnings)] };
  } finally { clearTimeout(timer); }
}
