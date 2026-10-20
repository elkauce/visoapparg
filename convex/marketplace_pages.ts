import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireCurrentUser } from "./lib/current_user";
import { MAX_PAGES } from "./lib/deck_keys";
import { initializeDeckCatalogue } from "./lib/deck_catalogue";
import { BUILTIN_MARKETPLACE_PRODUCTS } from "./lib/marketplace_catalog";
import {
  MARKETPLACE_PAGE_KINDS,
  normalizeMarketplacePageSettings,
} from "./lib/marketplace_page_templates";

/** Installs the acquired version, never a seller's subsequent unpublished edit. */
export const installPage = mutation({
  args: { productId: v.string(), updateExisting: v.optional(v.boolean()) },
  handler: async (ctx, { productId, updateExisting }) => {
    const user = await requireCurrentUser(ctx);
    const entry = await ctx.db
      .query("marketplaceLibrary")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", user._id).eq("productId", productId),
      )
      .unique();
    if (!entry || entry.delivery !== "page" || !entry.pageTemplate)
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Agregá esta página a tu biblioteca antes de instalarla.",
      });
    await initializeDeckCatalogue(ctx, user);
    const pages = await ctx.db
      .query("deckPages")
      .withIndex("by_user_and_order", (q) => q.eq("userId", user._id))
      .take(MAX_PAGES);
    const kind = MARKETPLACE_PAGE_KINDS[entry.pageTemplate];
    const settings = normalizeMarketplacePageSettings(
      entry.pageTemplate,
      entry.pageSettings,
    );
    const keepOrUpdate = async (page: (typeof pages)[number]) => {
      if (updateExisting) {
        await ctx.db.patch("deckPages", page._id, {
          kind,
          marketplaceProductId: productId,
          marketplaceVersion: String(entry.revision ?? 1),
          screenSettings: settings?.screenSettings,
          standbySettings: settings?.standbySettings,
        });
        return { pageId: page._id, existing: true, updated: true };
      }
      if (!page.marketplaceProductId)
        await ctx.db.patch("deckPages", page._id, { marketplaceProductId: productId });
      return { pageId: page._id, existing: true };
    };
    const installed = pages.find(
      (page) => page.marketplaceProductId === productId,
    );
    if (installed) return keepOrUpdate(installed);
    // Reuse a user's earlier VISO page without replacing its edited settings.
    // A creator's configured variant is a different product and installs apart.
    const firstParty = BUILTIN_MARKETPLACE_PRODUCTS.some(
      (product) => product.id === productId && product.pageTemplate,
    );
    const legacy = firstParty
      ? pages.find((page) => !page.marketplaceProductId && page.kind === kind)
      : undefined;
    if (legacy) return keepOrUpdate(legacy);
    if (pages.length >= MAX_PAGES)
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `Tu deck admite hasta ${MAX_PAGES} páginas. Quitá una para agregar otra.`,
      });
    const pageId = await ctx.db.insert("deckPages", {
      userId: user._id,
      name: entry.title.trim().slice(0, 20) || "Página",
      order: (pages[pages.length - 1]?.order ?? -1) + 1,
      kind,
      marketplaceProductId: productId,
      marketplaceVersion: String(entry.revision ?? 1),
      ...(settings?.screenSettings
        ? { screenSettings: settings.screenSettings }
        : {}),
      ...(settings?.standbySettings
        ? { standbySettings: settings.standbySettings }
        : {}),
    });
    return { pageId, existing: false };
  },
});
