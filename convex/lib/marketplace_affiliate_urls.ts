// Import fetches never follow a link outside the provider's public domains.
// This allowlist is independent from the more general external purchase URLs.
const COUNTRY_DOMAINS = [
  "mercadolibre.com", "mercadolibre.com.ar", "mercadolibre.com.mx",
  "mercadolibre.com.co", "mercadolibre.cl", "mercadolibre.com.uy",
  "mercadolibre.com.pe", "mercadolibre.com.ec", "mercadolibre.com.bo",
  "mercadolibre.com.py", "mercadolibre.com.ve", "mercadolivre.com.br",
];

function publicHttps(value: string): URL | null {
  if (value.length > 4096) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return null;
    if (/^[\d.]+$/.test(url.hostname) || url.hostname.startsWith("["))
      return null;
    return url;
  } catch {
    return null;
  }
}

function providerDomain(host: string) {
  return COUNTRY_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function safeAffiliateFetchUrl(value: string): string | null {
  const url = publicHttps(value);
  if (!url || !(url.hostname === "meli.la" || providerDomain(url.hostname))) return null;
  // The merchant link remains unchanged in the product; only HTTP requests
  // remove fragments because they have no server-side meaning.
  url.hash = "";
  return url.href;
}

export function safeMarketplaceMediaUrl(value: string): string | null {
  const url = publicHttps(value);
  if (!url) return null;
  const cdn = url.hostname === "mlstatic.com" || url.hostname.endsWith(".mlstatic.com");
  const directMedia = /\.(?:jpe?g|png|webp|gif|avif|mp4|webm)$/i.test(url.pathname);
  return (cdn || providerDomain(url.hostname)) && directMedia ? url.href : null;
}

export function mercadoLibreItemId(value: string): string | null {
  const safe = safeAffiliateFetchUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  // /p/MLA… identifies a catalogue page, not a seller item. The actual listing
  // may be selected with wid; querying /items with a catalogue id is incorrect.
  const candidates = [url.searchParams.get("item_id"), url.searchParams.get("wid"), url.searchParams.get("id"), /^\/p\//i.test(url.pathname) ? null : url.pathname];
  for (const candidate of candidates) {
    const match = candidate?.match(/(?:^|[^A-Z0-9])(ML[A-Z])-?(\d{6,16})(?=$|[^0-9])/i);
    if (match) return `${match[1].toUpperCase()}${match[2]}`;
  }
  return null;
}
