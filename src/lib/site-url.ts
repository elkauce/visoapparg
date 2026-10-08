// Las acciones HTTP usan una URL distinta a la conexión de Convex.
export function getSiteUrl(): string {
  const siteUrl = import.meta.env.VITE_CONVEX_SITE_URL?.trim();
  if (siteUrl) return siteUrl.replace(/\/+$/, "");

  const cloudUrl = import.meta.env.VITE_CONVEX_URL?.trim() ?? "";
  if (!cloudUrl) return "";

  try {
    const url = new URL(cloudUrl);
    if (url.hostname.endsWith(".convex.cloud")) {
      url.hostname = url.hostname.replace(/\.convex\.cloud$/, ".convex.site");
    } else if (
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      url.port === "3210"
    ) {
      // Puertos predeterminados del backend local: API 3210, acciones HTTP 3211.
      url.port = "3211";
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    return cloudUrl;
  }
}
