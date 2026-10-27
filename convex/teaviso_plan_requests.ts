import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireCurrentUser } from "./lib/current_user";
import { enrollTeaviso } from "./lib/teaviso_accounts";
import { teavisoText } from "./lib/teaviso";
import { isTeavisoInterest } from "./lib/teaviso_offers";
import { isMarketplaceAdmin } from "./marketplace";

async function admin(ctx: QueryCtx | MutationCtx) {
  const user = await requireCurrentUser(ctx);
  if (!isMarketplaceAdmin(user._id))
    throw new ConvexError("No tenés permiso de administración.");
  return user;
}
export const request = mutation({
  args: { interest: v.string(), message: v.string(), requestKey: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    if (
      !isTeavisoInterest(args.interest) ||
      !/^[a-f0-9]{64}$/.test(args.requestKey)
    )
      throw new ConvexError("Elegí una opción válida y volvé a intentar.");
    const message = teavisoText(args.message, 1500, false);
    const previous = await ctx.db
      .query("teavisoPlanRequests")
      .withIndex("by_owner_key", (q) =>
        q.eq("ownerId", user._id).eq("requestKey", args.requestKey),
      )
      .unique();
    if (previous) {
      if (previous.interest !== args.interest || previous.message !== message)
        throw new ConvexError(
          "Esta solicitud ya tiene otros datos. Iniciá una nueva.",
        );
      return previous._id;
    }
    const open = await ctx.db
      .query("teavisoPlanRequests")
      .withIndex("by_owner_interest", (q) =>
        q.eq("ownerId", user._id).eq("interest", args.interest),
      )
      .order("desc")
      .take(20);
    const pending = open.find(
      (r) => r.status === "new" || r.status === "reviewing",
    );
    if (pending)
      throw new ConvexError(
        "Ya tenés una consulta pendiente para esta opción. Podés verla en Mis consultas.",
      );
    const now = Date.now();
    const recent = await ctx.db
      .query("teavisoPlanRequests")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .take(20);
    if (recent.filter((r) => r.createdAt > now - 86400000).length >= 5)
      throw new ConvexError(
        "Alcanzaste las consultas de hoy. Podés revisar las que ya enviaste.",
      );
    await enrollTeaviso(ctx, user._id);
    return ctx.db.insert("teavisoPlanRequests", {
      ownerId: user._id,
      interest: args.interest,
      message,
      requestKey: args.requestKey,
      status: "new",
      response: "",
      createdAt: now,
      updatedAt: now,
    });
  },
});
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    return ctx.db
      .query("teavisoPlanRequests")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .take(50);
  },
});
export const directory = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await admin(ctx);
    const result = await ctx.db
      .query("teavisoPlanRequests")
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (row) => {
          const user = await ctx.db.get("users", row.ownerId);
          return { ...row, email: user?.email ?? "", name: user?.name ?? "" };
        }),
      ),
    };
  },
});
export const respond = mutation({
  args: {
    id: v.id("teavisoPlanRequests"),
    expectedUpdatedAt: v.number(),
    response: v.string(),
    status: v.union(
      v.literal("reviewing"),
      v.literal("answered"),
      v.literal("closed"),
    ),
  },
  handler: async (ctx, args) => {
    const user = await admin(ctx),
      row = await ctx.db.get("teavisoPlanRequests", args.id);
    if (!row) throw new ConvexError("No encontramos la consulta.");
    if (row.updatedAt !== args.expectedUpdatedAt)
      throw new ConvexError(
        "La consulta cambió en otra ventana. Recargá antes de guardar.",
      );
    const response = teavisoText(
      args.response,
      2000,
      args.status === "answered",
    );
    const now = Math.max(Date.now(), row.updatedAt + 1);
    await ctx.db.patch("teavisoPlanRequests", row._id, {
      response,
      status: args.status,
      updatedAt: now,
    });
    await ctx.db.insert("teavisoAdminEvents", {
      actorId: user._id,
      ownerId: row.ownerId,
      targetId: row._id,
      action: "plan_request.updated",
      reason: `Estado: ${args.status}`,
      createdAt: now,
    });
  },
});
