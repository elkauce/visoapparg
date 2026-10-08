import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUserOrNull, requireCurrentUser } from "./lib/current_user.ts";
import { deckKeyContent } from "./lib/deck_key_content.ts";
import {
  cleanLabel,
  deleteDanglingKeys,
  getOwnedPage,
  MAX_KEYS,
  MAX_PAGES,
  SLOTS_PER_PAGE,
  validateKeyContent,
} from "./lib/deck_keys.ts";

// Páginas y teclas del usuario actual (null si no hay sesión)
export const get = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return null;
    }
    const pages = await ctx.db
      .query("deckPages")
      .withIndex("by_user_and_order", (q) => q.eq("userId", user._id))
      .take(MAX_PAGES);
    const keys = await ctx.db
      .query("deckKeys")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(MAX_KEYS);
    return { pages, keys, volume: user.displayVolume ?? 0 };
  },
});

// Primera vez: crea la página "Principal" con tus estados y una tecla para apagar
export const ensureDefault = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const existing = await ctx.db
      .query("deckPages")
      .withIndex("by_user_and_order", (q) => q.eq("userId", user._id))
      .first();
    if (existing) {
      return null;
    }
    const pageId = await ctx.db.insert("deckPages", {
      userId: user._id,
      name: "Principal",
      order: 0,
    });
    const statuses = await ctx.db
      .query("statuses")
      .withIndex("by_user_and_order", (q) => q.eq("userId", user._id))
      .take(SLOTS_PER_PAGE - 1);
    let position = 0;
    for (const status of statuses) {
      await ctx.db.insert("deckKeys", {
        userId: user._id,
        pageId,
        position: position++,
        content: { kind: "status", statusId: status._id },
      });
    }
    await ctx.db.insert("deckKeys", {
      userId: user._id,
      pageId,
      position,
      content: { kind: "off" },
    });
    return null;
  },
});

export const createPage = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const pages = await ctx.db
      .query("deckPages")
      .withIndex("by_user_and_order", (q) => q.eq("userId", user._id))
      .take(MAX_PAGES);
    if (pages.length >= MAX_PAGES) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `Máximo ${MAX_PAGES} páginas`,
      });
    }
    const last = pages[pages.length - 1];
    return await ctx.db.insert("deckPages", {
      userId: user._id,
      name: cleanLabel(args.name, 20),
      order: last ? last.order + 1 : 0,
    });
  },
});

export const renamePage = mutation({
  args: { pageId: v.id("deckPages"), name: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    await getOwnedPage(ctx, user._id, args.pageId);
    await ctx.db.patch("deckPages", args.pageId, {
      name: cleanLabel(args.name, 20),
    });
    return null;
  },
});

export const removePage = mutation({
  args: { pageId: v.id("deckPages") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    await getOwnedPage(ctx, user._id, args.pageId);
    const pages = await ctx.db
      .query("deckPages")
      .withIndex("by_user_and_order", (q) => q.eq("userId", user._id))
      .take(MAX_PAGES);
    if (pages.length <= 1) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Debe quedar al menos una página",
      });
    }
    // Borra las teclas de la página y las carpetas que llevaban a ella
    await deleteDanglingKeys(
      ctx,
      user._id,
      (content) => content.kind === "folder" && content.targetPageId === args.pageId,
    );
    const keys = await ctx.db
      .query("deckKeys")
      .withIndex("by_page_and_position", (q) => q.eq("pageId", args.pageId))
      .take(SLOTS_PER_PAGE);
    for (const key of keys) {
      await ctx.db.delete("deckKeys", key._id);
    }
    await ctx.db.delete("deckPages", args.pageId);
    return null;
  },
});

// Coloca (o reemplaza) la tecla de una posición
export const setKey = mutation({
  args: {
    pageId: v.id("deckPages"),
    position: v.number(),
    content: deckKeyContent,
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    await getOwnedPage(ctx, user._id, args.pageId);
    if (
      !Number.isInteger(args.position) ||
      args.position < 0 ||
      args.position >= SLOTS_PER_PAGE
    ) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Posición inválida" });
    }
    if (args.content.kind === "folder" && args.content.targetPageId === args.pageId) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Una carpeta no puede llevar a su propia página",
      });
    }
    const content = await validateKeyContent(ctx, user._id, args.content);
    const existing = await ctx.db
      .query("deckKeys")
      .withIndex("by_page_and_position", (q) =>
        q.eq("pageId", args.pageId).eq("position", args.position),
      )
      .first();
    if (existing) {
      await ctx.db.patch("deckKeys", existing._id, { content });
    } else {
      await ctx.db.insert("deckKeys", {
        userId: user._id,
        pageId: args.pageId,
        position: args.position,
        content,
      });
    }
    return null;
  },
});

export const removeKey = mutation({
  args: { keyId: v.id("deckKeys") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const key = await ctx.db.get("deckKeys", args.keyId);
    if (!key || key.userId !== user._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Tecla no encontrada" });
    }
    await ctx.db.delete("deckKeys", args.keyId);
    return null;
  },
});
