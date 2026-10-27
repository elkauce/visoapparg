import type { TokenStorage } from "@convex-dev/auth/react";

export const NATIVE_GOOGLE_CALLBACK = "com.teaviso.app://oauth/google";
export const NATIVE_GOOGLE_ATTEMPT_KEY = "teaviso:native-google-attempt";

export interface NativeGoogleAttempt {
  mode: "signin" | "link";
  nonce: string;
  startedAt: number;
  returnPath: string;
  verifier: string;
}

const NONCE = /^[0-9a-f]{64}$/;
const CODE = /^(?:[0-9]{8}|[0-9a-f]{64})$/;
const VERIFIER = /^[a-zA-Z0-9_-]{16,256}$/;
const UNSAFE_CHARACTERS = /[\s\p{Cc}]/u;
const ATTEMPT_LIFETIME = 10 * 60_000;
const RETURN_PATH =
  /^\/(?:panel(?:\/[a-zA-Z0-9_-]+)*|timbre(?:\/call\/[a-zA-Z0-9]{20,64})?)$/;

export function nativeGoogleReturnPath(pathname: string): string {
  return pathname.length <= 256 &&
    !UNSAFE_CHARACTERS.test(pathname) &&
    RETURN_PATH.test(pathname)
    ? pathname
    : "/panel";
}

/** Pinned to @convex-dev/auth 0.0.96's namespaced OAuth verifier storage. */
export function nativeGoogleVerifierKey(namespace: string): string {
  return `__convexAuthOAuthVerifier_${namespace.replace(/[^a-zA-Z0-9]/g, "")}`;
}

export function createNativeGoogleNonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function nativeGoogleRedirect(nonce: string): string {
  if (UNSAFE_CHARACTERS.test(nonce) || !NONCE.test(nonce))
    throw new Error("Solicitud de Google inválida.");
  return `${NATIVE_GOOGLE_CALLBACK}?attempt=${nonce}`;
}

/** Parse only our literal callback, without URL normalization or decoding. */
export function parseNativeGoogleCallback(
  value: string,
): { nonce: string; code: string | null } | null {
  if (
    UNSAFE_CHARACTERS.test(value) ||
    !value.startsWith(`${NATIVE_GOOGLE_CALLBACK}?`) ||
    value.length > 256
  )
    return null;
  const fields = value.slice(NATIVE_GOOGLE_CALLBACK.length + 1).split("&");
  if (fields.length < 1 || fields.length > 2) return null;
  const params = new Map<string, string>();
  for (const field of fields) {
    const pair = /^(attempt|code)=([a-z0-9]+)$/.exec(field);
    if (!pair || pair[0] !== field || params.has(pair[1])) return null;
    params.set(pair[1], pair[2]);
  }
  const nonce = params.get("attempt");
  const code = params.get("code") ?? null;
  if (!nonce || !NONCE.test(nonce) || (code !== null && !CODE.test(code)))
    return null;
  return { nonce, code };
}

export function isNativeGoogleAttemptCurrent(
  attempt: NativeGoogleAttempt,
): boolean {
  const elapsed = Date.now() - attempt.startedAt;
  return elapsed >= -60_000 && elapsed <= ATTEMPT_LIFETIME;
}

/** Read a pending attempt from the native encrypted auth store. */
export async function readNativeGoogleAttempt(
  storage: TokenStorage,
): Promise<NativeGoogleAttempt | null> {
  try {
    const raw = await storage.getItem(NATIVE_GOOGLE_ATTEMPT_KEY);
    if (!raw || raw.length > 2048) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const record = value as Record<string, unknown>;
    if (
      Object.keys(record).length !== 5 ||
      (record.mode !== "signin" && record.mode !== "link") ||
      typeof record.nonce !== "string" ||
      UNSAFE_CHARACTERS.test(record.nonce) ||
      !NONCE.test(record.nonce) ||
      typeof record.startedAt !== "number" ||
      !Number.isFinite(record.startedAt) ||
      record.startedAt < 0 ||
      typeof record.returnPath !== "string" ||
      nativeGoogleReturnPath(record.returnPath) !== record.returnPath ||
      typeof record.verifier !== "string" ||
      UNSAFE_CHARACTERS.test(record.verifier) ||
      !VERIFIER.test(record.verifier)
    )
      return null;
    const attempt: NativeGoogleAttempt = {
      mode: record.mode,
      nonce: record.nonce,
      startedAt: record.startedAt,
      returnPath: record.returnPath,
      verifier: record.verifier,
    };
    return isNativeGoogleAttemptCurrent(attempt) ? attempt : null;
  } catch {
    // Vault access failures and malformed state never reveal authentication data.
    return null;
  }
}
