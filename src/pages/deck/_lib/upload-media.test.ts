import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_KEY_MEDIA_BYTES,
  uploadKeyMedia,
  uploadBuiltinKeyMedia,
  validateKeyMedia,
} from "./upload-media.ts";

beforeEach(() => {
  vi.stubEnv("VITE_CONVEX_SITE_URL", "https://example.convex.site");
});

describe("bundled VISO media", () => {
  it("copies an original animated resource through the user's authenticated storage instead of persisting a preview URL", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["GIF89a"], { type: "image/gif" }),
      })
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            storageId: "owned-builtin-copy",
            mediaType: "image",
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(
      uploadBuiltinKeyMedia(
        {
          builtinPath: "/marketplace/animated/libre.gif",
          name: "Libre animado",
          mimeType: "image/gif",
        },
        "test-token",
      ),
    ).resolves.toEqual({ storageId: "owned-builtin-copy", mediaType: "image" });
    expect(fetch.mock.calls[0]).toEqual([
      "/marketplace/animated/libre.gif",
      { credentials: "same-origin" },
    ]);
    const [url, options] = fetch.mock.calls[1];
    expect(url).toBe("https://example.convex.site/deck/media");
    expect(options.headers).toEqual({
      "Content-Type": "image/gif",
      Authorization: "Bearer test-token",
    });
    expect(options.body).toBeInstanceOf(File);
    expect(options.body.name).toBe("libre.gif");
    expect(options.body.size).toBe(6);
  });

  it.each([
    "https://example.com/icon.gif",
    "/marketplace/../private.gif",
    "/other/icon.gif",
  ])(
    "rejects an untrusted built-in path %s before fetching",
    async (builtinPath) => {
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      await expect(
        uploadBuiltinKeyMedia({ builtinPath, name: "icon" }, "token"),
      ).rejects.toThrow("no es válido");
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("requires a session before downloading and reports missing resources", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response("missing", { status: 404 }));
    vi.stubGlobal("fetch", fetch);
    const resource = {
      builtinPath: "/marketplace/originals/libre.png",
      name: "Libre",
    };
    await expect(uploadBuiltinKeyMedia(resource, null)).rejects.toThrow(
      "cuenta",
    );
    expect(fetch).not.toHaveBeenCalled();
    await expect(uploadBuiltinKeyMedia(resource, "token")).rejects.toThrow(
      "descargar",
    );
    expect(fetch).toHaveBeenCalledOnce();
  });
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
