import { validateCanvas } from "./lib/deck_appearance";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCurrentUser } from "./lib/current_user.ts";

const VOLUME_STEP = 10;

// Sube, baja o silencia el volumen de los videos del Display
export const adjustVolume = mutation({
  args: {
    action: v.union(v.literal("up"), v.literal("down"), v.literal("mute")),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const current = user.displayVolume ?? 0;
    const next =
      args.action === "mute"
        ? 0
        : Math.min(
            100,
            Math.max(
              0,
              current + (args.action === "up" ? VOLUME_STEP : -VOLUME_STEP),
            ),
          );
    await ctx.db.patch("users", user._id, { displayVolume: next });
    return next;
  },
});

export const getBackground = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const background = user.displayBackground;
    return background
      ? {
          ...background,
          mediaUrl: await ctx.storage.getUrl(background.mediaStorageId),
        }
      : null;
  },
});
export const setBackground = mutation({
  args: {
    storageId: v.id("_storage"),
    fit: v.union(v.literal("cover"), v.literal("contain")),
    showStatus: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const media = await validateCanvas(ctx, user._id, {
      mediaStorageId: args.storageId,
    });
    await ctx.db.patch("users", user._id, {
      displayBackground: {
        ...media,
        fit: args.fit,
        showStatus: args.showStatus,
      },
    });
  },
});
export const clearBackground = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    await ctx.db.patch("users", user._id, { displayBackground: undefined });
  },
});
