import type { QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireCurrentUser } from "./lib/current_user";
import { publishedProductFor } from "./marketplace";
import { marketplaceError } from "./lib/marketplace_validation";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const row = await ctx.db
      .query("marketplaceShopping")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    return {
      cart: await Promise.all(
        (row?.cart ?? []).map(async (productId) => ({
          productId,
          product: await publishedProductFor(ctx, user._id, productId),
        })),
      ),
      saved: row?.saved ?? [],
      following: row?.following ?? [],
    };
  },
});
export const set = mutation({
  args: {
    productId: v.string(),
    collection: v.union(v.literal("cart"), v.literal("saved")),
    present: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    if (args.productId.length > 160) marketplaceError("Producto no válido.");
    const row = await ctx.db
      .query("marketplaceShopping")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    const items = row?.[args.collection] ?? [];
    if (args.present && !items.includes(args.productId)) {
      const product = await publishedProductFor(ctx, user._id, args.productId);
      if (!product) marketplaceError("Este producto ya no está disponible.");
      if (args.collection === "cart" && product.priceMode === "info")
        marketplaceError("Este producto todavía no está a la venta.");
      if (items.length >= (args.collection === "cart" ? 40 : 100))
        marketplaceError(
          "Tu colección está completa. Quitá un producto para agregar otro.",
        );
    }
    const updated = args.present
      ? [...new Set([...items, args.productId])]
      : items.filter((id) => id !== args.productId);
    const values = {
      cart: row?.cart ?? [],
      saved: row?.saved ?? [],
      [args.collection]: updated,
      updatedAt: Date.now(),
    };
    if (row) await ctx.db.patch("marketplaceShopping", row._id, values);
    else
      await ctx.db.insert("marketplaceShopping", {
        userId: user._id,
        ...values,
      });
    return null;
  },
});
async function publicCreator(ctx: QueryCtx | MutationCtx, creatorId: string) {
  if (creatorId === "viso")
    return {
      id: "viso",
      displayName: "VISO",
      bio: "Recursos originales para tu espacio conectado.",
      website: undefined,
      official: true,
    };
  if (creatorId.length > 160) return null;
  const id = ctx.db.normalizeId("creatorProfiles", creatorId);
  const profile = id ? await ctx.db.get("creatorProfiles", id) : null;
  if (!profile || profile.status !== "approved") return null;
  return {
    id: profile._id,
    displayName: profile.displayName,
    bio: profile.bio,
    website: profile.website,
    official: false,
  };
}
export const creator = query({
  args: { creatorId: v.string() },
  handler: async (ctx, { creatorId }) => {
    await requireCurrentUser(ctx);
    return publicCreator(ctx, creatorId);
  },
});
export const follow = mutation({
  args: { creatorId: v.string(), present: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const row = await ctx.db
      .query("marketplaceShopping")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    const ids = row?.following ?? [];
    if (args.creatorId.length > 160) marketplaceError("Tienda no válida.");
    if (args.present && !ids.includes(args.creatorId)) {
      if (!(await publicCreator(ctx, args.creatorId)))
        marketplaceError("Esta tienda no está disponible.");
      if (ids.length >= 50) marketplaceError("Podés seguir hasta 50 tiendas.");
    }
    const following = args.present
      ? [...new Set([...ids, args.creatorId])]
      : ids.filter((id) => id !== args.creatorId);
    if (row)
      await ctx.db.patch("marketplaceShopping", row._id, {
        following,
        updatedAt: Date.now(),
      });
    else
      await ctx.db.insert("marketplaceShopping", {
        userId: user._id,
        cart: [],
        saved: [],
        following,
        updatedAt: Date.now(),
      });
    return null;
  },
});
export const following = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const row = await ctx.db
      .query("marketplaceShopping")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    return Promise.all(
      (row?.following ?? []).map(async (creatorId) => ({
        creatorId,
        creator: await publicCreator(ctx, creatorId),
      })),
    );
  },
});

export const creators = query({
  args: {},
  handler: async (ctx) => {
    await requireCurrentUser(ctx);
    const rows = await ctx.db
      .query("creatorProfiles")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .take(100);
    return [
      {
        id: "viso",
        displayName: "VISO",
        bio: "Recursos originales para tu espacio conectado.",
        official: true,
      },
      ...rows.map((p) => ({
        id: p._id,
        displayName: p.displayName,
        bio: p.bio,
        official: false,
      })),
    ];
  },
});
