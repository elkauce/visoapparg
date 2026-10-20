/**
 * The Google OAuth callback remains on Convex's HTTPS origin. Only its final
 * destination may return to the installed APK, with an app-generated nonce.
 * Match the literal URL so parsing cannot normalize an encoded lookalike into
 * an allowed destination or silently discard duplicate/extra parameters.
 */
const NATIVE_GOOGLE_RETURN =
  /^com\.viso\.deck:\/\/oauth\/google\?attempt=[a-f0-9]{64}$/;

export function googleAuthRedirect(
  redirectTo: string,
  configuredSiteUrl: string | undefined = process.env.SITE_URL,
): string {
  if (
    redirectTo.length > 8192 ||
    /[\s\\]/.test(redirectTo) ||
    Array.from(redirectTo).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    }) ||
    redirectTo.startsWith("//")
  )
    throw new Error("Invalid sign-in destination.");
  if (NATIVE_GOOGLE_RETURN.test(redirectTo)) return redirectTo;

  const baseUrl = configuredSiteUrl?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("SITE_URL must be configured for sign-in.");
  const site = new URL(baseUrl);
  if (
    !["https:", "http:"].includes(site.protocol) ||
    site.username ||
    site.password ||
    site.search ||
    site.hash
  )
    throw new Error("SITE_URL is not a valid web sign-in origin.");

  // Preserve the SDK's existing site-relative and same-site destinations. The
  // origin check also protects against URL canonicalization or host suffixes.
  let destination: string | undefined;
  if (redirectTo.startsWith("?") || redirectTo.startsWith("/")) {
    destination = `${baseUrl}${redirectTo}`;
  } else if (redirectTo.startsWith(baseUrl)) {
    const next = redirectTo[baseUrl.length];
    if (next === undefined || next === "?" || next === "/")
      destination = redirectTo;
  }
  if (destination && new URL(destination).origin === site.origin)
    return destination;
  throw new Error("Invalid sign-in destination.");
}
