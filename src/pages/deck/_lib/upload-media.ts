import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { getSiteUrl } from "@/lib/site-url.ts";

export const MAX_KEY_MEDIA_BYTES = 60 * 1024 * 1024;

export function validateKeyMedia(file: File): string | null {
  if (
    !file.type.startsWith("image/") &&
    !["video/mp4", "video/webm"].includes(file.type)
  )
    return "Elige una imagen, GIF o un video MP4/WebM compatible.";
  if (file.size > MAX_KEY_MEDIA_BYTES) return "El archivo pesa más de 60 MB.";
  if (file.size === 0) return "El archivo está vacío.";
  return null;
}

export async function uploadKeyMedia(
  file: File,
  token: string | null,
): Promise<{ storageId: Id<"_storage">; mediaType: "image" | "video" }> {
  const invalid = validateKeyMedia(file);
  if (invalid) throw new Error(invalid);
  const siteUrl = getSiteUrl();
  if (!siteUrl || !token)
    throw new Error(
      "La sesión no está disponible. Vuelve a conectar tu cuenta antes de subir el archivo.",
    );
  const response = await fetch(`${siteUrl}/deck/media`, {
    method: "POST",
    headers: { "Content-Type": file.type, Authorization: `Bearer ${token}` },
    body: file,
  });
  if (!response.ok)
    throw new Error(
      "No se pudo subir el archivo al Deck. Comprueba tu conexión y el servidor configurado.",
    );
  const uploaded = (await response.json()) as {
    storageId?: string;
    mediaType?: string;
  };
  if (
    typeof uploaded.storageId !== "string" ||
    !["image", "video"].includes(uploaded.mediaType ?? "")
  )
    throw new Error("El servidor no confirmó la subida del archivo.");
  return {
    storageId: uploaded.storageId as Id<"_storage">,
    mediaType: uploaded.mediaType as "image" | "video",
  };
}
