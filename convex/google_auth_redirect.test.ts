import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { modules } from "./test.setup";
import { googleAuthRedirect } from "./lib/google_auth_redirect";

const SITE = "https://viso.example.test";
const ATTEMPT = "a1".repeat(32);
const NATIVE = `com.viso.deck://oauth/google?attempt=${ATTEMPT}`;

describe("Google sign-in return destinations", () => {
  it("allows only the literal APK destination and a 256-bit attempt nonce", () => {
    expect(googleAuthRedirect(NATIVE, SITE)).toBe(NATIVE);
    expect(
      googleAuthRedirect(
        "com.viso.deck://oauth/google?attempt=" + "0".repeat(64),
        SITE,
      ),
    ).toBe("com.viso.deck://oauth/google?attempt=" + "0".repeat(64));
  });

  it.each([
    NATIVE.replace("com.viso.deck:", "com.other.app:"),
    NATIVE.replace("com.viso.deck:", "COM.VISO.DECK:"),
    NATIVE.replace("//oauth/", "//other/"),
    NATIVE.replace("//oauth/", "//user@oauth/"),
    NATIVE.replace("//oauth/", "//oauth:443/"),
    NATIVE.replace("//oauth/", "//oauth.evil.test/"),
    NATIVE.replace("/google?", "/other?"),
    NATIVE.replace("/google?", "/%67oogle?"),
    NATIVE.replace("/google?", "/path/../google?"),
    NATIVE.replace("/google?", "/google/?"),
    NATIVE.replace("attempt=", "%61ttempt="),
    NATIVE.replace("a1", "%611"),
    NATIVE.replace(ATTEMPT, ATTEMPT.toUpperCase()),
    NATIVE.replace(ATTEMPT, ATTEMPT.slice(1)),
    NATIVE + "0",
    NATIVE + "&code=untrusted",
    NATIVE + "&attempt=" + ATTEMPT,
    NATIVE + "&",
    NATIVE + "#fragment",
    NATIVE + " ",
    " " + NATIVE,
    NATIVE + "\n",
    NATIVE.replace("//oauth/", "///oauth/"),
    NATIVE.replace("/google?", "\\google?"),
    "com.viso.deck://oauth/google",
    "com.viso.deck://oauth/google?attempt=",
    "javascript:alert(1)",
  ])("rejects an APK return lookalike: %s", (destination) => {
    expect(() => googleAuthRedirect(destination, SITE)).toThrow();
  });

  it.each([
    ["/?google=return", SITE + "/?google=return"],
    ["?google=return", SITE + "?google=return"],
    ["/account?tab=login#google", SITE + "/account?tab=login#google"],
    [SITE, SITE],
    [SITE + "/?google=return", SITE + "/?google=return"],
    [SITE + "?google=return", SITE + "?google=return"],
  ])("preserves the existing web return %s", (destination, expected) => {
    expect(googleAuthRedirect(destination, SITE + "/")).toBe(expected);
  });

  it.each([
    "https://evil.test/?google=return",
    SITE + ".evil.test/?google=return",
    SITE + "@evil.test/?google=return",
    "//evil.test/?google=return",
    "/\\evil.test",
    "/\n/evil.test",
    "https://viso.example.test:443/?google=return",
    "#google=return",
    "",
  ])("rejects cross-origin or malformed web return %s", (destination) => {
    expect(() => googleAuthRedirect(destination, SITE)).toThrow();
  });

  it("requires a web SITE_URL for web returns", () => {
    expect(() => googleAuthRedirect("/?google=return", "")).toThrow(
      /SITE_URL/,
    );
    expect(() =>
      googleAuthRedirect("/?google=return", "javascript:alert(1)"),
    ).toThrow(/SITE_URL/);
  });
});

describe("configured Google callback", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each([NATIVE, SITE + "/?google=return"])(
    "returns a cancelled callback to the allowlisted destination %s",
    async (destination) => {
      vi.stubEnv("AUTH_GOOGLE_ID", "test.apps.googleusercontent.com");
      vi.stubEnv("AUTH_GOOGLE_SECRET", "test-only-secret");
      vi.stubEnv("SITE_URL", SITE);
      vi.stubEnv("CONVEX_SITE_URL", "https://auth-test.example.test");
      // Only discovery is needed before the missing OAuth state is rejected.
      // No Google authorization, token exchange or real account is simulated.
      const discovery = vi.fn(async () =>
        Response.json({
          issuer: "https://accounts.google.com",
          authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
          token_endpoint: "https://oauth2.googleapis.com/token",
          userinfo_endpoint: "https://openidconnect.googleapis.com/v1/userinfo",
          jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",
        }),
      );
      vi.stubGlobal("fetch", discovery);
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const t = convexTest(schema, modules);
      const response = await t.fetch(
        "/api/auth/callback/google?error=access_denied",
        {
          headers: {
            Cookie: `__Host-googleRedirectTo=${encodeURIComponent(destination)}`,
          },
        },
      );
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(destination);
      expect(discovery).toHaveBeenCalledOnce();
      expect(await t.run((ctx) => ctx.db.query("users").collect())).toEqual(
        [],
      );
      expect(
        await t.run((ctx) => ctx.db.query("authSessions").collect()),
      ).toEqual([]);
    },
  );
});
