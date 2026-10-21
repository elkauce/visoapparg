import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireCurrentUser } from "./lib/current_user";
import { validateAppearance } from "./lib/deck_appearance";

/** Applying artwork changes only a key's appearance, never its current action. */
export const applyKeyMedia = mutation({
  args: {
    productId: v.string(),
    assetId: v.string(),
    keyId: v.id("deckKeys"),
    storageId: v.id("_storage"),
    expectedMediaStorageId: v.union(v.id("_storage"), v.null()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const entry = await ctx.db
      .query("marketplaceLibrary")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", user._id).eq("productId", args.productId),
      )
      .unique();
    const asset = entry?.assets.find((item) => item.id === args.assetId);
    if (
      !entry ||
      !["icons", "screensavers"].includes(entry.category) ||
      !asset ||
      !["image", "video"].includes(asset.mediaType)
    )
      throw new ConvexError("Este recurso visual no está en tu biblioteca.");
    const key = await ctx.db.get("deckKeys", args.keyId);
    if (!key || key.userId !== user._id)
      throw new ConvexError("La tecla no pertenece a tu cuenta.");
    if (
      (key.appearance?.mediaStorageId ?? null) !== args.expectedMediaStorageId
    )
      throw new ConvexError(
        "La imagen de esta tecla cambió en otro dispositivo. Revisá la vista previa e intentá de nuevo.",
      );
    const appearance = await validateAppearance(ctx, user._id, {
      ...key.appearance,
      mediaStorageId: args.storageId,
    });
    if (appearance.mediaType !== asset.mediaType)
      throw new ConvexError(
        "El archivo no corresponde al recurso seleccionado.",
      );
    await ctx.db.patch("deckKeys", key._id, { appearance });
    return { keyId: key._id, pageId: key.pageId };
  },
});
