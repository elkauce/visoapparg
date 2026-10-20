import { ConvexError, v, type Infer } from "convex/values";
import { action, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { requireCurrentUser } from "./lib/current_user";
import { BUILTIN_MARKETPLACE_PRODUCTS } from "./lib/marketplace_catalog";
import {
  cleanMarketText,
  marketExternalUrl,
  marketplaceCategory,
  marketplaceDetails,
  marketplaceChangelog,
  marketplaceImportSource,
  marketplacePageTemplate,
  marketplacePageSettings,
  marketplaceProductFields,
  marketplaceError,
  marketplaceMediaType,
  marketplacePriceMode,
  MAX_MARKETPLACE_ASSETS,
  MAX_MARKETPLACE_LIBRARY,
} from "./lib/marketplace_validation";
import { safeMarketplaceMediaUrl } from "./lib/marketplace_affiliate_urls";
import { normalizeMarketplacePageSettings } from "./lib/marketplace_page_templates";
import { MAX_PAGES } from "./lib/deck_keys";
import { findVisoStatus, VISO_STATES } from "./lib/viso_preset_states";

type ReadCtx = QueryCtx | MutationCtx;
type LibraryAsset = Doc<"marketplaceLibrary">["assets"][number];
const categoryArg = v.optional(marketplaceCategory);
const contentValidator = v.object(marketplaceProductFields);
type ProductContent = Infer<typeof contentValidator>;
const assetInput = v.object({
  name: v.string(),
  storageId: v.optional(v.id("_storage")),
  id: v.optional(v.string()),
  builtinPath: v.optional(v.string()),
  mediaType: marketplaceMediaType,
});

// The deployment grants immutable user IDs. Email text supplied by a client,
// a users row, or an unverified password account never grants administrator.
export function isMarketplaceAdmin(userId: string): boolean {
  return (process.env.MARKETPLACE_ADMIN_USER_IDS ?? "")
    .split(/[,\s]+/)
    .filter(Boolean)
    .includes(userId);
}
async function requireAdmin(ctx: ReadCtx) {
  const user = await requireCurrentUser(ctx);
  if (!isMarketplaceAdmin(user._id))
    marketplaceError("No tenés permiso para administrar el marketplace.");
  return user;
}
async function creatorFor(ctx: ReadCtx, userId: Id<"users">) {
  return ctx.db
    .query("creatorProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}
async function libraryFor(
  ctx: ReadCtx,
  userId: Id<"users">,
  productId: string,
) {
  return ctx.db
    .query("marketplaceLibrary")
    .withIndex("by_user_product", (q) =>
      q.eq("userId", userId).eq("productId", productId),
    )
    .unique();
}
async function dbProduct(ctx: ReadCtx, productId: string) {
  const id = ctx.db.normalizeId("marketplaceProducts", productId);
  return id
    ? ctx.db.get("marketplaceProducts", id)
    : ctx.db
        .query("marketplaceProducts")
        .withIndex("by_builtin", (q) => q.eq("builtinId", productId))
        .unique();
}
async function ownedProduct(
  ctx: ReadCtx,
  productId: string,
  userId: Id<"users">,
) {
  const product = await dbProduct(ctx, productId);
  if (!product || (product.userId !== userId && !isMarketplaceAdmin(userId)))
    marketplaceError("Producto no encontrado.");
  return product;
}
async function resolveAssets(ctx: ReadCtx, assets: readonly LibraryAsset[]) {
  return Promise.all(
    assets.map(async (asset) => ({
      ...asset,
      ...(asset.storageId
        ? { url: await ctx.storage.getUrl(asset.storageId) }
        : {}),
    })),
  );
}
function builtin(id: string) {
  return BUILTIN_MARKETPLACE_PRODUCTS.find((product) => product.id === id);
}
function productContent(product: ProductContent): ProductContent {
  return Object.fromEntries(
    Object.keys(marketplaceProductFields).map((key) => [
      key,
      product[key as keyof ProductContent],
    ]),
  ) as ProductContent;
}
function builtinContent(
  product: (typeof BUILTIN_MARKETPLACE_PRODUCTS)[number],
): ProductContent {
  return {
    creatorName: product.creatorName,
    title: product.title,
    description: product.description,
    category: product.category,
    condition: product.condition,
    coverPath: product.coverPath,
    priceMode: product.priceMode,
    priceAmount: product.priceAmount,
    currency: product.currency,
    delivery: product.delivery,
    externalUrl: product.externalUrl,
    affiliate: false,
    assets: product.assets.map(({ id, name, mediaType, builtinPath }) => ({
      id,
      name,
      mediaType,
      builtinPath,
    })),
    gallery: product.gallery,
    details: product.details,
    changelog: product.changelog,
    pageTemplate: product.pageTemplate,
    pageSettings: product.pageSettings,
    profileTemplate: product.profileTemplate,
  };
}
async function resolveGallery(ctx: ReadCtx, content: ProductContent) {
  const gallery = content.gallery?.length
    ? content.gallery
    : content.coverStorageId
      ? [
          {
            id: content.coverStorageId,
            name: content.title,
            mediaType: "image" as const,
            storageId: content.coverStorageId,
          },
        ]
      : content.coverPath
        ? [
            {
              id: "cover",
              name: content.title,
              mediaType: "image" as const,
              builtinPath: content.coverPath,
            },
          ]
        : [];
  return Promise.all(
    gallery.map(async (item) => ({
      ...item,
      url: item.storageId
        ? await ctx.storage.getUrl(item.storageId)
        : (item.externalUrl ?? item.builtinPath ?? null),
    })),
  );
}
async function publicProduct(
  ctx: ReadCtx,
  product: Doc<"marketplaceProducts">,
  userId: Id<"users">,
  includeAssets = false,
  editing = false,
) {
  const owner = product.userId === userId || isMarketplaceAdmin(userId);
  const content =
    owner && editing && product.draft ? product.draft : productContent(product);
  const id = product.builtinId ?? product._id;
  const acquired = await libraryFor(ctx, userId, id);
  return {
    id,
    title: content.title,
    description: content.description,
    category: content.category,
    condition: content.condition,
    creatorName: content.creatorName,
    coverUrl: content.coverStorageId
      ? await ctx.storage.getUrl(content.coverStorageId)
      : (content.coverPath ?? null),
    coverStorageId: owner ? content.coverStorageId : undefined,
    coverPath: owner ? content.coverPath : undefined,
    priceMode: content.priceMode,
    priceAmount: content.priceAmount,
    currency: content.currency,
    delivery: content.delivery,
    externalUrl: content.externalUrl,
    affiliate: content.affiliate,
    status:
      editing && product.draft
        ? (product.draftStatus ?? "draft")
        : product.status,
    builtin: !!product.builtinId,
    assetCount: content.assets.length,
    acquired: !!acquired,
    owned: owner,
    canEdit: owner,
    reviewReason: owner
      ? (product.draftReviewReason ?? product.reviewReason)
      : undefined,
    hasDraft: owner && !!product.draft,
    draftStatus: owner ? product.draftStatus : undefined,
    updatedAt: product.updatedAt,
    revision: product.revision ?? 1,
    gallery: await resolveGallery(ctx, content),
    details: content.details,
    changelog: content.changelog,
    pageTemplate: content.pageTemplate,
    pageSettings: owner ? content.pageSettings : acquired?.pageSettings,
    profileTemplate: content.profileTemplate,
    importSource: owner ? content.importSource : undefined,
    assets:
      includeAssets && owner ? await resolveAssets(ctx, content.assets) : [],
  };
}
async function publicBuiltin(
  ctx: ReadCtx,
  product: (typeof BUILTIN_MARKETPLACE_PRODUCTS)[number],
  userId: Id<"users">,
) {
  const content = builtinContent(product);
  const acquired = await libraryFor(ctx, userId, product.id);
  const admin = isMarketplaceAdmin(userId);
  return {
    id: product.id,
    title: content.title,
    description: content.description,
    category: content.category,
    condition: content.condition,
    creatorName: content.creatorName,
    coverUrl: content.coverPath,
    priceMode: content.priceMode,
    priceAmount: content.priceAmount,
    currency: content.currency,
    delivery: content.delivery,
    externalUrl: content.externalUrl,
    affiliate: false,
    status:
      product.priceMode === "info"
        ? ("draft" as const)
        : ("published" as const),
    builtin: true,
    assetCount: content.assets.length,
    acquired: !!acquired,
    owned: admin,
    canEdit: admin,
    coverStorageId: undefined,
    coverPath: admin ? content.coverPath : undefined,
    updatedAt: 0,
    revision: 1,
    reviewReason: undefined,
    hasDraft: false,
    draftStatus: undefined,
    gallery: await resolveGallery(ctx, content),
    details: content.details,
    changelog: content.changelog,
    pageTemplate: content.pageTemplate,
    pageSettings: undefined,
    profileTemplate: content.profileTemplate,
    importSource: undefined,
    assets: admin
      ? await resolveAssets(ctx, content.assets)
      : acquired
        ? await resolveAssets(ctx, acquired.assets)
        : [],
  };
}
function matchesCategory(
  product: { category: string; condition?: string },
  category: string | undefined,
) {
  if (!category) return true;
  if (category === "hardware")
    return ["hardware", "new", "used"].includes(product.category);
  if (category === "new" || category === "used")
    return (
      product.category === category ||
      (product.category === "hardware" && product.condition === category)
    );
  return product.category === category;
}

export const session = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    return {
      isAdmin: isMarketplaceAdmin(user._id),
      creator: await creatorFor(ctx, user._id),
      checkoutEnabled: false as const,
    };
  },
});

export const list = query({
  args: { category: categoryArg, search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const search = (args.search ?? "")
      .trim()
      .slice(0, 120)
      .toLocaleLowerCase("es");
    const records = await ctx.db.query("marketplaceProducts").take(500);
    const overrides = new Map(
      records.filter((p) => p.builtinId).map((p) => [p.builtinId!, p]),
    );
    const products = [
      ...(await Promise.all(
        BUILTIN_MARKETPLACE_PRODUCTS.map(async (item) => {
          const override = overrides.get(item.id);
          if (override?.status === "published")
            return publicProduct(ctx, override, user._id);
          if (override || item.priceMode === "info") return null;
          return publicBuiltin(ctx, item, user._id);
        }),
      )),
      ...(await Promise.all(
        records
          .filter((p) => !p.builtinId && p.status === "published")
          .map((p) => publicProduct(ctx, p, user._id)),
      )),
    ];
    return products
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .filter(
        (item) =>
          matchesCategory(item, args.category) &&
          (!search ||
            `${item.title} ${item.description} ${item.creatorName}`
              .toLocaleLowerCase("es")
              .includes(search)),
      );
  },
});
export const get = query({
  args: { productId: v.string(), editing: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const product = await dbProduct(ctx, args.productId);
    const firstParty = builtin(args.productId);
    if (product) {
      const owner = product.userId === user._id || isMarketplaceAdmin(user._id);
      if (product.status === "published" || owner)
        return publicProduct(
          ctx,
          product,
          user._id,
          true,
          args.editing ?? product.status !== "published",
        );
      return null;
    }
    if (
      firstParty &&
      (firstParty.priceMode !== "info" || isMarketplaceAdmin(user._id))
    )
      return publicBuiltin(ctx, firstParty, user._id);
    return null;
  },
});

export const library = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const entries = await ctx.db
      .query("marketplaceLibrary")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return Promise.all(
      entries.map(async (entry) => {
        const latest = await latestPublishedContent(ctx, entry.productId);
        const updateAvailable =
          !!latest &&
          latest.content.priceMode === "free" &&
          latest.revision > (entry.revision ?? 1) &&
          compatibleAcquisition(entry, latest.content);
        return {
          productId: entry.productId,
          title: entry.title,
          category: entry.category,
          creatorName: entry.creatorName,
          delivery: entry.delivery,
          acquiredAt: entry.acquiredAt,
          profileTemplate: entry.profileTemplate,
          pageTemplate: entry.pageTemplate,
          pageSettings: entry.pageSettings,
          revision: entry.revision,
          latestRevision: latest?.revision,
          latestVersion: latest?.content.details?.version,
          updateAvailable,
          assets: await resolveAssets(ctx, entry.assets),
        };
      }),
    );
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const products = await ctx.db
      .query("marketplaceProducts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(100);
    return Promise.all(
      products.map((product) =>
        publicProduct(ctx, product, user._id, true, true),
      ),
    );
  },
});

export const queues = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAdmin(ctx);
    const creators = await ctx.db
      .query("creatorProfiles")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(100);
    const products = await ctx.db.query("marketplaceProducts").take(500);
    const queued = products.filter(
      (p) => p.status === "pending" || p.draftStatus === "pending",
    );
    return {
      creators,
      products: await Promise.all(
        queued.map((product) =>
          publicProduct(ctx, product, user._id, true, true),
        ),
      ),
    };
  },
});

export const adminProducts = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAdmin(ctx);
    const products = await ctx.db
      .query("marketplaceProducts")
      .order("desc")
      .take(500);
    const overrides = new Map(
      products.filter((p) => p.builtinId).map((p) => [p.builtinId!, p]),
    );
    return [
      ...(await Promise.all(
        products
          .filter((p) => !p.builtinId)
          .map((p) => publicProduct(ctx, p, user._id, true, true)),
      )),
      ...(await Promise.all(
        BUILTIN_MARKETPLACE_PRODUCTS.map((p) =>
          overrides.has(p.id)
            ? publicProduct(ctx, overrides.get(p.id)!, user._id, true, true)
            : publicBuiltin(ctx, p, user._id),
        ),
      )),
    ];
  },
});

export const adminCreators = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.db.query("creatorProfiles").order("desc").take(500);
  },
});

export const saveCreator = mutation({
  args: {
    displayName: v.string(),
    bio: v.string(),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const existing = await creatorFor(ctx, user._id);
    const values = {
      displayName: cleanMarketText(args.displayName, 70, "Nombre"),
      bio: cleanMarketText(args.bio, 1200, "Presentación"),
      website: marketExternalUrl(args.website),
      updatedAt: Date.now(),
    };
    if (existing) {
      // Pending applications return to draft on edits, so an administrator
      // always reviews the submitted version rather than a moving target.
      await ctx.db.patch("creatorProfiles", existing._id, {
        ...values,
        status: existing.status === "approved" ? "approved" : "draft",
        reviewReason: undefined,
      });
      return existing._id;
    }
    return ctx.db.insert("creatorProfiles", {
      ...values,
      userId: user._id,
      status: "draft",
      createdAt: Date.now(),
    });
  },
});
export const submitCreator = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const creator = await creatorFor(ctx, user._id);
    if (!creator) marketplaceError("Completá tu perfil de creador primero.");
    if (creator.status === "approved") return creator._id;
    await ctx.db.patch("creatorProfiles", creator._id, {
      status: "pending",
      reviewReason: undefined,
      updatedAt: Date.now(),
    });
    return creator._id;
  },
});
export const reviewCreator = mutation({
  args: {
    creatorId: v.id("creatorProfiles"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const creator = await ctx.db.get("creatorProfiles", args.creatorId);
    if (!creator) marketplaceError("Creador no encontrado.");
    if (args.decision === "approved" && creator.status !== "pending")
      marketplaceError("El perfil debe enviarse a revisión primero.");
    const reason = args.reason?.trim()
      ? cleanMarketText(args.reason, 1200, "Motivo")
      : undefined;
    if (args.decision === "rejected" && !reason)
      marketplaceError("Indicá el motivo del rechazo.");
    await ctx.db.patch("creatorProfiles", creator._id, {
      status: args.decision,
      reviewReason: reason,
      reviewedBy: admin._id,
      updatedAt: Date.now(),
    });
    if (args.decision === "rejected") {
      const products = await ctx.db
        .query("marketplaceProducts")
        .withIndex("by_user", (q) => q.eq("userId", creator.userId))
        .take(100);
      for (const product of products)
        if (product.status === "published" || product.status === "pending")
          await ctx.db.patch("marketplaceProducts", product._id, {
            status: "archived",
            reviewReason: reason,
            updatedAt: Date.now(),
          });
    }
    return creator._id;
  },
});

function isHardware(category: string) {
  return ["hardware", "new", "used"].includes(category);
}
function validatePublishable(product: ProductContent) {
  if (
    (product.priceMode === "paid" || product.priceMode === "external") &&
    (!Number.isSafeInteger(product.priceAmount) ||
      product.priceAmount! <= 0 ||
      !product.currency)
  )
    marketplaceError("Completá el precio y la moneda antes de publicar.");
  if (product.priceMode === "info")
    marketplaceError(
      "Completá el precio y la forma de compra antes de publicar.",
    );
}
export const saveProduct = mutation({
  args: {
    productId: v.optional(v.string()),
    title: v.string(),
    description: v.string(),
    category: marketplaceCategory,
    condition: v.optional(v.union(v.literal("new"), v.literal("used"))),
    coverStorageId: v.optional(v.id("_storage")),
    coverPath: v.optional(v.string()),
    priceMode: marketplacePriceMode,
    priceAmount: v.optional(v.number()),
    currency: v.optional(v.union(v.literal("ARS"), v.literal("USD"))),
    externalUrl: v.optional(v.string()),
    affiliate: v.optional(v.boolean()),
    assets: v.array(assetInput),
    gallery: v.optional(
      v.array(
        v.object({
          id: v.optional(v.string()),
          name: v.string(),
          mediaType: v.union(v.literal("image"), v.literal("video")),
          storageId: v.optional(v.id("_storage")),
          builtinPath: v.optional(v.string()),
          externalUrl: v.optional(v.string()),
        }),
      ),
    ),
    details: v.optional(marketplaceDetails),
    changelog: v.optional(v.array(marketplaceChangelog)),
    importSource: v.optional(marketplaceImportSource),
    pageTemplate: v.optional(marketplacePageTemplate),
    pageSettings: v.optional(marketplacePageSettings),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const admin = isMarketplaceAdmin(user._id);
    const creator = await creatorFor(ctx, user._id);
    if (!admin && creator?.status !== "approved")
      marketplaceError(
        "Tu perfil de creador debe estar aprobado para publicar productos.",
      );
    const firstParty = args.productId ? builtin(args.productId) : undefined;
    if (firstParty && !admin)
      marketplaceError("Sólo VISO puede editar sus recursos originales.");
    const existing = args.productId
      ? firstParty
        ? await dbProduct(ctx, args.productId)
        : await ownedProduct(ctx, args.productId, user._id)
      : null;
    const previous =
      existing?.draft ??
      (existing
        ? productContent(existing)
        : firstParty
          ? builtinContent(firstParty)
          : undefined);
    const inherited = [
      ...(existing?.assets ?? []),
      ...(existing?.draft?.assets ?? []),
      ...(firstParty ? builtinContent(firstParty).assets : []),
    ];
    const inheritedGallery: NonNullable<ProductContent["gallery"]> = [
      ...(existing?.gallery ?? []),
      ...(existing?.draft?.gallery ?? []),
      ...(firstParty?.gallery ?? []),
    ];
    const validateUpload = async (
      storageId: Id<"_storage">,
      retained: boolean,
    ) => {
      const own = await ctx.db
        .query("marketplaceUploads")
        .withIndex("by_storage", (q) => q.eq("storageId", storageId))
        .unique();
      if (
        !own ||
        !(await ctx.db.system.get("_storage", storageId)) ||
        (own.userId !== user._id && !retained)
      )
        marketplaceError("El archivo no pertenece a tu cuenta.");
      return own;
    };
    if (args.affiliate && !admin)
      marketplaceError("Sólo VISO publica enlaces de afiliados.");
    if (args.affiliate && args.priceMode !== "external")
      marketplaceError("Los enlaces de afiliado requieren compra externa.");
    if (args.priceMode === "info" && !isHardware(args.category))
      marketplaceError("La ficha informativa está disponible para hardware.");
    if (isHardware(args.category) && args.priceMode === "free")
      marketplaceError("El hardware requiere un precio y una forma de compra.");
    if (args.condition && !isHardware(args.category))
      marketplaceError("La condición corresponde a productos físicos.");
    const externalUrl = marketExternalUrl(
      args.externalUrl,
      args.affiliate === true,
    );
    if (args.priceMode === "external" && !externalUrl)
      marketplaceError("Agregá el enlace externo de compra.");
    if (args.priceMode !== "external" && externalUrl)
      marketplaceError(
        "Elegí compra externa para agregar un enlace de compra.",
      );
    if (
      args.priceAmount !== undefined &&
      (!Number.isSafeInteger(args.priceAmount) ||
        args.priceAmount <= 0 ||
        args.priceAmount > 1_000_000_000_000)
    )
      marketplaceError("El precio debe ser un importe positivo en centavos.");
    if (args.priceAmount !== undefined && !args.currency)
      marketplaceError("Elegí la moneda del precio.");
    if (args.assets.length > MAX_MARKETPLACE_ASSETS)
      marketplaceError(
        `Máximo ${MAX_MARKETPLACE_ASSETS} archivos por producto.`,
      );
    const allowed =
      args.category === "icons" || args.category === "screensavers"
        ? ["image", "video"]
        : args.category === "soundboards"
          ? ["audio"]
          : args.category === "plugins" || args.category === "pages"
            ? ["archive"]
            : args.category === "profiles"
              ? ["profile", "archive"]
              : [];
    const assets: LibraryAsset[] = [];
    const seen = new Set<string>();
    for (const asset of args.assets) {
      if (!allowed.includes(asset.mediaType))
        marketplaceError(
          "El formato del archivo no corresponde a esta categoría.",
        );
      if (asset.storageId) {
        const upload = await validateUpload(
          asset.storageId,
          inherited.some((item) => item.storageId === asset.storageId),
        );
        if (upload.mediaType !== asset.mediaType)
          marketplaceError(
            "El formato del archivo no corresponde a esta categoría.",
          );
        if (seen.has(asset.storageId))
          marketplaceError("El mismo archivo está agregado dos veces.");
        seen.add(asset.storageId);
        assets.push({
          id: asset.id ?? asset.storageId,
          name: cleanMarketText(asset.name, 100, "Nombre del archivo"),
          mediaType: asset.mediaType,
          storageId: asset.storageId,
        });
      } else {
        const trusted = inherited.find(
          (item) =>
            item.builtinPath === asset.builtinPath &&
            item.mediaType === asset.mediaType &&
            (asset.id === undefined || item.id === asset.id),
        );
        if (!trusted?.builtinPath)
          marketplaceError("El archivo no pertenece a tu cuenta.");
        if (seen.has(trusted.builtinPath))
          marketplaceError("El mismo archivo está agregado dos veces.");
        seen.add(trusted.builtinPath);
        assets.push({
          ...trusted,
          name: cleanMarketText(asset.name, 100, "Nombre del archivo"),
        });
      }
    }
    const pageTemplate =
      args.category === "pages"
        ? (args.pageTemplate ??
          (previous?.category === "pages" ? previous.pageTemplate : undefined))
        : undefined;
    const pageSettings = pageTemplate
      ? normalizeMarketplacePageSettings(
          pageTemplate,
          args.pageSettings ?? previous?.pageSettings,
        )
      : undefined;
    if (args.pageTemplate && args.category !== "pages")
      marketplaceError("Elegí la categoría Página para este contenido.");
    const specialBuiltin =
      !!firstParty &&
      args.category === firstParty.category &&
      (firstParty.profileTemplate === "essential" ||
        firstParty.delivery === "plugin");
    if (
      !assets.length &&
      (args.priceMode === "free" || args.priceMode === "paid") &&
      !pageTemplate &&
      !specialBuiltin &&
      !isHardware(args.category)
    )
      marketplaceError(
        "Agregá al menos un archivo al recurso gratuito o pago.",
      );
    if (args.coverStorageId) {
      const cover = await validateUpload(
        args.coverStorageId,
        args.coverStorageId === existing?.coverStorageId ||
          args.coverStorageId === existing?.draft?.coverStorageId ||
          inheritedGallery.some(
            (item) => item.storageId === args.coverStorageId,
          ),
      );
      if (cover.mediaType !== "image")
        marketplaceError("La portada debe ser una imagen o GIF.");
    }
    let coverPath = previous?.coverPath;
    if (args.coverPath !== undefined) {
      if (
        args.coverPath &&
        args.coverPath !== previous?.coverPath &&
        args.coverPath !== firstParty?.coverPath
      )
        marketplaceError("La portada no pertenece a este producto.");
      coverPath = args.coverPath || undefined;
    }
    const gallery: NonNullable<ProductContent["gallery"]> = [];
    if ((args.gallery?.length ?? 0) > 24)
      marketplaceError("Máximo 24 imágenes o videos en la galería.");
    for (const [index, item] of (
      args.gallery ??
      previous?.gallery ??
      []
    ).entries()) {
      const name = cleanMarketText(
        item.name,
        100,
        "Nombre de la imagen o video",
      );
      if (item.storageId) {
        const upload = await validateUpload(
          item.storageId,
          inheritedGallery.some((old) => old.storageId === item.storageId) ||
            inherited.some((old) => old.storageId === item.storageId),
        );
        if (upload.mediaType !== item.mediaType)
          marketplaceError("La galería admite imágenes y videos.");
        gallery.push({
          id: item.id ?? item.storageId,
          name,
          mediaType: item.mediaType,
          storageId: item.storageId,
        });
      } else if (item.builtinPath) {
        const trusted =
          inheritedGallery.find(
            (old) => old.builtinPath === item.builtinPath,
          ) ??
          (firstParty?.coverPath === item.builtinPath
            ? { mediaType: "image" }
            : undefined) ??
          inherited.find((old) => old.builtinPath === item.builtinPath);
        if (!trusted || trusted.mediaType !== item.mediaType)
          marketplaceError(
            "El archivo de galería no pertenece a este producto.",
          );
        gallery.push({
          id: item.id ?? `builtin-${index}`,
          name,
          mediaType: item.mediaType,
          builtinPath: item.builtinPath,
        });
      } else if (item.externalUrl) {
        const url = safeMarketplaceMediaUrl(item.externalUrl);
        const inheritedUrl = inheritedGallery.some(
          (old) =>
            old.externalUrl === item.externalUrl &&
            old.mediaType === item.mediaType,
        );
        if (!url || !((admin && args.affiliate) || inheritedUrl))
          marketplaceError("El enlace de galería no es válido.");
        gallery.push({
          id: item.id ?? `external-${index}`,
          name,
          mediaType: item.mediaType,
          externalUrl: url,
        });
      } else
        marketplaceError("La galería necesita un archivo o enlace válido.");
    }
    const details = args.details
      ? (Object.fromEntries(
          Object.entries(args.details)
            .filter(([, value]) => !!value?.trim())
            .map(([key, value]) => [
              key,
              key === "supportUrl"
                ? marketExternalUrl(value)
                : cleanMarketText(
                    value,
                    key === "setup" ? 6000 : 1200,
                    "Detalle",
                  ),
            ]),
        ) as ProductContent["details"])
      : previous?.details;
    const changelog = args.changelog?.map((item) => {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(item.date) ||
        !Number.isFinite(Date.parse(item.date))
      )
        marketplaceError(
          "La fecha de la versión debe tener formato AAAA-MM-DD.",
        );
      return {
        version: cleanMarketText(item.version, 60, "Versión"),
        date: item.date,
        notes: cleanMarketText(item.notes, 3000, "Novedades"),
      };
    });
    if ((changelog?.length ?? 0) > 50)
      marketplaceError("Máximo 50 entradas de versiones.");
    let importSource = previous?.importSource;
    if (args.importSource) {
      if (!admin || !args.affiliate || args.priceMode !== "external")
        marketplaceError(
          "La importación requiere una publicación de afiliado VISO.",
        );
      const source = args.importSource;
      if (
        !Number.isFinite(source.importedAt) ||
        source.importedAt <= 0 ||
        source.importedAt > Date.now() + 60_000
      )
        marketplaceError("La fecha de importación no es válida.");
      importSource = {
        affiliateUrl: marketExternalUrl(source.affiliateUrl, true)!,
        sourceUrl: marketExternalUrl(source.sourceUrl, true),
        itemId: source.itemId
          ? cleanMarketText(source.itemId, 50, "Identificador")
          : undefined,
        importedAt: source.importedAt,
        availability: source.availability
          ? cleanMarketText(source.availability, 100, "Disponibilidad")
          : undefined,
      };
      if (importSource.affiliateUrl !== externalUrl)
        marketplaceError("Conservá el enlace de afiliado de la importación.");
    }
    if (!existing && !firstParty) {
      const count = await ctx.db
        .query("marketplaceProducts")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(100);
      if (count.length >= 100)
        marketplaceError("Podés mantener hasta 100 productos.");
    }
    const values: ProductContent = {
      creatorName:
        existing?.creatorName ??
        (firstParty ? "VISO" : (creator?.displayName ?? "VISO")),
      title: cleanMarketText(args.title, 100, "Título"),
      description: cleanMarketText(args.description, 6000, "Descripción"),
      category: args.category,
      condition: isHardware(args.category)
        ? (args.condition ??
          (args.category === "new" || args.category === "used"
            ? args.category
            : previous?.condition))
        : undefined,
      coverStorageId: args.coverStorageId,
      coverPath,
      priceMode: args.priceMode,
      priceAmount:
        args.priceMode === "free"
          ? undefined
          : (args.priceAmount ?? previous?.priceAmount),
      currency:
        args.priceMode === "free"
          ? undefined
          : (args.currency ?? previous?.currency),
      delivery: pageTemplate
        ? "page"
        : isHardware(args.category)
          ? "inquiry"
          : specialBuiltin
            ? firstParty!.delivery
            : "assets",
      externalUrl,
      affiliate: args.affiliate ?? false,
      assets,
      gallery,
      details,
      changelog: changelog ?? previous?.changelog,
      importSource: args.affiliate ? importSource : undefined,
      pageTemplate,
      pageSettings,
      profileTemplate: specialBuiltin ? firstParty?.profileTemplate : undefined,
    };
    const now = Date.now();
    if (existing) {
      if (existing.status === "published")
        await ctx.db.patch("marketplaceProducts", existing._id, {
          draft: values,
          draftStatus: "draft",
          draftReviewReason: undefined,
          updatedAt: now,
        });
      else
        await ctx.db.patch("marketplaceProducts", existing._id, {
          ...values,
          status: "draft",
          reviewReason: undefined,
          draft: undefined,
          draftStatus: undefined,
          draftReviewReason: undefined,
          updatedAt: now,
        });
      return existing.builtinId ?? existing._id;
    }
    const content =
      firstParty && firstParty.priceMode !== "info"
        ? builtinContent(firstParty)
        : values;
    const id = await ctx.db.insert("marketplaceProducts", {
      ...content,
      userId: user._id,
      creatorId: creator?._id,
      builtinId: firstParty?.id,
      status:
        firstParty && firstParty.priceMode !== "info" ? "published" : "draft",
      revision: 1,
      ...(firstParty && firstParty.priceMode !== "info"
        ? { draft: values, draftStatus: "draft" as const }
        : {}),
      createdAt: now,
      updatedAt: now,
    });
    return firstParty?.id ?? id;
  },
});
export const submitProduct = mutation({
  args: { productId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const product = await ownedProduct(ctx, args.productId, user._id);
    const creator = await creatorFor(ctx, product.userId);
    if (!isMarketplaceAdmin(user._id) && creator?.status !== "approved")
      marketplaceError("Tu perfil de creador debe estar aprobado.");
    const content = product.draft ?? productContent(product);
    validatePublishable(content);
    if (product.status === "published" && product.draft)
      await ctx.db.patch("marketplaceProducts", product._id, {
        draftStatus: "pending",
        draftReviewReason: undefined,
        updatedAt: Date.now(),
      });
    else if (product.status !== "published")
      await ctx.db.patch("marketplaceProducts", product._id, {
        status: "pending",
        reviewReason: undefined,
        updatedAt: Date.now(),
      });
    else marketplaceError("Guardá los cambios antes de enviarlos a revisión.");
    return product.builtinId ?? product._id;
  },
});
export const reviewProduct = mutation({
  args: {
    productId: v.string(),
    decision: v.union(
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("archived"),
    ),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const product = await dbProduct(ctx, args.productId);
    if (!product) marketplaceError("Producto no encontrado.");
    const reason = args.reason?.trim()
      ? cleanMarketText(args.reason, 1200, "Motivo")
      : undefined;
    if (args.decision === "rejected" && !reason)
      marketplaceError("Indicá el motivo del rechazo.");
    const updating = product.status === "published" && !!product.draft;
    if (args.decision === "approved") {
      if (
        updating
          ? product.draftStatus !== "pending"
          : product.status !== "pending"
      )
        marketplaceError("El producto debe enviarse a revisión primero.");
      if (
        !product.builtinId &&
        !isMarketplaceAdmin(product.userId) &&
        (await creatorFor(ctx, product.userId))?.status !== "approved"
      )
        marketplaceError("El creador no está aprobado.");
      validatePublishable(product.draft ?? productContent(product));
      await ctx.db.patch("marketplaceProducts", product._id, {
        ...(product.draft ?? {}),
        status: "published",
        revision: updating
          ? (product.revision ?? 1) + 1
          : (product.revision ?? 1),
        draft: undefined,
        draftStatus: undefined,
        draftReviewReason: undefined,
        reviewReason: undefined,
        reviewedBy: admin._id,
        publishedAt: Date.now(),
        updatedAt: Date.now(),
      });
    } else if (args.decision === "rejected" && updating) {
      await ctx.db.patch("marketplaceProducts", product._id, {
        draftStatus: "rejected",
        draftReviewReason: reason,
        reviewedBy: admin._id,
        updatedAt: Date.now(),
      });
    } else
      await ctx.db.patch("marketplaceProducts", product._id, {
        status: args.decision,
        reviewReason: reason,
        reviewedBy: admin._id,
        updatedAt: Date.now(),
      });
    return product.builtinId ?? product._id;
  },
});

type AcquisitionContent = Pick<
  ProductContent,
  | "title"
  | "category"
  | "creatorName"
  | "delivery"
  | "assets"
  | "profileTemplate"
  | "pageTemplate"
  | "pageSettings"
>;
function acquisitionValues(product: AcquisitionContent) {
  return {
    title: product.title,
    category: product.category,
    creatorName: product.creatorName,
    delivery: product.delivery,
    assets: product.assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      mediaType: asset.mediaType,
      ...(asset.storageId ? { storageId: asset.storageId } : {}),
      ...(asset.builtinPath ? { builtinPath: asset.builtinPath } : {}),
    })),
    profileTemplate: product.profileTemplate,
    pageTemplate: product.pageTemplate,
    pageSettings: product.pageSettings,
  };
}
export async function acquireProductSnapshot(
  ctx: MutationCtx,
  userId: Id<"users">,
  productId: string,
  product: AcquisitionContent,
  revision = 1,
  paid = false,
) {
  const existing = await libraryFor(ctx, userId, productId);
  if (existing) {
    // Only a newly confirmed purchase may replace a paid snapshot. Replayed
    // notifications from older orders cannot downgrade a newer acquisition.
    if (paid && revision > (existing.revision ?? 1))
      await ctx.db.patch("marketplaceLibrary", existing._id, {
        ...acquisitionValues(product),
        revision,
      });
    return existing._id;
  }
  if (!paid) {
    const entries = await ctx.db
      .query("marketplaceLibrary")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(MAX_MARKETPLACE_LIBRARY);
    if (entries.length >= MAX_MARKETPLACE_LIBRARY)
      marketplaceError(
        "Tu biblioteca alcanzó el límite de recursos gratuitos.",
      );
  }
  return ctx.db.insert("marketplaceLibrary", {
    ...acquisitionValues(product),
    userId,
    productId,
    revision,
    acquiredAt: Date.now(),
  });
}
async function latestPublishedContent(ctx: ReadCtx, productId: string) {
  const record = await dbProduct(ctx, productId);
  const firstParty = builtin(productId);
  if (record?.status === "published")
    return {
      content: productContent(record),
      revision: record.revision ?? 1,
      record,
    };
  if (record) return null;
  if (firstParty && firstParty.priceMode !== "info")
    return { content: builtinContent(firstParty), revision: 1, record: null };
  return null;
}
async function publishedContent(ctx: ReadCtx, productId: string) {
  const published = await latestPublishedContent(ctx, productId);
  if (!published) marketplaceError("El recurso no está disponible.");
  return published;
}
function compatibleAcquisition(
  entry: AcquisitionContent,
  content: AcquisitionContent,
) {
  return (
    entry.category === content.category &&
    entry.delivery === content.delivery &&
    entry.pageTemplate === content.pageTemplate &&
    entry.profileTemplate === content.profileTemplate
  );
}
export async function paymentProductFor(
  ctx: ReadCtx,
  productId: string,
  userId: Id<"users">,
) {
  const user = await requireCurrentUser(ctx);
  if (user._id !== userId)
    marketplaceError("No tenés permiso para esta compra.");
  const { content, revision, record } = await publishedContent(ctx, productId);
  if (!record || content.priceMode !== "paid" || content.affiliate)
    marketplaceError("Este producto se compra o consulta en su sitio externo.");
  validatePublishable(content);
  return {
    productId: record.builtinId ?? record._id,
    title: content.title,
    priceMode: content.priceMode,
    priceAmount: content.priceAmount!,
    currency: content.currency!,
    affiliate: content.affiliate,
    status: record.status,
    sellerId: record.userId,
    builtin: !!record.builtinId,
    category: content.category,
    creatorName: content.creatorName,
    delivery: content.delivery,
    assets: content.assets,
    profileTemplate: content.profileTemplate,
    pageTemplate: content.pageTemplate,
    pageSettings: content.pageSettings,
    revision,
  };
}
export const paymentProduct = internalQuery({
  args: { productId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    return paymentProductFor(ctx, args.productId, user._id);
  },
});
export const acquire = mutation({
  args: { productId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const { content, revision } = await publishedContent(ctx, args.productId);
    if (content.priceMode !== "free")
      marketplaceError(
        "Este producto se compra o consulta en su sitio externo.",
      );
    return acquireProductSnapshot(
      ctx,
      user._id,
      args.productId,
      content,
      revision,
    );
  },
});
// Updating is always an explicit user operation. Acquired versions never change
// while creators are drafting, publishing or repricing a subsequent release.
export const updateLibrary = mutation({
  args: { productId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const entry = await libraryFor(ctx, user._id, args.productId);
    if (!entry)
      marketplaceError("Agregá este recurso a tu biblioteca primero.");
    const { content, revision } = await publishedContent(ctx, args.productId);
    if (content.priceMode !== "free")
      marketplaceError(
        "Esta versión requiere una nueva compra; conservás tu versión adquirida.",
      );
    if (!compatibleAcquisition(entry, content))
      marketplaceError(
        "Esta edición cambió de formato. Conservás tu versión y podés agregar la nueva por separado.",
      );
    if (revision <= (entry.revision ?? 1)) return entry._id;
    await ctx.db.patch("marketplaceLibrary", entry._id, {
      ...acquisitionValues(content),
      revision,
    });
    return entry._id;
  },
});
export const removeFromLibrary = mutation({
  args: { productId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const entry = await libraryFor(ctx, user._id, args.productId);
    if (entry) await ctx.db.delete("marketplaceLibrary", entry._id);
    return null;
  },
});

export const libraryAsset = internalQuery({
  args: { productId: v.string(), assetId: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    userId: Id<"users">;
    storageId: Id<"_storage">;
    mediaType: "image" | "video";
  }> => {
    const user = await requireCurrentUser(ctx);
    const entry = await libraryFor(ctx, user._id, args.productId);
    const asset = entry?.assets.find((item) => item.id === args.assetId);
    if (
      !entry ||
      !["icons", "screensavers"].includes(entry.category) ||
      !asset?.storageId ||
      (asset.mediaType !== "image" && asset.mediaType !== "video")
    )
      marketplaceError("Este archivo no está disponible para tus teclas.");
    return {
      userId: user._id,
      storageId: asset.storageId,
      mediaType: asset.mediaType,
    };
  },
});
export const copyAssetToDeck = action({
  args: { productId: v.string(), assetId: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ storageId: Id<"_storage">; mediaType: "image" | "video" }> => {
    const asset = await ctx.runQuery(internal.marketplace.libraryAsset, args);
    const blob = await ctx.storage.get(asset.storageId);
    if (!blob) throw new ConvexError("El archivo ya no está disponible.");
    const storageId = await ctx.storage.store(blob);
    try {
      await ctx.runMutation(internal.deck_media.recordUpload, {
        userId: asset.userId,
        storageId,
        mediaType: asset.mediaType,
      });
    } catch (error) {
      await ctx.storage.delete(storageId);
      throw error;
    }
    return { storageId, mediaType: asset.mediaType };
  },
});

export const installProfile = mutation({
  args: { productId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const entry = await libraryFor(ctx, user._id, args.productId);
    if (entry?.category !== "profiles" || entry.profileTemplate !== "essential")
      marketplaceError(
        "Este perfil no admite instalación automática. Descargá su archivo desde tu biblioteca.",
      );
    const pages = await ctx.db
      .query("deckPages")
      .withIndex("by_user_and_order", (q) => q.eq("userId", user._id))
      .take(MAX_PAGES);
    if (pages.length >= MAX_PAGES)
      marketplaceError(`Máximo ${MAX_PAGES} páginas.`);
    const statuses = await ctx.db
      .query("statuses")
      .withIndex("by_user_and_order", (q) => q.eq("userId", user._id))
      .take(25);
    const missing = VISO_STATES.filter(
      (definition) => !findVisoStatus(definition, statuses),
    );
    if (statuses.length + missing.length > 24)
      marketplaceError(
        "No hay espacio para los estados del perfil. Liberá estados antes de instalarlo.",
      );
    let nextOrder = statuses.length
      ? Math.max(...statuses.map((status) => status.order)) + 1
      : 0;
    for (const definition of missing) {
      const id = await ctx.db.insert("statuses", {
        userId: user._id,
        name: definition.name,
        color: definition.defaultColor,
        icon: definition.icon,
        order: nextOrder++,
      });
      statuses.push((await ctx.db.get("statuses", id))!);
    }
    const pageId = await ctx.db.insert("deckPages", {
      userId: user._id,
      name: "VISO Esencial",
      order: pages.length
        ? Math.max(...pages.map((page) => page.order)) + 1
        : 0,
      grid: { columns: 3, rows: 2 },
    });
    let position = 0;
    for (const definition of VISO_STATES) {
      const status = findVisoStatus(definition, statuses);
      if (status)
        await ctx.db.insert("deckKeys", {
          userId: user._id,
          pageId,
          position,
          content: { kind: "status", statusId: status._id },
        });
      position++;
    }
    return pageId;
  },
});

// Administrative setup aid: returns only existing account IDs and provider
// evidence for an operator to review. It does not write env vars or grant roles.
export const resolveAdminCandidate = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const password = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email),
      )
      .collect();
    const users = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .collect();
    const candidates = new Map<
      string,
      { userId: Id<"users">; password: boolean; googleVerified: boolean }
    >();
    for (const account of password)
      if (await ctx.db.get("users", account.userId))
        candidates.set(account.userId, {
          userId: account.userId,
          password: true,
          googleVerified: false,
        });
    for (const user of users) {
      const accounts = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) =>
          q.eq("userId", user._id).eq("provider", "google"),
        )
        .collect();
      if (
        accounts.some(
          (account) => account.emailVerified?.toLowerCase() === email,
        )
      ) {
        const prior = candidates.get(user._id);
        candidates.set(user._id, {
          userId: user._id,
          password: prior?.password ?? false,
          googleVerified: true,
        });
      }
    }
    const result = [...candidates.values()];
    return { unique: result.length === 1, candidates: result };
  },
});
