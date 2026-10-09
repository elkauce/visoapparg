import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_KEY_MEDIA_BYTES,
  uploadKeyMedia,
  validateKeyMedia,
} from "./upload-media.ts";

beforeEach(() => {
  vi.stubEnv("VITE_CONVEX_SITE_URL", "https://example.convex.site");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("authenticated Deck media upload", () => {
  it("accepts GIF and supported video without converting them to static images", () => {
    expect(
      validateKeyMedia(new File(["gif"], "deck.gif", { type: "image/gif" })),
    ).toBeNull();
    expect(
      validateKeyMedia(new File(["mp4"], "deck.mp4", { type: "video/mp4" })),
    ).toBeNull();
  });
  it("rejects unsupported, empty and oversized files before making a request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      uploadKeyMedia(
        new File(["x"], "script.js", { type: "text/javascript" }),
        "token",
      ),
    ).rejects.toThrow("compatible");
    await expect(
      uploadKeyMedia(new File([], "empty.png", { type: "image/png" }), "token"),
    ).rejects.toThrow("vacío");
    const large = new File(["x"], "large.png", { type: "image/png" });
    Object.defineProperty(large, "size", { value: MAX_KEY_MEDIA_BYTES + 1 });
    await expect(uploadKeyMedia(large, "token")).rejects.toThrow("60 MB");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("requires a session and sends the uploaded bytes to the owning account endpoint", async () => {
    const file = new File(["gif"], "deck.gif", { type: "image/gif" });
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            storageId: "owned-storage",
            mediaType: "image",
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(uploadKeyMedia(file, null)).rejects.toThrow("sesión");
    expect(fetch).not.toHaveBeenCalled();
    await expect(uploadKeyMedia(file, "test-token")).resolves.toEqual({
      storageId: "owned-storage",
      mediaType: "image",
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://example.convex.site/deck/media",
      {
        method: "POST",
        headers: {
          "Content-Type": "image/gif",
          Authorization: "Bearer test-token",
        },
        body: file,
      },
    );
  });
  it("reports a rejected upload without claiming the file was stored", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("denied", { status: 403 })),
    );
    await expect(
      uploadKeyMedia(
        new File(["img"], "deck.png", { type: "image/png" }),
        "test-token",
      ),
    ).rejects.toThrow("No se pudo subir");
  });
  it("requires a valid storage confirmation rather than trusting an HTTP success alone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      ),
    );
    await expect(
      uploadKeyMedia(
        new File(["img"], "deck.png", { type: "image/png" }),
        "test-token",
      ),
    ).rejects.toThrow("no confirmó");
  });
});
