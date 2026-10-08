import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  getCurrentUserOrNull,
  requireCurrentUser,
} from "./lib/current_user.ts";
import { ensurePublicLink, regenerateSlug } from "./lib/public_links.ts";

// Slug del link público del usuario actual
export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return null;
    }
    const link = await ctx.db
      .query("publicLinks")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    return link ? link.slug : null;
  },
});

// Garantiza que el usuario tenga link público (las queries no pueden escribir)
export const ensureMine = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const link = await ensurePublicLink(ctx, user._id);
    return link.slug;
  },
});

export const regenerate = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const link = await ensurePublicLink(ctx, user._id);
    return await regenerateSlug(ctx, link);
  },
});

// Pública: expone solo lo necesario para mostrar el estado (sin ids ni correo)
export const getPublicStatus = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("publicLinks")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!link) {
      return { found: false as const };
    }
    const user = await ctx.db.get("users", link.userId);
    const status = user?.activeStatusId
      ? await ctx.db.get("statuses", user.activeStatusId)
      : null;
    const mediaUrl = status?.mediaStorageId
      ? await ctx.storage.getUrl(status.mediaStorageId)
      : null;
    return {
      found: true as const,
      ownerName: user?.name ?? null,
      volume: user?.displayVolume ?? 0,
      status: status
        ? {
            id: status._id,
            name: status.name,
            color: status.color,
            icon: status.icon,
            mediaUrl,
            mediaType: mediaUrl ? (status.mediaType ?? null) : null,
          }
        : null,
    };
  },
});
