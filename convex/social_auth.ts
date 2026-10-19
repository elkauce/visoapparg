import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { googleAvailable } from "./lib/google_auth";

const INTENT_TTL = 5 * 60_000;

export const availability = query({
  args: {},
  handler: async () => ({ google: googleAvailable() }),
});

export const connection = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId || !(await ctx.db.get("users", userId))) {
      return { linked: false };
    }
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", userId).eq("provider", "google"),
      )
      .take(1);
    return accounts[0]
      ? {
          linked: true,
          ...(accounts[0].emailVerified
            ? { email: accounts[0].emailVerified }
            : {}),
        }
      : { linked: false };
  },
});

export const prepareGoogleLink = mutation({
  args: {},
  handler: async (ctx) => {
    if (!googleAvailable())
      throw new ConvexError("Google todavía no está disponible.");
    const sessionId = await getAuthSessionId(ctx);
    const userId = await getAuthUserId(ctx);
    const session = sessionId
      ? await ctx.db.get("authSessions", sessionId)
      : null;
    if (
      !userId ||
      !session ||
      session.userId !== userId ||
      session.expirationTime <= Date.now() ||
      !(await ctx.db.get("users", userId))
    ) {
      throw new ConvexError(
        "Iniciá sesión para vincular Google a tu cuenta VISO.",
      );
    }
    const oldIntents = await ctx.db
      .query("socialLinkIntents")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId!))
      .collect();
    for (const record of oldIntents)
      await ctx.db.delete("socialLinkIntents", record._id);
    const oldPending = await ctx.db
      .query("socialPendingLinks")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId!))
      .collect();
    for (const record of oldPending) {
      // Invalidate previous attempts immediately; let the internal cleanup also
      // remove their matching verifier instead of leaving an orphan behind.
      await ctx.db.patch("socialPendingLinks", record._id, {
        expires: Date.now(),
      });
      await ctx.scheduler.runAfter(0, internal.social_auth.expirePending, {
        id: record._id,
      });
    }
    const createdAt = Date.now();
    const id = await ctx.db.insert("socialLinkIntents", {
      userId,
      sessionId: sessionId!,
      createdAt,
      expires: createdAt + INTENT_TTL,
    });
    await ctx.scheduler.runAfter(
      INTENT_TTL,
      internal.social_auth.expireIntent,
      { id },
    );
    return { prepared: true };
  },
});

export const expireIntent = internalMutation({
  args: { id: v.id("socialLinkIntents") },
  handler: async (ctx, { id }) => {
    const record = await ctx.db.get("socialLinkIntents", id);
    if (record && record.expires <= Date.now())
      await ctx.db.delete("socialLinkIntents", id);
  },
});

export const expirePending = internalMutation({
  args: { id: v.id("socialPendingLinks") },
  handler: async (ctx, { id }) => {
    const record = await ctx.db.get("socialPendingLinks", id);
    if (record && record.expires <= Date.now()) {
      await ctx.db.delete("socialPendingLinks", id);
      const verifier = await ctx.db.get("authVerifiers", record.verifierId);
      if (verifier?.signature === record.signature) {
        await ctx.db.delete("authVerifiers", verifier._id);
      }
    }
  },
});
