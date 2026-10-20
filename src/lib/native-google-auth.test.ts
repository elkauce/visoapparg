import { afterEach, describe, expect, it, vi } from "vitest";
import type { TokenStorage } from "@convex-dev/auth/react";
import {
  createNativeGoogleNonce,
  isNativeGoogleAttemptCurrent,
  NATIVE_GOOGLE_ATTEMPT_KEY,
  NATIVE_GOOGLE_CALLBACK,
  nativeGoogleRedirect,
  nativeGoogleVerifierKey,
  parseNativeGoogleCallback,
  readNativeGoogleAttempt,
  type NativeGoogleAttempt,
} from "./native-google-auth";

const nonce = "a1".repeat(32);
const linkingCode = "b2".repeat(32);
const validAttempt = (): NativeGoogleAttempt => ({
  mode: "signin",
  nonce,
  startedAt: Date.now(),
  returnPath: "/android/settings",
  verifier: "test-verifier-0123456789",
});
const storageWith = (value: unknown): TokenStorage => ({
  getItem: vi.fn().mockResolvedValue(JSON.stringify(value)),
  setItem: vi.fn(),
  removeItem: vi.fn(),
});

afterEach(() => vi.useRealTimers());

describe("native Google callback", () => {
  it("creates a cryptographic nonce and exact callback without account tokens", () => {
    const getRandomValues = vi.spyOn(crypto, "getRandomValues");
    const generated = createNativeGoogleNonce();
    expect(getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(getRandomValues.mock.calls[0][0]).toHaveLength(32);
    expect(generated).toMatch(/^[0-9a-f]{64}$/);
    expect(nativeGoogleRedirect(generated)).toBe(
      `${NATIVE_GOOGLE_CALLBACK}?attempt=${generated}`,
    );
    expect(() => nativeGoogleRedirect("bad")).toThrow(
      "Solicitud de Google inválida.",
    );
  });

  it("accepts only the expected one-time sign-in or linking code", () => {
    expect(parseNativeGoogleCallback(nativeGoogleRedirect(nonce))).toEqual({
      nonce,
      code: null,
    });
    for (const code of ["01234567", linkingCode]) {
      expect(
        parseNativeGoogleCallback(`${nativeGoogleRedirect(nonce)}&code=${code}`),
      ).toEqual({ nonce, code });
      expect(
        parseNativeGoogleCallback(
          `${NATIVE_GOOGLE_CALLBACK}?code=${code}&attempt=${nonce}`,
        ),
      ).toEqual({ nonce, code });
    }
  });

  it("rejects other origins, paths, normalization and encoded ambiguities", () => {
    const query = `?attempt=${nonce}&code=01234567`;
    for (const base of [
      "https://oauth/google",
      "COM.VISO.DECK://oauth/google",
      "com.viso.deck://OAUTH/google",
      "com.viso.deck://oauth:443/google",
      "com.viso.deck://user@oauth/google",
      "com.viso.deck://oauth/google/",
      "com.viso.deck://oauth/google.evil",
      "com.viso.deck://oauth/../google",
      "com.viso.deck://oauth/%67oogle",
      "com.viso.deck:///oauth/google",
      "com.viso.deck://oauth\\google",
      "com.viso.deck://oauth.evil/google",
      " com.viso.deck://oauth/google",
    ])
      expect(parseNativeGoogleCallback(base + query), base).toBeNull();
    for (const suffix of [
      "#fragment",
      "#",
      "&",
      "\n",
      " ",
      "%00",
      "&error=cancelled",
      `&attempt=${nonce}`,
    ])
      expect(
        parseNativeGoogleCallback(NATIVE_GOOGLE_CALLBACK + query + suffix),
        suffix,
      ).toBeNull();
    expect(
      parseNativeGoogleCallback(
        `${NATIVE_GOOGLE_CALLBACK}?%61ttempt=${nonce}&code=01234567`,
      ),
    ).toBeNull();
  });

  it("rejects missing, duplicate, encoded and malformed fields", () => {
    for (const query of [
      "",
      "?",
      "?code=01234567",
      `?attempt=${nonce}&attempt=${nonce}`,
      `?attempt=${nonce}&code=01234567&code=01234567`,
      `?attempt=${nonce}&code=`,
      `?attempt=${nonce}&code=1234567`,
      `?attempt=${nonce}&code=123456789`,
      `?attempt=${nonce}&code=${linkingCode.toUpperCase()}`,
      `?attempt=${nonce}&code=%30${"1".repeat(7)}`,
      `?attempt=${nonce}&code=01234567;other=value`,
      `?attempt=${nonce}&code=0123+567`,
      `?attempt=${nonce.toUpperCase()}&code=01234567`,
      `?attempt=${nonce.slice(1)}&code=01234567`,
      `?attempt=${nonce}=other&code=01234567`,
      `?attempt=${nonce}&&code=01234567`,
      `?attempt=${nonce}&unknown=value`,
    ])
      expect(
        parseNativeGoogleCallback(NATIVE_GOOGLE_CALLBACK + query),
        query,
      ).toBeNull();
  });

  it("rejects trailing line terminators, whitespace and controls without normalizing", async () => {
    for (const suffix of [
      "\n",
      "\r",
      "\r\n",
      "\u2028",
      "\u2029",
      "\u0000",
      "\u0085",
      " ",
      "\t",
      "\u00a0",
    ]) {
      expect(() => nativeGoogleRedirect(nonce + suffix)).toThrow(
        "Solicitud de Google inválida.",
      );
      expect(
        parseNativeGoogleCallback(`${nativeGoogleRedirect(nonce)}${suffix}`),
      ).toBeNull();
      expect(
        parseNativeGoogleCallback(
          `${nativeGoogleRedirect(nonce)}&code=01234567${suffix}`,
        ),
      ).toBeNull();
      expect(
        parseNativeGoogleCallback(
          `${NATIVE_GOOGLE_CALLBACK}?attempt=${nonce}${suffix}&code=01234567`,
        ),
      ).toBeNull();
      for (const field of ["nonce", "verifier", "returnPath"] as const) {
        const value = validAttempt();
        expect(
          await readNativeGoogleAttempt(
            storageWith({ ...value, [field]: value[field] + suffix }),
          ),
        ).toBeNull();
      }
    }
  });

  it("uses the Convex SDK's exact escaped namespace", () => {
    expect(
      nativeGoogleVerifierKey("https://vivid-nightingale-785.convex.cloud"),
    ).toBe(
      "__convexAuthOAuthVerifier_httpsvividnightingale785convexcloud",
    );
    expect(nativeGoogleVerifierKey("http://127.0.0.1:3210/a_b?c=d")).toBe(
      "__convexAuthOAuthVerifier_http1270013210abcd",
    );
  });
});

describe("persisted native Google attempt", () => {
  it("reads either mode and only the dedicated encrypted-store key", async () => {
    for (const mode of ["signin", "link"] as const) {
      const value = { ...validAttempt(), mode };
      const storage = storageWith(value);
      expect(await readNativeGoogleAttempt(storage)).toEqual(value);
      expect(storage.getItem).toHaveBeenCalledExactlyOnceWith(
        NATIVE_GOOGLE_ATTEMPT_KEY,
      );
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(storage.removeItem).not.toHaveBeenCalled();
    }
  });

  it("allows only internal app return paths", async () => {
    for (const returnPath of [
      "/",
      "/android",
      "/android/settings",
      "/android/integrations/google-home",
      "/deck",
      "/deck/edit",
      "/marketplace",
    ])
      expect(
        await readNativeGoogleAttempt(storageWith({ ...validAttempt(), returnPath })),
        returnPath,
      ).not.toBeNull();
    for (const returnPath of [
      "https://evil.example/",
      "//evil.example/",
      "/\\evil.example/",
      "/android.evil",
      "/android/../marketplace",
      "/android/%2e%2e/marketplace",
      "/android/settings?next=https://evil.example/",
      "/android/settings#section",
      "/deck/fake",
      "/marketplace.evil",
      "/s/customer",
      "android/settings",
    ])
      expect(
        await readNativeGoogleAttempt(storageWith({ ...validAttempt(), returnPath })),
        returnPath,
      ).toBeNull();
  });

  it("rejects expired and implausible future attempts at the time boundaries", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(2_000_000);
    const base = validAttempt();
    for (const age of [600_001, -60_001])
      expect(
        await readNativeGoogleAttempt(
          storageWith({ ...base, startedAt: Date.now() - age }),
        ),
      ).toBeNull();
    for (const age of [600_000, -60_000, 0])
      expect(
        isNativeGoogleAttemptCurrent({ ...base, startedAt: Date.now() - age }),
      ).toBe(true);
  });

  it("rejects malformed JSON, shape and verifier without storage writes", async () => {
    const base = validAttempt();
    for (const value of [
      null,
      [],
      "text",
      {},
      { ...base, extra: "unexpected" },
      { ...base, mode: "other" },
      { ...base, nonce: "x".repeat(64) },
      { ...base, startedAt: -1 },
      { ...base, startedAt: "0" },
      { ...base, startedAt: Number.POSITIVE_INFINITY },
      { ...base, returnPath: null },
      { ...base, verifier: "short" },
      { ...base, verifier: "a".repeat(257) },
      { ...base, verifier: "a".repeat(16) + "\n" },
      { ...base, verifier: "private verifier with spaces" },
    ])
      expect(await readNativeGoogleAttempt(storageWith(value))).toBeNull();
    const storage = storageWith(base);
    vi.mocked(storage.getItem).mockResolvedValueOnce("{bad JSON");
    expect(await readNativeGoogleAttempt(storage)).toBeNull();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it("contains unavailable storage without exposing data or breaking login", async () => {
    const storage = storageWith(validAttempt());
    vi.mocked(storage.getItem).mockRejectedValueOnce(new Error("private diagnostic"));
    await expect(readNativeGoogleAttempt(storage)).resolves.toBeNull();
  });
});
