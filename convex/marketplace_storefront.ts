import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireCurrentUser } from "./lib/current_user";
import { isMarketplaceAdmin } from "./marketplace";
import {
  DEFAULT_STOREFRONT,
  storefrontConfiguration,
  validateStorefront,
  type StorefrontMedia,
} from "./lib/marketplace_storefront";
import { marketplaceError } from "./lib/marketplace_validation";

export const get = query({
  args: {},
  handler: async (ctx) => {
    await requireCurrentUser(ctx);
    const row = await ctx.db
      .query("marketplaceStorefront")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .unique();
    const config = row?.configuration ?? DEFAULT_STOREFRONT;
    const media = async (m: StorefrontMedia | undefined) =>
      m
        ? {
            ...m,
            url: m.storageId
              ? await ctx.storage.getUrl(m.storageId)
              : (m.builtinPath ?? null),
          }
        : undefined;
    return {
      revision: row?.revision ?? 0,
      configuration: {
        ...config,
        slides: await Promise.all(
          config.slides.map(async (s) => ({
            ...s,
            media: await media(s.media),
          })),
        ),
        categories: await Promise.all(
          config.categories.map(async (c) => ({
            ...c,
            media: await media(c.media),
          })),
        ),
      },
    };
  },
});
export const save = mutation({
  args: {
    configuration: storefrontConfiguration,
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    if (!isMarketplaceAdmin(user._id))
      marketplaceError(
        "No tenés permiso para cambiar el diseño del marketplace.",
      );
    const configuration = validateStorefront(args.configuration);
    const existing = await ctx.db
      .query("marketplaceStorefront")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .unique();
    if (args.expectedRevision !== (existing?.revision ?? 0))
      marketplaceError(
        "El diseño cambió en otro dispositivo. Volvé a cargarlo antes de guardar.",
      );
    const retained = new Set(
      [
        ...(existing?.configuration.slides ?? []),
        ...(existing?.configuration.categories ?? []),
      ]
        .map((x) => x.media?.storageId)
        .filter(Boolean),
    );
    for (const m of [
      ...configuration.slides.map((s) => s.media),
      ...configuration.categories.map((c) => c.media),
    ]) {
      if (!m?.storageId) continue;
      const file = await ctx.db
        .query("marketplaceUploads")
        .withIndex("by_storage", (q) => q.eq("storageId", m.storageId!))
        .unique();
      if (
        !file ||
        !(await ctx.db.system.get("_storage", m.storageId)) ||
        (file.userId !== user._id && !retained.has(m.storageId)) ||
        file.mediaType !== m.mediaType
      )
        marketplaceError(
          "La imagen o video no pertenece a tu cuenta o no está disponible.",
        );
    }
    const revision = (existing?.revision ?? 0) + 1;
    const value = {
      configuration,
      revision,
      updatedBy: user._id,
      updatedAt: Date.now(),
    };
    if (existing)
      await ctx.db.patch("marketplaceStorefront", existing._id, value);
    else
      await ctx.db.insert("marketplaceStorefront", { key: "main", ...value });
    return revision;
  },
});
