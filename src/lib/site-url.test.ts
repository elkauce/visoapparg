import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteUrl } from "./site-url.ts";

afterEach(() => vi.unstubAllEnvs());

describe("getSiteUrl", () => {
  it("uses the configured HTTP URL instead of the API URL for shared links", () => {
    vi.stubEnv("VITE_CONVEX_URL", "http://127.0.0.1:3210");
    vi.stubEnv("VITE_CONVEX_SITE_URL", "http://127.0.0.1:3211/");

    expect(`${getSiteUrl()}/deck/set`).toBe("http://127.0.0.1:3211/deck/set");
    expect(`${getSiteUrl()}/public/status`).toBe(
      "http://127.0.0.1:3211/public/status",
    );
  });

  it("honors custom hosted HTTP domains", () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("VITE_CONVEX_SITE_URL", "https://api.viso.example/");

    expect(getSiteUrl()).toBe("https://api.viso.example");
  });

  it("derives the hosted HTTP domain when the explicit URL is empty", () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud/");
    vi.stubEnv("VITE_CONVEX_SITE_URL", "");

    expect(getSiteUrl()).toBe("https://example.convex.site");
  });

  it.each(["localhost", "127.0.0.1", "[::1]"])(
    "uses the local HTTP port for %s when no explicit HTTP URL is configured",
    (host) => {
      vi.stubEnv("VITE_CONVEX_URL", `http://${host}:3210`);
      vi.stubEnv("VITE_CONVEX_SITE_URL", undefined);

      expect(getSiteUrl()).toBe(`http://${host}:3211`);
    },
  );

  it("preserves custom API URLs when their HTTP endpoint cannot be inferred", () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://backend.viso.example/");
    vi.stubEnv("VITE_CONVEX_SITE_URL", undefined);

    expect(getSiteUrl()).toBe("https://backend.viso.example");
  });

  it("preserves relative links when neither backend URL is configured", () => {
    vi.stubEnv("VITE_CONVEX_URL", undefined);
    vi.stubEnv("VITE_CONVEX_SITE_URL", undefined);

    expect(getSiteUrl()).toBe("");
  });
});
