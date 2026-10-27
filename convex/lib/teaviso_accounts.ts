import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function teavisoProfile(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
) {
  return ctx.db
    .query("teavisoAccounts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

export async function enrollTeaviso(ctx: MutationCtx, userId: Id<"users">) {
  const existing = await teavisoProfile(ctx, userId);
  if (existing) return existing._id;
  const user = await ctx.db.get("users", userId);
  if (!user) return null;
  const now = Date.now();
  return ctx.db.insert("teavisoAccounts", {
    userId,
    name: user.name ?? "",
    contactPhone: "",
    searchText: `${user.name ?? ""} ${user.email ?? ""}`.toLowerCase(),
    createdAt: now,
    updatedAt: now,
  });
}

export async function hasVisoDeck(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
) {
  const page = await ctx.db
    .query("deckPages")
    .withIndex("by_user_and_order", (q) => q.eq("userId", userId))
    .first();
  if (page) return true;
  const licenses = await ctx.db
    .query("timbreLicenses")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .collect();
  const now = Date.now();
  return licenses.some(
    (l) =>
      l.source === "hardware_bundle" &&
      l.status === "active" &&
      !l.revokedAt &&
      l.startsAt <= now &&
      (!l.expiresAt || l.expiresAt > now),
  );
}
