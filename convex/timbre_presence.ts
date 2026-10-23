import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { expirePresenceSource } from "./lib/timbre_presence";

export const expireSource = internalMutation({
  args: { userId: v.id("users"), sourceKey: v.string() },
  handler: (ctx, args) =>
    expirePresenceSource(ctx, args.userId, args.sourceKey),
});
