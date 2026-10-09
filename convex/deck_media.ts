import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const MAX_DECK_MEDIA_BYTES = 60 * 1024 * 1024;

export function deckMediaType(contentType: string | null) {
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
    return "image" as const;
  if (["video/mp4", "video/webm", "video/ogg"].includes(type ?? ""))
    return "video" as const;
  return null;
}

// Invocada exclusivamente después de almacenar el cuerpo autenticado en HTTP.
export const recordUpload = internalMutation({
  args: {
    userId: v.id("users"),
    storageId: v.id("_storage"),
    mediaType: v.union(v.literal("image"), v.literal("video")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    const metadata = await ctx.db.system.get("_storage", args.storageId);
    // Algunos runtimes omiten contentType para storage.store(Blob).
    // El endpoint interno ya validó el cuerpo y su MIME antes de guardar el tipo.
    const metadataType = deckMediaType(metadata?.contentType ?? null);
    const mediaType = args.mediaType;
    if (
      !user ||
      !metadata ||
      metadata.size === 0 ||
      metadata.size > MAX_DECK_MEDIA_BYTES ||
      (metadata.contentType !== undefined && metadataType !== mediaType)
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Archivo inválido",
      });
    }
    const existing = await ctx.db
      .query("deckMedia")
      .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (existing) {
      if (existing.userId !== user._id) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Archivo no autorizado",
        });
      }
      return mediaType;
    }
    await ctx.db.insert("deckMedia", {
      userId: user._id,
      storageId: args.storageId,
      mediaType,
    });
    return mediaType;
  },
});
