import { ConvexError, v } from "convex/values";

export const marketplaceCategory = v.union(
  v.literal("icons"),
  v.literal("plugins"),
  v.literal("profiles"),
  v.literal("screensavers"),
  v.literal("soundboards"),
  v.literal("hardware"),
  v.literal("used"),
  v.literal("new"),
  v.literal("pages"),
);
export type MarketplaceCategory =
  | "icons"
  | "plugins"
  | "profiles"
  | "screensavers"
  | "soundboards"
  | "hardware"
  | "used"
  | "new"
  | "pages";
export const marketplaceMediaType = v.union(
  v.literal("image"),
  v.literal("video"),
  v.literal("audio"),
  v.literal("archive"),
  v.literal("profile"),
);
export type MarketplaceMediaType =
  "image" | "video" | "audio" | "archive" | "profile";
export const marketplaceAsset = v.object({
  id: v.string(),
  name: v.string(),
  mediaType: marketplaceMediaType,
  storageId: v.optional(v.id("_storage")),
  builtinPath: v.optional(v.string()),
});
export const marketplacePriceMode = v.union(
  v.literal("free"),
  v.literal("external"),
  v.literal("info"),
  v.literal("paid"),
);
export const marketplaceDelivery = v.union(
  v.literal("assets"),
  v.literal("profile"),
  v.literal("plugin"),
  v.literal("inquiry"),
  v.literal("page"),
);
export const marketplacePageTemplate = v.union(
  v.literal("football"),
  v.literal("clock"),
  v.literal("weather"),
  v.literal("spotify"),
  v.literal("visualizer"),
);
export const marketplaceGalleryItem = v.object({
  id: v.string(),
  name: v.string(),
  mediaType: v.union(v.literal("image"), v.literal("video")),
  storageId: v.optional(v.id("_storage")),
  builtinPath: v.optional(v.string()),
  externalUrl: v.optional(v.string()),
});
export const marketplaceDetails = v.object({
  type: v.optional(v.string()),
  device: v.optional(v.string()),
  os: v.optional(v.string()),
  compatibility: v.optional(v.string()),
  size: v.optional(v.string()),
  version: v.optional(v.string()),
  language: v.optional(v.string()),
  supportUrl: v.optional(v.string()),
  included: v.optional(v.string()),
  setup: v.optional(v.string()),
});
export const marketplaceChangelog = v.object({
  version: v.string(),
  date: v.string(),
  notes: v.string(),
});
export const marketplaceImportSource = v.object({
  affiliateUrl: v.string(),
  sourceUrl: v.optional(v.string()),
  itemId: v.optional(v.string()),
  importedAt: v.number(),
  availability: v.optional(v.string()),
});
export const marketplacePageSettings = v.object({
  screenSettings: v.optional(v.any()),
  standbySettings: v.optional(v.any()),
});
export const marketplaceAcquisitionSnapshot = v.object({
  productId: v.string(),
  title: v.string(),
  category: marketplaceCategory,
  creatorName: v.string(),
  delivery: marketplaceDelivery,
  assets: v.array(marketplaceAsset),
  profileTemplate: v.optional(v.literal("essential")),
  pageTemplate: v.optional(marketplacePageTemplate),
  revision: v.optional(v.number()),
  pageSettings: v.optional(marketplacePageSettings),
});
export const marketplaceProductFields = {
  creatorName: v.string(),
  title: v.string(),
  description: v.string(),
  category: marketplaceCategory,
  condition: v.optional(v.union(v.literal("new"), v.literal("used"))),
  coverStorageId: v.optional(v.id("_storage")),
  coverPath: v.optional(v.string()),
  priceMode: marketplacePriceMode,
  priceAmount: v.optional(v.number()),
  currency: v.optional(v.union(v.literal("ARS"), v.literal("USD"))),
  delivery: marketplaceDelivery,
  externalUrl: v.optional(v.string()),
  affiliate: v.boolean(),
  assets: v.array(marketplaceAsset),
  gallery: v.optional(v.array(marketplaceGalleryItem)),
  details: v.optional(marketplaceDetails),
  changelog: v.optional(v.array(marketplaceChangelog)),
  pageTemplate: v.optional(marketplacePageTemplate),
  pageSettings: v.optional(marketplacePageSettings),
  profileTemplate: v.optional(v.literal("essential")),
  importSource: v.optional(marketplaceImportSource),
};
export const MAX_MARKETPLACE_BYTES = 60 * 1024 * 1024;
export const MAX_MARKETPLACE_ASSETS = 32;
export const MAX_MARKETPLACE_LIBRARY = 500;

export function marketplaceError(message: string): never {
  throw new ConvexError(message);
}
export function cleanMarketText(value: string, max: number, label: string) {
  const cleaned = value.trim();
  if (
    !cleaned ||
    cleaned.length > max ||
    [...cleaned].some((char) => {
      const code = char.charCodeAt(0);
      return (
        code < 9 || code === 11 || code === 12 || (code >= 14 && code < 32)
      );
    })
  )
    marketplaceError(`${label}: completá entre 1 y ${max} caracteres.`);
  return cleaned;
}
export function marketExternalUrl(
  value: string | undefined,
  mercadolibreOnly = false,
): string | undefined {
  if (!value?.trim()) return undefined;
  const original = value.trim();
  if (original.length > 4096) marketplaceError("El enlace es demasiado largo.");
  let parsed: URL;
  try {
    parsed = new URL(original);
  } catch {
    return marketplaceError("Ingresá un enlace HTTPS válido.");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.port
  )
    marketplaceError("Ingresá un enlace HTTPS sin credenciales ni puerto.");
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    !host.includes(".") ||
    /^[\d.]+$/.test(host) ||
    host.endsWith(".local") ||
    host.startsWith("[")
  )
    marketplaceError("Ingresá un enlace público válido.");
  if (mercadolibreOnly) {
    const domains = [
      "mercadolibre.com",
      "mercadolibre.com.ar",
      "mercadolibre.com.mx",
      "mercadolibre.com.co",
      "mercadolibre.cl",
      "mercadolibre.com.uy",
      "mercadolibre.com.pe",
      "mercadolibre.com.ec",
      "mercadolibre.com.bo",
      "mercadolibre.com.py",
      "mercadolibre.com.ve",
      "mercadolivre.com.br",
      "meli.la",
    ];
    if (
      !domains.some((domain) => host === domain || host.endsWith(`.${domain}`))
    )
      marketplaceError("Usá un enlace de afiliado de Mercado Libre o meli.la.");
  }
  // Preserve original affiliate query encoding and parameters exactly.
  return original;
}

export function marketplaceType(
  contentType: string | null,
): MarketplaceMediaType | null {
  const type = contentType?.split(";")[0].trim().toLowerCase();
  if (
    [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "image/avif",
    ].includes(type ?? "")
  )
    return "image";
  if (["video/mp4", "video/webm"].includes(type ?? "")) return "video";
  if (
    [
      "audio/mpeg",
      "audio/wav",
      "audio/x-wav",
      "audio/ogg",
      "audio/mp4",
      "audio/webm",
    ].includes(type ?? "")
  )
    return "audio";
  if (type === "application/zip" || type === "application/x-zip-compressed")
    return "archive";
  if (type === "application/json") return "profile";
  return null;
}

// Reject HTML/SVG and a disguised executable before storing. Archives remain
// inert downloads; VISO never unpacks or executes uploaded plugin code.
export function matchesMarketplaceBytes(
  bytes: Uint8Array,
  contentType: string,
): boolean {
  const type = contentType.split(";")[0].trim().toLowerCase();
  const ascii = (offset: number, text: string) =>
    text.split("").every((c, i) => bytes[offset + i] === c.charCodeAt(0));
  if (type === "image/png")
    return bytes.length >= 8 && bytes[0] === 137 && ascii(1, "PNG\r\n\x1a\n");
  if (type === "image/jpeg")
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === "image/gif") return ascii(0, "GIF87a") || ascii(0, "GIF89a");
  if (type === "image/webp") return ascii(0, "RIFF") && ascii(8, "WEBP");
  if (type === "image/avif")
    return ascii(4, "ftyp") && (ascii(8, "avif") || ascii(8, "avis"));
  if (type === "video/mp4" || type === "audio/mp4")
    return bytes.length >= 12 && ascii(4, "ftyp");
  if (type === "video/webm" || type === "audio/webm")
    return (
      bytes[0] === 0x1a &&
      bytes[1] === 0x45 &&
      bytes[2] === 0xdf &&
      bytes[3] === 0xa3
    );
  if (type === "audio/wav" || type === "audio/x-wav")
    return ascii(0, "RIFF") && ascii(8, "WAVE");
  if (type === "audio/ogg") return ascii(0, "OggS");
  if (type === "audio/mpeg")
    return ascii(0, "ID3") || (bytes[0] === 255 && (bytes[1] & 0xe0) === 0xe0);
  if (type === "application/zip" || type === "application/x-zip-compressed")
    return (
      ascii(0, "PK") &&
      [3, 5, 7].includes(bytes[2]) &&
      [4, 6, 8].includes(bytes[3])
    );
  if (type === "application/json") {
    try {
      const json = JSON.parse(new TextDecoder().decode(bytes));
      return json !== null && typeof json === "object";
    } catch {
      return false;
    }
  }
  return false;
}
