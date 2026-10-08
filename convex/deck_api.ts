import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  getCurrentUserOrNull,
  requireCurrentUser,
} from "./lib/current_user.ts";
import { ensureDeckToken, rotateDeckToken } from "./lib/deck_tokens.ts";
import { setActiveStatus } from "./lib/activate_status.ts";

const MAX_STATUSES = 24;

// Token del usuario actual (null si aún no se creó)
export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return null;
    }
    const doc = await ctx.db
      .query("deckTokens")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    return doc ? doc.token : null;
  },
});

export const ensureMine = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const doc = await ensureDeckToken(ctx, user._id);
    return doc.token;
  },
});

export const regenerate = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const doc = await ensureDeckToken(ctx, user._id);
    return await rotateDeckToken(ctx, doc);
  },
});

// Usada por el endpoint HTTP /deck/set. `status` puede ser un id, un nombre o "off"
export const activateByToken = internalMutation({
  args: { token: v.string(), status: v.string() },
  handler: async (ctx, args) => {
    const tokenDoc = await ctx.db
      .query("deckTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!tokenDoc) {
      return { ok: false as const, code: "UNAUTHORIZED" as const };
    }

    if (args.status.toLowerCase() === "off") {
      await setActiveStatus(ctx, tokenDoc.userId, null);
      return { ok: true as const, statusName: null };
    }

    const statuses = await ctx.db
      .query("statuses")
      .withIndex("by_user_and_order", (q) => q.eq("userId", tokenDoc.userId))
      .take(MAX_STATUSES);
    const wanted = args.status.toLowerCase();
    const match = statuses.find(
      (s) => s._id === args.status || s.name.toLowerCase() === wanted,
    );
    if (!match) {
      return { ok: false as const, code: "NOT_FOUND" as const };
    }
    await setActiveStatus(ctx, tokenDoc.userId, match._id);
    return { ok: true as const, statusName: match.name };
  },
});
