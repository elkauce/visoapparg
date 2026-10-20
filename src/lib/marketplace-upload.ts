import type { Id } from "@/convex/_generated/dataModel";
import { getSiteUrl } from "./site-url";

export const MARKETPLACE_FILE_LIMIT = 60 * 1024 * 1024;
export type MarketMediaType =
  "image" | "video" | "audio" | "archive" | "profile";
export type MarketUpload = {
  storageId: Id<"_storage">;
  mediaType: MarketMediaType;
};

const TYPES: Record<string, MarketMediaType> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/gif": "image",
  "image/avif": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "audio/mpeg": "audio",
  "audio/wav": "audio",
  "audio/x-wav": "audio",
  "audio/ogg": "audio",
  "audio/mp4": "audio",
  "audio/webm": "audio",
  "application/zip": "archive",
  "application/x-zip-compressed": "archive",
  "application/json": "profile",
};

export function marketplaceFileContentType(file: File): string {
  const declared = file.type.toLowerCase();
  if (declared && declared !== "application/octet-stream") return declared;
  // Windows sometimes provides no MIME for these inert download formats.
  // The server still verifies the actual ZIP/JSON bytes before accepting them.
  if (/\.(?:zip|streamdeckplugin|streamdeckprofile)$/i.test(file.name))
    return "application/zip";
  if (/\.json$/i.test(file.name)) return "application/json";
  return declared;
}

export function marketplaceFileMediaType(file: File): MarketMediaType | null {
  return TYPES[marketplaceFileContentType(file)] ?? null;
}

export function validateMarketplaceFile(
  file: File,
  cover = false,
): string | null {
  const type = marketplaceFileMediaType(file);
  if (!type || (cover && type !== "image"))
    return cover
      ? "Elegí una portada PNG, JPG, WebP, GIF o AVIF."
      : "Este formato no está admitido. Usá imagen, GIF, MP4/WebM, audio, ZIP o JSON.";
  if (!file.size) return "El archivo está vacío.";
  if (file.size > MARKETPLACE_FILE_LIMIT)
    return "Cada archivo puede pesar hasta 60 MB.";
  if (type === "profile" && file.size > 512 * 1024)
    return "El perfil JSON puede pesar hasta 512 KB.";
  return null;
}

export async function uploadMarketplaceFile(
  file: File,
  token: string | null,
): Promise<MarketUpload> {
  const invalid = validateMarketplaceFile(file);
  if (invalid) throw new Error(invalid);
  const siteUrl = getSiteUrl();
  if (!siteUrl || !token)
    throw new Error(
      "Tu sesión no está disponible. Volvé a entrar antes de subir archivos.",
    );
  const response = await fetch(`${siteUrl}/marketplace/media`, {
    method: "POST",
    headers: {
      "Content-Type": marketplaceFileContentType(file),
      Authorization: `Bearer ${token}`,
    },
    body: file,
  });
  if (!response.ok)
    throw new Error(
      "No pudimos subir el archivo. Revisá su formato, tu sesión y la conexión.",
    );
  const result = (await response.json()) as Partial<MarketUpload>;
  if (
    typeof result.storageId !== "string" ||
    !["image", "video", "audio", "archive", "profile"].includes(
      result.mediaType ?? "",
    )
  )
    throw new Error("El servidor no confirmó la subida. Intentá nuevamente.");
  return result as MarketUpload;
}

export function marketErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: unknown }).data;
    if (typeof data === "string" && data.length < 1000) return data;
  }
  if (
    error instanceof Error &&
    !error.message.includes("[CONVEX") &&
    error.message.length < 500
  )
    return error.message;
  return fallback;
}
