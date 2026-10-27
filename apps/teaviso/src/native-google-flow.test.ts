import { expect, it } from "vitest";
import {
  nativeGoogleRedirect,
  nativeGoogleReturnPath,
  parseNativeGoogleCallback,
  readNativeGoogleAttempt,
  NATIVE_GOOGLE_ATTEMPT_KEY,
} from "./native-google-flow";
const nonce = "a".repeat(64);
it("binds Te Aviso to its own literal callback and refuses VISO or encoded lookalikes", () => {
  expect(nativeGoogleRedirect(nonce)).toBe(
    `com.teaviso.app://oauth/google?attempt=${nonce}`,
  );
  expect(
    parseNativeGoogleCallback(`${nativeGoogleRedirect(nonce)}&code=12345678`),
  ).toEqual({ nonce, code: "12345678" });
  for (const value of [
    `com.viso.deck://oauth/google?attempt=${nonce}&code=12345678`,
    `${nativeGoogleRedirect(nonce)}&code=12345678&code=87654321`,
    `${nativeGoogleRedirect(nonce)}&next=https://evil.example`,
    `${nativeGoogleRedirect(nonce)}\n`,
    `com.teaviso.app://oauth/google?attempt=${nonce}&code=%31%32%33%34%35%36%37%38`,
  ])
    expect(parseNativeGoogleCallback(value)).toBeNull();
});
it("recovers only unexpired attempts with safe return paths from Te Aviso's encrypted storage key", async () => {
  let raw = JSON.stringify({
    mode: "signin",
    nonce,
    verifier: "v".repeat(32),
    startedAt: Date.now(),
    returnPath: "/panel",
  });
  const keys: string[] = [];
  const storage = {
    getItem: async (key: string) => {
      keys.push(key);
      return raw;
    },
    setItem: async () => {},
    removeItem: async () => {},
  };
  expect(await readNativeGoogleAttempt(storage)).toMatchObject({
    nonce,
    returnPath: "/panel",
  });
  expect(keys).toEqual([NATIVE_GOOGLE_ATTEMPT_KEY]);
  for (const returnPath of [
    "//evil.example",
    "/android",
    "/marketplace",
    "/panel/../android",
    "https://evil.example",
  ]) {
    raw = JSON.stringify({
      mode: "signin",
      nonce,
      verifier: "v".repeat(32),
      startedAt: Date.now(),
      returnPath,
    });
    expect(await readNativeGoogleAttempt(storage)).toBeNull();
  }
  raw = JSON.stringify({
    mode: "signin",
    nonce,
    verifier: "v".repeat(32),
    startedAt: Date.now() - 11 * 60000,
    returnPath: "/panel",
  });
  expect(await readNativeGoogleAttempt(storage)).toBeNull();
});

it("preserves valid incoming call and timbre paths across Google attempt recovery", async () => {
  const callId = "abc123".repeat(4);
  for (const pathname of [
    "/panel/cuenta",
    "/timbre",
    `/timbre/call/${callId}`,
  ]) {
    const attempt = {
      mode: "signin",
      nonce,
      verifier: "v".repeat(32),
      startedAt: Date.now(),
      returnPath: nativeGoogleReturnPath(pathname),
    };
    const storage = {
      getItem: async () => JSON.stringify(attempt),
      setItem: async () => {},
      removeItem: async () => {},
    };
    expect(await readNativeGoogleAttempt(storage)).toMatchObject({
      returnPath: pathname,
    });
  }
});

it("normalizes unsafe or unsupported starting paths before storing an attempt", async () => {
  for (const pathname of [
    "//evil.example",
    "https://evil.example/panel",
    "/panel/../android",
    "/panel%2fcuenta",
    "/panel\n",
    "/android",
    "/timbre/call/short",
    `/timbre/call/${"a".repeat(65)}`,
    `/timbre/call/${"_".repeat(24)}`,
    `/timbre/call/${"a".repeat(24)}/extra`,
  ]) {
    expect(nativeGoogleReturnPath(pathname)).toBe("/panel");
    const attempt = {
      mode: "signin",
      nonce,
      verifier: "v".repeat(32),
      startedAt: Date.now(),
      returnPath: pathname,
    };
    const storage = {
      getItem: async () => JSON.stringify(attempt),
      setItem: async () => {},
      removeItem: async () => {},
    };
    // Recovery remains strict if invalid state bypasses the starting path guard.
    expect(await readNativeGoogleAttempt(storage)).toBeNull();
    attempt.returnPath = nativeGoogleReturnPath(pathname);
    expect(await readNativeGoogleAttempt(storage)).toMatchObject({
      returnPath: "/panel",
    });
  }
});
