import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { marketplaceError } from "./lib/marketplace_validation";
import { importAffiliateProduct } from "./lib/marketplace_affiliate_import";

// Import only produces a candidate. It never publishes or modifies the product.
// The editor must explicitly choose which fields to apply and then save a draft.
export const previewAffiliate = action({
  args: { affiliateUrl: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.runQuery(api.marketplace.session, {});
    if (!session.isAdmin) marketplaceError("Sólo el administrador puede importar enlaces de afiliado de VISO.");
    try {
      return await importAffiliateProduct(args.affiliateUrl, { accessToken: process.env.MERCADOLIBRE_ACCESS_TOKEN });
    } catch (error) {
      marketplaceError(error instanceof Error ? error.message : "No se pudo preparar la importación.");
    }
  },
});
