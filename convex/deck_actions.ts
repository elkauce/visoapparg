import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireCurrentUser } from "./lib/current_user.ts";
import { getOwnedStatus } from "./lib/owned_status.ts";
import { setActiveStatus } from "./lib/activate_status.ts";

const RECEIPT_LIFETIME_MS = 24 * 60 * 60 * 1000;
const MAX_RECEIPTS_PER_DAY = 2048;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Pulsación autenticada: el mismo requestId reintentado no repite los webhooks.
// Un usuario puede repetir ids de otro sin obtener acceso a su estado.
export const activateStatus = mutation({
  args: {
    statusId: v.union(v.id("statuses"), v.null()),
    requestId: v.string(),
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    if (!UUID.test(args.requestId) || !UUID.test(args.deviceId)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Identificador de acción o dispositivo inválido",
      });
    }
    const fingerprint = JSON.stringify({
      statusId: args.statusId,
      deviceId: args.deviceId,
    });
    const previous = await ctx.db
      .query("deckActionRequests")
      .withIndex("by_user_and_request", (q) =>
        q.eq("userId", user._id).eq("requestId", args.requestId),
      )
      .unique();
    if (previous && previous.completedAt > Date.now() - RECEIPT_LIFETIME_MS) {
      if (previous.fingerprint !== fingerprint) {
        throw new ConvexError({
          code: "CONFLICT",
          message: "El identificador ya corresponde a otra acción",
        });
      }
      return { ok: true as const, duplicate: true, requestId: args.requestId };
    }
    if (args.statusId !== null)
      await getOwnedStatus(ctx, user._id, args.statusId);
    const receipts = await ctx.db
      .query("deckActionRequests")
      .withIndex("by_user_and_time", (q) => q.eq("userId", user._id))
      .take(MAX_RECEIPTS_PER_DAY + 1);
    let retained = 0;
    for (const receipt of receipts) {
      if (receipt.completedAt <= Date.now() - RECEIPT_LIFETIME_MS) {
        await ctx.db.delete("deckActionRequests", receipt._id);
      } else retained++;
    }
    if (retained >= MAX_RECEIPTS_PER_DAY) {
      throw new ConvexError({
        code: "RATE_LIMITED",
        message: "Demasiadas acciones; vuelve a intentarlo más tarde",
      });
    }
    await setActiveStatus(ctx, user._id, args.statusId);
    await ctx.db.insert("deckActionRequests", {
      userId: user._id,
      requestId: args.requestId,
      deviceId: args.deviceId,
      fingerprint,
      completedAt: Date.now(),
    });
    return { ok: true as const, duplicate: false, requestId: args.requestId };
  },
});

// Automatic presence may change/restore a state only while the user has not intervened.
export const activateAutomaticStatus = mutation({
  args: {
    accountId: v.id("users"),
    statusId: v.union(v.id("statuses"), v.null()),
    expectedRevision: v.number(),
    requestId: v.string(),
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    if (
      user._id !== args.accountId ||
      !UUID.test(args.requestId) ||
      !UUID.test(args.deviceId) ||
      !Number.isSafeInteger(args.expectedRevision) ||
      args.expectedRevision < 0
    )
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Solicitud automática inválida.",
      });
    const fingerprint = JSON.stringify({
      automatic: true,
      statusId: args.statusId,
      deviceId: args.deviceId,
      expectedRevision: args.expectedRevision,
    });
    const previous = await ctx.db
      .query("deckActionRequests")
      .withIndex("by_user_and_request", (q) =>
        q.eq("userId", user._id).eq("requestId", args.requestId),
      )
      .unique();
    if (previous && previous.completedAt > Date.now() - RECEIPT_LIFETIME_MS) {
      if (previous.fingerprint !== fingerprint)
        throw new ConvexError({
          code: "CONFLICT",
          message: "La solicitud ya corresponde a otra acción.",
        });
      return { applied: true, revision: args.expectedRevision + 1 };
    }
    if (args.statusId !== null)
      await getOwnedStatus(ctx, user._id, args.statusId);
    if ((user.activeStatusRevision ?? 0) !== args.expectedRevision)
      return { applied: false, revision: user.activeStatusRevision ?? 0 };
    const receipts = await ctx.db
      .query("deckActionRequests")
      .withIndex("by_user_and_time", (q) => q.eq("userId", user._id))
      .take(MAX_RECEIPTS_PER_DAY + 1);
    let retained = 0;
    for (const receipt of receipts) {
      if (receipt.completedAt <= Date.now() - RECEIPT_LIFETIME_MS)
        await ctx.db.delete("deckActionRequests", receipt._id);
      else retained++;
    }
    if (retained >= MAX_RECEIPTS_PER_DAY)
      throw new ConvexError({
        code: "RATE_LIMITED",
        message: "Demasiadas acciones automáticas.",
      });
    await setActiveStatus(ctx, user._id, args.statusId);
    await ctx.db.insert("deckActionRequests", {
      userId: user._id,
      requestId: args.requestId,
      deviceId: args.deviceId,
      fingerprint,
      completedAt: Date.now(),
    });
    return { applied: true, revision: args.expectedRevision + 1 };
  },
});

export const getAutomaticReceipt = query({
  args: { accountId: v.id("users"), requestId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    if (user._id !== args.accountId || !UUID.test(args.requestId))
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Solicitud automática inválida.",
      });
    const receipt = await ctx.db
      .query("deckActionRequests")
      .withIndex("by_user_and_request", (q) =>
        q.eq("userId", user._id).eq("requestId", args.requestId),
      )
      .unique();
    if (!receipt || receipt.completedAt <= Date.now() - RECEIPT_LIFETIME_MS)
      return null;
    const saved = JSON.parse(receipt.fingerprint);
    if (saved.automatic !== true) return null;
    return {
      applied: true as const,
      statusId: saved.statusId as Id<"statuses"> | null,
      revision: (saved.expectedRevision as number) + 1,
    };
  },
});
