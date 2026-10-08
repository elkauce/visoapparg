import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireCurrentUser } from "./lib/current_user.ts";

const VOLUME_STEP = 10;

// Sube, baja o silencia el volumen de los videos del Display
export const adjustVolume = mutation({
  args: { action: v.union(v.literal("up"), v.literal("down"), v.literal("mute")) },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const current = user.displayVolume ?? 0;
    const next =
      args.action === "mute"
        ? 0
        : Math.min(100, Math.max(0, current + (args.action === "up" ? VOLUME_STEP : -VOLUME_STEP)));
    await ctx.db.patch("users", user._id, { displayVolume: next });
    return next;
  },
});
