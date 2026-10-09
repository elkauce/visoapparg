import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";
import {
  getCurrentUserOrNull,
  requireCurrentUser,
} from "./lib/current_user.ts";
import { getOwnedStatus } from "./lib/owned_status.ts";
import { getDeckMedia } from "./lib/deck_appearance.ts";
import { contentTargetsStatus, deleteDanglingKeys } from "./lib/deck_keys.ts";
import { setActiveStatus } from "./lib/activate_status.ts";
import { validateLight, validateWebhookUrl } from "./lib/light_validation.ts";

const lightValidator = v.object({
  on: v.boolean(),
  brightness: v.number(),
  temperature: v.number(),
});

const MAX_STATUSES = 24;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const DEFAULT_STATUSES = [
  { name: "Libre", color: "#22c55e", icon: "check-circle" },
  { name: "Ocupado", color: "#ef4444", icon: "ban" },
  { name: "En reunión", color: "#f59e0b", icon: "users" },
  { name: "En llamada", color: "#8b5cf6", icon: "phone" },
  { name: "Almuerzo", color: "#0ea5e9", icon: "utensils" },
  { name: "Ausente", color: "#64748b", icon: "moon" },
];

function validateFields(name: string, color: string): string {
  const cleanName = name.trim();
  if (cleanName.length === 0 || cleanName.length > 30) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "El nombre debe tener entre 1 y 30 caracteres",
    });
  }
  if (!HEX_COLOR.test(color)) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Color inválido",
    });
  }
  return cleanName;
}

async function nextOrder(ctx: MutationCtx, userId: Id<"users">) {
  const last = await ctx.db
    .query("statuses")
    .withIndex("by_user_and_order", (q) => q.eq("userId", userId))
    .order("desc")
    .first();
  return last ? last.order + 1 : 0;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return null;
    }
    const statuses = await ctx.db
      .query("statuses")
      .withIndex("by_user_and_order", (q) => q.eq("userId", user._id))
      .take(MAX_STATUSES);
    // Reemplazamos el id interno del archivo por una URL que el navegador pueda mostrar
    const withMedia = await Promise.all(
      statuses.map(async (status) => ({
        ...status,
        mediaUrl: status.mediaStorageId
          ? await ctx.storage.getUrl(status.mediaStorageId)
          : null,
      })),
    );
    return { statuses: withMedia, activeStatusId: user.activeStatusId ?? null };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    color: v.string(),
    icon: v.string(),
    light: v.optional(v.union(v.null(), lightValidator)),
    webhookUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const name = validateFields(args.name, args.color);
    if (args.light) {
      validateLight(args.light);
    }
    const existing = await ctx.db
      .query("statuses")
      .withIndex("by_user_and_order", (q) => q.eq("userId", user._id))
      .take(MAX_STATUSES);
    if (existing.length >= MAX_STATUSES) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `Máximo ${MAX_STATUSES} estados`,
      });
    }
    return await ctx.db.insert("statuses", {
      userId: user._id,
      name,
      color: args.color,
      icon: args.icon,
      light: args.light ?? undefined,
      webhookUrl: validateWebhookUrl(args.webhookUrl ?? ""),
      order: await nextOrder(ctx, user._id),
    });
  },
});

export const createDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const existing = await ctx.db
      .query("statuses")
      .withIndex("by_user_and_order", (q) => q.eq("userId", user._id))
      .first();
    if (existing) {
      return null;
    }
    let firstId: Id<"statuses"> | null = null;
    for (const [order, status] of DEFAULT_STATUSES.entries()) {
      const id = await ctx.db.insert("statuses", {
        userId: user._id,
        order,
        ...status,
      });
      firstId = firstId ?? id;
    }
    if (firstId) {
      await ctx.db.patch("users", user._id, { activeStatusId: firstId });
    }
    return null;
  },
});

export const update = mutation({
  args: {
    statusId: v.id("statuses"),
    name: v.string(),
    color: v.string(),
    icon: v.string(),
    // null o ausente = sin control de luz
    light: v.optional(v.union(v.null(), lightValidator)),
    // vacío o ausente = sin webhook
    webhookUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    await getOwnedStatus(ctx, user._id, args.statusId);
    const name = validateFields(args.name, args.color);
    if (args.light) {
      validateLight(args.light);
    }
    await ctx.db.patch("statuses", args.statusId, {
      name,
      color: args.color,
      icon: args.icon,
      light: args.light ?? undefined,
      webhookUrl: validateWebhookUrl(args.webhookUrl ?? ""),
    });
    return null;
  },
});

export const remove = mutation({
  args: { statusId: v.id("statuses") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const status = await getOwnedStatus(ctx, user._id, args.statusId);
    if (user.activeStatusId === args.statusId) {
      await ctx.db.patch("users", user._id, { activeStatusId: undefined });
    }
    if (
      status.mediaStorageId &&
      !(await getDeckMedia(ctx, status.mediaStorageId))
    ) {
      await ctx.storage.delete(status.mediaStorageId);
    }
    await deleteDanglingKeys(ctx, user._id, (content) =>
      contentTargetsStatus(content, args.statusId),
    );
    await ctx.db.delete("statuses", args.statusId);
    return null;
  },
});

// Intercambia el orden con el vecino (direction -1 = izquierda, 1 = derecha)
export const move = mutation({
  args: {
    statusId: v.id("statuses"),
    direction: v.union(v.literal(-1), v.literal(1)),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const status = await getOwnedStatus(ctx, user._id, args.statusId);
    const all = await ctx.db
      .query("statuses")
      .withIndex("by_user_and_order", (q) => q.eq("userId", user._id))
      .take(MAX_STATUSES);
    const index = all.findIndex((s) => s._id === status._id);
    const neighbor = all[index + args.direction];
    if (!neighbor) {
      return null;
    }
    await ctx.db.patch("statuses", status._id, { order: neighbor.order });
    await ctx.db.patch("statuses", neighbor._id, { order: status.order });
    return null;
  },
});

export const setActive = mutation({
  args: { statusId: v.union(v.id("statuses"), v.null()) },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    if (args.statusId !== null) {
      await getOwnedStatus(ctx, user._id, args.statusId);
    }
    await setActiveStatus(ctx, user._id, args.statusId);
    return null;
  },
});
