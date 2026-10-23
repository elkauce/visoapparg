export const CLOUDFLARE_TURN_TEMPLATE = [
  "TIMBRE_TURN_PROVIDER=cloudflare",
  "TIMBRE_CLOUDFLARE_TURN_KEY_ID=",
  "TIMBRE_CLOUDFLARE_TURN_API_TOKEN=",
].join("\n");

/** Only a hosted Convex deployment can select a dashboard destination. */
export function timbreEnvironmentDashboardUrl(backendUrl?: string) {
  if (!backendUrl) return null;
  try {
    const url = new URL(backendUrl);
    const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.convex\.cloud$/.exec(
      url.hostname,
    );
    if (
      !match ||
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null;
    return `https://dashboard.convex.dev/d/${match[1]}/settings/environment-variables`;
  } catch {
    return null;
  }
}
