import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel.d.ts";
import type { MutationCtx } from "../_generated/server";
import { cleanLabel } from "./deck_keys.ts";

export const deckAppearance = v.object({
  label: v.optional(v.string()),
  icon: v.optional(v.string()),
  color: v.optional(v.string()),
  mediaStorageId: v.optional(v.id("_storage")),
  mediaType: v.optional(v.union(v.literal("image"), v.literal("video"))),
});

export const deckCanvas = v.object({
  mediaStorageId: v.id("_storage"),
  mediaType: v.optional(v.union(v.literal("image"), v.literal("video"))),
});

export async function getDeckMedia(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
) {
  return await ctx.db
    .query("deckMedia")
    .withIndex("by_storage", (q) => q.eq("storageId", storageId))
    .unique();
}

export async function validateCanvas(
  ctx: MutationCtx,
  userId: Id<"users">,
  canvas: { mediaStorageId: Id<"_storage">; mediaType?: "image" | "video" },
) {
  const validated = await validateAppearance(ctx, userId, canvas);
  return {
    mediaStorageId: canvas.mediaStorageId,
    mediaType: validated.mediaType!,
  };
}

export async function validateAppearance(
  ctx: MutationCtx,
  userId: Id<"users">,
  appearance: NonNullable<Doc<"deckKeys">["appearance"]>,
) {
  if (appearance.color && !/^#[0-9a-fA-F]{6}$/.test(appearance.color)) {
    throw new ConvexError({ code: "BAD_REQUEST", message: "Color inválido" });
  }
  let mediaType: "image" | "video" | undefined;
  if (appearance.mediaStorageId) {
    const media = await getDeckMedia(ctx, appearance.mediaStorageId);
    if (!media || media.userId !== userId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Archivo no autorizado",
      });
    }
    if (!(await ctx.db.system.get("_storage", appearance.mediaStorageId))) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Archivo no encontrado",
      });
    }
    mediaType = media.mediaType;
  } else if (appearance.mediaType) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Falta el archivo multimedia",
    });
  }
  return {
    ...appearance,
    label:
      appearance.label === undefined
        ? undefined
        : cleanLabel(appearance.label, 30),
    icon:
      appearance.icon === undefined
        ? undefined
        : cleanLabel(appearance.icon, 60),
    mediaType,
  };
}
