import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { getSiteUrl } from "@/lib/site-url.ts";

export const MAX_KEY_MEDIA_BYTES = 60 * 1024 * 1024;

export function validateKeyMedia(file: File): string | null {
  if (
    ![
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "image/avif",
      "video/mp4",
      "video/webm",
    ].includes(file.type)
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

/** Copy a bundled first-party resource to the same authenticated media pipeline
 * as a personal file. Never save a development or preview URL in the key. */
export async function uploadBuiltinKeyMedia(
  asset: { builtinPath: string; name: string; mimeType?: string },
  token: string | null,
): Promise<{ storageId: Id<"_storage">; mediaType: "image" | "video" }> {
  if (!token)
    throw new Error("Vuelve a conectar tu cuenta antes de aplicar el recurso.");
  if (
    !/^\/marketplace\/[a-zA-Z0-9_./-]+$/.test(asset.builtinPath) ||
    asset.builtinPath.includes("..")
  )
    throw new Error("El recurso VISO no es válido.");
  const response = await fetch(asset.builtinPath, {
    credentials: "same-origin",
  });
  if (!response.ok)
    throw new Error("No se pudo descargar el recurso VISO. Intenta de nuevo.");
  const blob = await response.blob();
  const name = asset.builtinPath.split("/").at(-1) ?? asset.name;
  return uploadKeyMedia(
    new File([blob], name, { type: asset.mimeType ?? blob.type }),
    token,
  );
}
