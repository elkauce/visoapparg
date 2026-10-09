import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildVisoStatusFeeds,
  getVisoStoreUrl,
  readVisoRgbStatus,
} from "./viso-device-protocol.ts";

afterEach(() => vi.unstubAllGlobals());

describe("existing VISO RGB feed", () => {
  it("uses the existing public endpoint and safely encodes the current account link", () => {
    const feeds = buildVisoStatusFeeds(
      "https://test.convex.site/",
      "current&format=bad",
    );
    expect(feeds).not.toBeNull();
    for (const format of ["rgb", "hex", "name", "json"] as const) {
      const url = new URL(feeds![format]);
      expect(url.pathname).toBe("/public/status");
      expect(url.searchParams.get("slug")).toBe("current&format=bad");
      expect(url.searchParams.get("format")).toBe(
        format === "json" ? null : format,
      );
    }
    expect(buildVisoStatusFeeds("http://127.0.0.1:3211", "local")?.rgb).toBe(
      "http://127.0.0.1:3211/public/status?slug=local&format=rgb",
    );
    expect(buildVisoStatusFeeds("javascript:alert(1)", "user")).toBeNull();
    expect(
      buildVisoStatusFeeds("https://user:password@server.invalid", "user"),
    ).toBeNull();
  });

  it("accepts only the RGB data provided by the existing protocol", async () => {
    const request = vi.fn().mockResolvedValue(new Response("34,197,94"));
    vi.stubGlobal("fetch", request);
    await expect(
      readVisoRgbStatus(
        "https://test.convex.site/public/status?slug=example&format=rgb",
      ),
    ).resolves.toEqual([34, 197, 94]);
    expect(request).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it.each([
    "256,0,0",
    "-1,0,0",
    "1.5,0,0",
    "1,2",
    "1,2,3,4",
    "<html>login</html>",
  ])("rejects an incompatible or misleading response: %s", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
    await expect(
      readVisoRgbStatus("https://test.convex.site/"),
    ).rejects.toThrow("no es compatible");
  });

  it("rejects failed HTTP and network requests instead of confirming a device", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("404", { status: 404 })),
    );
    await expect(
      readVisoRgbStatus("https://test.convex.site/"),
    ).rejects.toThrow("no pudo consultar");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await expect(
      readVisoRgbStatus("https://test.convex.site/"),
    ).rejects.toThrow("Revisa tu conexión");
  });
});

describe("official catalog configuration", () => {
  it("requires a confirmed HTTPS URL and excludes credential-bearing or executable URLs", () => {
    expect(getVisoStoreUrl(undefined)).toBeNull();
    expect(getVisoStoreUrl("")).toBeNull();
    expect(getVisoStoreUrl("not-a-url")).toBeNull();
    expect(getVisoStoreUrl("javascript:alert(1)")).toBeNull();
    expect(getVisoStoreUrl("http://shop.example.invalid")).toBeNull();
    expect(
      getVisoStoreUrl("https://token:secret@shop.example.invalid"),
    ).toBeNull();
    expect(
      getVisoStoreUrl("  https://shop.example.invalid/catalog?category=viso  "),
    ).toBe("https://shop.example.invalid/catalog?category=viso");
  });
});
