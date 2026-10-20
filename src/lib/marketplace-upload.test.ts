import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MARKETPLACE_FILE_LIMIT,
  marketplaceFileContentType,
  marketplaceFileMediaType,
  uploadMarketplaceFile,
  validateMarketplaceFile,
} from "./marketplace-upload";

beforeEach(() =>
  vi.stubEnv("VITE_CONVEX_SITE_URL", "https://market.example.convex.site"),
);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("creator file upload", () => {
  it("accepts GIF/video and audio while rejecting SVG/HTML even when named as a plugin", () => {
    for (const [name, type] of [
      ["key.gif", "image/gif"],
      ["key.mp4", "video/mp4"],
      ["sound.wav", "audio/wav"],
    ])
      expect(
        validateMarketplaceFile(new File(["content"], name, { type })),
      ).toBeNull();
    expect(
      validateMarketplaceFile(
        new File(["svg"], "icon.svg", { type: "image/svg+xml" }),
      ),
    ).toContain("no está admitido");
    expect(
      validateMarketplaceFile(
        new File(["html"], "plugin.zip", { type: "text/html" }),
      ),
    ).toContain("no está admitido");
    expect(
      validateMarketplaceFile(
        new File(["movie"], "cover.mp4", { type: "video/mp4" }),
        true,
      ),
    ).toContain("portada");
  });

  it("rejects empty, oversized and oversized JSON before requesting storage", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const empty = new File([], "empty.png", { type: "image/png" });
    const huge = new File(["x"], "huge.gif", { type: "image/gif" });
    Object.defineProperty(huge, "size", { value: MARKETPLACE_FILE_LIMIT + 1 });
    const json = new File(["{}"], "profile.json", { type: "application/json" });
    Object.defineProperty(json, "size", { value: 512 * 1024 + 1 });
    await expect(uploadMarketplaceFile(empty, "test-session")).rejects.toThrow(
      "vacío",
    );
    await expect(uploadMarketplaceFile(huge, "test-session")).rejects.toThrow(
      "60 MB",
    );
    await expect(uploadMarketplaceFile(json, "test-session")).rejects.toThrow(
      "512 KB",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("recognizes ZIP Stream Deck plugins and JSON profiles when Windows omits the MIME, without trusting arbitrary files", () => {
    const plugin = new File(["PK"], "VISO.streamDeckPlugin");
    expect(marketplaceFileContentType(plugin)).toBe("application/zip");
    expect(marketplaceFileMediaType(plugin)).toBe("archive");
    expect(validateMarketplaceFile(plugin)).toBeNull();
    expect(
      marketplaceFileMediaType(new File(["PK"], "Perfil.streamDeckProfile")),
    ).toBe("archive");
    const profile = new File(["{}"], "profile.JSON", {
      type: "application/octet-stream",
    });
    expect(marketplaceFileContentType(profile)).toBe("application/json");
    expect(marketplaceFileMediaType(profile)).toBe("profile");
    expect(validateMarketplaceFile(new File(["exe"], "program.exe"))).toContain(
      "no está admitido",
    );
  });

  it("requires the current session and sends original bytes to the authenticated marketplace endpoint", async () => {
    const file = new File(["PK"], "pack.streamDeckPlugin");
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ storageId: "owned-file", mediaType: "archive" }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(uploadMarketplaceFile(file, null)).rejects.toThrow("sesión");
    expect(fetch).not.toHaveBeenCalled();
    await expect(uploadMarketplaceFile(file, "test-session")).resolves.toEqual({
      storageId: "owned-file",
      mediaType: "archive",
    });
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      "https://market.example.convex.site/marketplace/media",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/zip",
          Authorization: "Bearer test-session",
        },
        body: file,
      },
    );
  });

  it("never claims a rejected or unconfirmed file was stored", async () => {
    const file = new File(["GIF89a"], "key.gif", { type: "image/gif" });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("denied", { status: 403 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(uploadMarketplaceFile(file, "test-session")).rejects.toThrow(
      "No pudimos subir",
    );
    await expect(uploadMarketplaceFile(file, "test-session")).rejects.toThrow(
      "no confirmó",
    );
  });
});
