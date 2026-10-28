import { nativeGoogleReturnPath } from "./native-google-flow";
const KEY = "teaviso:signin-destination";
const LIFETIME = 10 * 60_000;
/** Preserve only app-owned account routes and known non-secret selection fields. */
export function signInDestination(pathname: string, search: string): string {
  const path = nativeGoogleReturnPath(pathname);
  const input = new URLSearchParams(search),
    output = new URLSearchParams();
  const interest = input.get("interes");
  if (interest && ["hogares", "negocios", "edificios"].includes(interest))
    output.set("interes", interest);
  const space = input.get("space");
  if (space && /^[a-zA-Z0-9]{1,64}$/.test(space)) output.set("space", space);
  if (input.get("advanced") === "1") output.set("advanced", "1");
  return `${path}${output.size ? `?${output}` : ""}`;
}
export function rememberSignInDestination(path: string, search: string) {
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ path: signInDestination(path, search), at: Date.now() }),
    );
  } catch {
    /* Login remains available when storage is disabled. */
  }
}
export function consumeSignInDestination(): string | null {
  try {
    const saved = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!saved) return null;
    const value = JSON.parse(saved);
    if (
      typeof value.path !== "string" ||
      typeof value.at !== "number" ||
      value.at > Date.now() ||
      Date.now() - value.at > LIFETIME
    )
      return null;
    const target = new URL(value.path, window.location.origin);
    const valid = signInDestination(target.pathname, target.search);
    return target.origin === window.location.origin && value.path === valid
      ? valid
      : null;
  } catch {
    return null;
  }
}
export function clearSignInDestination() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* Storage may be unavailable. */
  }
}
