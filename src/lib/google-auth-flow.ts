export type GoogleAuthMode = "signin" | "link";

export interface GoogleAuthAttempt {
  mode: GoogleAuthMode;
  startedAt: number;
}

const STORAGE_KEY = "viso:google-auth-attempt";
const ATTEMPT_LIFETIME = 10 * 60 * 1000;

export function beginGoogleAuthAttempt(mode: GoogleAuthMode): void {
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ mode, startedAt: Date.now() }),
  );
}

export function readGoogleAuthAttempt(): GoogleAuthAttempt | null {
  try {
    const value: unknown = JSON.parse(
      sessionStorage.getItem(STORAGE_KEY) ?? "null",
    );
    if (!value || typeof value !== "object") return null;
    const attempt = value as Partial<GoogleAuthAttempt>;
    if (
      (attempt.mode !== "signin" && attempt.mode !== "link") ||
      typeof attempt.startedAt !== "number" ||
      !Number.isFinite(attempt.startedAt) ||
      attempt.startedAt < 0
    )
      return null;
    return { mode: attempt.mode, startedAt: attempt.startedAt };
  } catch {
    return null;
  }
}

export function isGoogleAuthAttemptCurrent(
  attempt: GoogleAuthAttempt,
): boolean {
  const elapsed = Date.now() - attempt.startedAt;
  return elapsed >= -60_000 && elapsed <= ATTEMPT_LIFETIME;
}

export function clearGoogleAuthAttempt(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // A browser may disable storage after the redirect. No credentials live here.
  }
}

export function shouldHandleGoogleAuthCode(): boolean {
  if (typeof window === "undefined") return true;
  const params = new URLSearchParams(window.location.search);
  // Our return handler hydrates the account first and catches redemption errors.
  // Keep an expired owned attempt out of the SDK's automatic path too, so it can
  // be discarded safely without leaving the auth provider loading indefinitely.
  return !(
    params.get("google") === "return" &&
    params.has("code") &&
    readGoogleAuthAttempt() !== null
  );
}
