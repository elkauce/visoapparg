import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireCurrentUser } from "./lib/current_user.ts";
import { getOwnedStatus } from "./lib/owned_status.ts";
import { getDeckMedia } from "./lib/deck_appearance.ts";

const MAX_MEDIA_BYTES = 60 * 1024 * 1024;

// Marketplace originals belong to the creator and can back many libraries.
// They must first be copied to the current user's deckMedia before being used
// by an editor that historically owns and deletes its status-upload files.
export async function isMarketplaceOriginal(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
) {
  return (
    (await ctx.db
      .query("marketplaceUploads")
      .withIndex("by_storage", (q) => q.eq("storageId", storageId))
      .unique()) !== null
  );
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireCurrentUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// Asocia un archivo ya subido al estado. Valida tipo y tamaño en el servidor
export const setMedia = mutation({
  args: { statusId: v.id("statuses"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const status = await getOwnedStatus(ctx, user._id, args.statusId);

    if (await isMarketplaceOriginal(ctx, args.storageId)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message:
          "Usá una copia de tu biblioteca; el archivo original pertenece al marketplace.",
      });
    }

    const deckFile = await getDeckMedia(ctx, args.storageId);
    if (deckFile && deckFile.userId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Archivo no autorizado",
      });
    }

    const meta = await ctx.db.system.get("_storage", args.storageId);
    if (!meta) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Archivo no encontrado",
      });
    }
    const kind = meta.contentType?.startsWith("image/")
      ? ("image" as const)
      : meta.contentType?.startsWith("video/")
        ? ("video" as const)
        : (deckFile?.mediaType ?? null);
    if (!kind || meta.size > MAX_MEDIA_BYTES) {
      if (!deckFile) await ctx.storage.delete(args.storageId);
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Sube una imagen, PNG o video de hasta 60 MB",
      });
    }

    // Reemplazar no borra el archivo anterior: lo borramos para no dejar basura
    if (
      status.mediaStorageId &&
      status.mediaStorageId !== args.storageId &&
      !(await getDeckMedia(ctx, status.mediaStorageId)) &&
      !(await isMarketplaceOriginal(ctx, status.mediaStorageId))
    ) {
      await ctx.storage.delete(status.mediaStorageId);
    }
    await ctx.db.patch("statuses", status._id, {
      mediaStorageId: args.storageId,
      mediaType: kind,
    });
    return null;
  },
});

export const clearMedia = mutation({
  args: { statusId: v.id("statuses") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const status = await getOwnedStatus(ctx, user._id, args.statusId);
    if (
      status.mediaStorageId &&
      !(await getDeckMedia(ctx, status.mediaStorageId)) &&
      !(await isMarketplaceOriginal(ctx, status.mediaStorageId))
    ) {
      await ctx.storage.delete(status.mediaStorageId);
    }
    await ctx.db.patch("statuses", status._id, {
      mediaStorageId: undefined,
      mediaType: undefined,
    });
    return null;
  },
});
