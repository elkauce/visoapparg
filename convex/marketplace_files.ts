import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { getCurrentUserOrNull } from "./lib/current_user";
import {
  MAX_MARKETPLACE_BYTES,
  marketplaceError,
  marketplaceMediaType,
  marketplaceType,
} from "./lib/marketplace_validation";
import { isMarketplaceAdmin } from "./marketplace";

const MAX_CREATOR_UPLOADS = 1000;
const MAX_CREATOR_BYTES = 1024 * 1024 * 1024;

// The HTTP action calls this before reading a body. A pending creator may
// prepare uploads; publication is still subject to independent approval.
export const uploadAccess = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) return null;
    const creator = await ctx.db
      .query("creatorProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    const uploads = await ctx.db
      .query("marketplaceUploads")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(MAX_CREATOR_UPLOADS + 1);
    const usedBytes = uploads.reduce((sum, upload) => sum + upload.size, 0);
    return {
      userId: user._id,
      allowed: isMarketplaceAdmin(user._id) || creator !== null,
      remainingBytes:
        uploads.length >= MAX_CREATOR_UPLOADS
          ? 0
          : Math.max(0, MAX_CREATOR_BYTES - usedBytes),
    };
  },
});

// Only the authenticated HTTP action can establish upload ownership. Storage
// IDs supplied to saveProduct are checked against these server-created rows.
export const recordUpload = internalMutation({
  args: {
    userId: v.id("users"),
    storageId: v.id("_storage"),
    mediaType: marketplaceMediaType,
    contentType: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    const metadata = await ctx.db.system.get("_storage", args.storageId);
    if (
      !user ||
      !metadata ||
      metadata.size === 0 ||
      metadata.size > MAX_MARKETPLACE_BYTES ||
      marketplaceType(args.contentType) !== args.mediaType ||
      (metadata.contentType !== undefined &&
        marketplaceType(metadata.contentType) !== args.mediaType)
    )
      marketplaceError("El archivo no es válido.");
    const existing = await ctx.db
      .query("marketplaceUploads")
      .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (existing) {
      if (existing.userId !== user._id)
        marketplaceError("El archivo no pertenece a tu cuenta.");
      return existing._id;
    }
    const uploads = await ctx.db
      .query("marketplaceUploads")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(MAX_CREATOR_UPLOADS + 1);
    if (
      uploads.length >= MAX_CREATOR_UPLOADS ||
      uploads.reduce((sum, upload) => sum + upload.size, 0) + metadata.size >
        MAX_CREATOR_BYTES
    )
      marketplaceError(
        "Tu espacio de archivos del marketplace está completo. Contactá a VISO para ampliarlo.",
      );
    return ctx.db.insert("marketplaceUploads", {
      ...args,
      size: metadata.size,
      createdAt: Date.now(),
    });
  },
});
