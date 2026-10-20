import { ConvexError, v } from "convex/values";
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
  marketplaceError,
  marketplaceMediaType,
  marketplacePriceMode,
  MAX_MARKETPLACE_ASSETS,
  MAX_MARKETPLACE_LIBRARY,
} from "./lib/marketplace_validation";
import { MAX_PAGES } from "./lib/deck_keys";
import { findVisoStatus, VISO_STATES } from "./lib/viso_preset_states";

type ReadCtx = QueryCtx | MutationCtx;
type LibraryAsset = Doc<"marketplaceLibrary">["assets"][number];
const categoryArg = v.optional(marketplaceCategory);
const assetInput = v.object({
  name: v.string(),
  storageId: v.id("_storage"),
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
  return id ? ctx.db.get("marketplaceProducts", id) : null;
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
async function ownedUpload(
  ctx: ReadCtx,
  storageId: Id<"_storage">,
  userId: Id<"users">,
) {
  const upload = await ctx.db
    .query("marketplaceUploads")
    .withIndex("by_storage", (q) => q.eq("storageId", storageId))
    .unique();
  if (
    !upload ||
    upload.userId !== userId ||
    !(await ctx.db.system.get("_storage", storageId))
  )
    marketplaceError("El archivo no pertenece a tu cuenta.");
  return upload;
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
async function publicProduct(
  ctx: ReadCtx,
  product: Doc<"marketplaceProducts">,
  userId: Id<"users">,
  includeAssets = false,
) {
  const owner = product.userId === userId || isMarketplaceAdmin(userId);
  const acquired = await libraryFor(ctx, userId, product._id);
  return {
    id: product._id,
    title: product.title,
    description: product.description,
    category: product.category,
    creatorName: product.creatorName,
    coverUrl: product.coverStorageId
      ? await ctx.storage.getUrl(product.coverStorageId)
      : null,
    coverStorageId: owner ? product.coverStorageId : undefined,
    priceMode: product.priceMode,
    delivery: product.delivery,
    externalUrl: product.externalUrl,
    affiliate: product.affiliate,
    status: product.status,
    builtin: false,
    assetCount: product.assets.length,
    acquired: !!acquired,
    owned: owner,
    canEdit: product.userId === userId,
    reviewReason: owner ? product.reviewReason : undefined,
    updatedAt: product.updatedAt,
    assets:
      includeAssets && owner ? await resolveAssets(ctx, product.assets) : [],
  };
}
async function publicBuiltin(
  ctx: ReadCtx,
  product: (typeof BUILTIN_MARKETPLACE_PRODUCTS)[number],
  userId: Id<"users">,
) {
  const acquired = await libraryFor(ctx, userId, product.id);
  return {
    id: product.id,
    title: product.title,
    description: product.description,
    category: product.category,
    creatorName: product.creatorName,
    coverUrl: product.coverPath,
    priceMode: product.priceMode,
    delivery: product.delivery,
    externalUrl: product.externalUrl,
    affiliate: false,
    status: "published" as const,
    builtin: true,
    assetCount: product.assets.length,
    acquired: !!acquired,
    owned: false,
    canEdit: false,
    coverStorageId: undefined,
    updatedAt: 0,
    reviewReason: undefined,
    assets: acquired ? await resolveAssets(ctx, acquired.assets) : [],
  };
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
    const records = args.category
      ? await ctx.db
          .query("marketplaceProducts")
          .withIndex("by_category_status", (q) =>
            q.eq("category", args.category!).eq("status", "published"),
          )
          .take(500)
      : await ctx.db
          .query("marketplaceProducts")
          .withIndex("by_status", (q) => q.eq("status", "published"))
          .take(500);
    const builtins = BUILTIN_MARKETPLACE_PRODUCTS.filter(
      (item) => !args.category || item.category === args.category,
    );
    const products = [
      ...(await Promise.all(
        builtins.map((item) => publicBuiltin(ctx, item, user._id)),
      )),
      ...(await Promise.all(
        records.map((item) => publicProduct(ctx, item, user._id)),
      )),
    ];
    return products.filter(
      (item) =>
        !search ||
        `${item.title} ${item.description} ${item.creatorName}`
          .toLocaleLowerCase("es")
          .includes(search),
    );
  },
});

export const get = query({
  args: { productId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const firstParty = builtin(args.productId);
    if (firstParty) return publicBuiltin(ctx, firstParty, user._id);
    const product = await dbProduct(ctx, args.productId);
    if (
      !product ||
      (product.status !== "published" &&
        product.userId !== user._id &&
        !isMarketplaceAdmin(user._id))
    )
      return null;
    return publicProduct(ctx, product, user._id, true);
  },
});

export const library = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const entries = await ctx.db
      .query("marketplaceLibrary")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(MAX_MARKETPLACE_LIBRARY);
    return Promise.all(
      entries.map(async (entry) => ({
        productId: entry.productId,
        title: entry.title,
        category: entry.category,
        creatorName: entry.creatorName,
        delivery: entry.delivery,
        acquiredAt: entry.acquiredAt,
        profileTemplate: entry.profileTemplate,
        assets: await resolveAssets(ctx, entry.assets),
      })),
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
      products.map((product) => publicProduct(ctx, product, user._id, true)),
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
    const products = await ctx.db
      .query("marketplaceProducts")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(100);
    return {
      creators,
      products: await Promise.all(
        products.map((product) => publicProduct(ctx, product, user._id, true)),
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
    return Promise.all(
      products.map((product) => publicProduct(ctx, product, user._id, true)),
    );
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

export const saveProduct = mutation({
  args: {
    productId: v.optional(v.string()),
    title: v.string(),
    description: v.string(),
    category: marketplaceCategory,
    coverStorageId: v.optional(v.id("_storage")),
    priceMode: marketplacePriceMode,
    externalUrl: v.optional(v.string()),
    affiliate: v.optional(v.boolean()),
    assets: v.array(assetInput),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const admin = isMarketplaceAdmin(user._id);
    const creator = await creatorFor(ctx, user._id);
    if (!admin && creator?.status !== "approved")
      marketplaceError(
        "Tu perfil de creador debe estar aprobado para publicar productos.",
      );
    const existing = args.productId
      ? await ownedProduct(ctx, args.productId, user._id)
      : null;
    // An administrator reviewing another creator's product cannot silently take
    // ownership of its uploaded files through the edit endpoint.
    if (existing && existing.userId !== user._id)
      marketplaceError("Revisá este producto desde la cola de aprobación.");
    if (args.category === "used" && !admin)
      marketplaceError("Por ahora, sólo VISO publica productos usados.");
    if (
      args.category === "used" &&
      (args.priceMode !== "external" || args.affiliate !== true)
    )
      marketplaceError("Los usados requieren un enlace externo de afiliado.");
    if (args.affiliate && !admin)
      marketplaceError("Sólo VISO publica enlaces de afiliados.");
    if (args.affiliate && args.priceMode !== "external")
      marketplaceError("Los enlaces de afiliado requieren compra externa.");
    if (args.priceMode === "info" && args.category !== "hardware")
      marketplaceError("La ficha informativa está disponible para hardware.");
    if (
      ["hardware", "used"].includes(args.category) &&
      args.priceMode === "free"
    )
      marketplaceError("El hardware se ofrece por enlace externo o consulta.");
    const externalUrl = marketExternalUrl(
      args.externalUrl,
      args.category === "used" || args.affiliate === true,
    );
    if (args.priceMode === "external" && !externalUrl)
      marketplaceError("Agregá el enlace externo de compra.");
    if (args.priceMode !== "external" && externalUrl)
      marketplaceError(
        "Elegí compra externa para agregar un enlace de compra.",
      );
    if (args.assets.length > MAX_MARKETPLACE_ASSETS)
      marketplaceError(
        `Máximo ${MAX_MARKETPLACE_ASSETS} archivos por producto.`,
      );
    if (["hardware", "used"].includes(args.category) && args.assets.length)
      marketplaceError(
        "El hardware usa imágenes de portada y un enlace de compra.",
      );
    if (!args.assets.length && args.priceMode === "free")
      marketplaceError("Agregá al menos un archivo al recurso gratuito.");
    const allowed =
      args.category === "icons" || args.category === "screensavers"
        ? ["image", "video"]
        : args.category === "soundboards"
          ? ["audio"]
          : args.category === "plugins"
            ? ["archive"]
            : args.category === "profiles"
              ? ["profile", "archive"]
              : [];
    const assets: LibraryAsset[] = [];
    const seen = new Set<string>();
    for (const asset of args.assets) {
      const upload = await ownedUpload(ctx, asset.storageId, user._id);
      if (
        upload.mediaType !== asset.mediaType ||
        !allowed.includes(asset.mediaType)
      )
        marketplaceError(
          "El formato del archivo no corresponde a esta categoría.",
        );
      if (seen.has(asset.storageId))
        marketplaceError("El mismo archivo está agregado dos veces.");
      seen.add(asset.storageId);
      assets.push({
        id: asset.storageId,
        name: cleanMarketText(asset.name, 100, "Nombre del archivo"),
        mediaType: asset.mediaType,
        storageId: asset.storageId,
      });
    }
    if (args.coverStorageId) {
      const cover = await ownedUpload(ctx, args.coverStorageId, user._id);
      if (cover.mediaType !== "image")
        marketplaceError("La portada debe ser una imagen o GIF.");
    }
    if (!existing) {
      const count = await ctx.db
        .query("marketplaceProducts")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(100);
      if (count.length >= 100)
        marketplaceError("Podés mantener hasta 100 productos.");
    }
    const values = {
      creatorName: admin && !creator ? "VISO" : creator!.displayName,
      creatorId: creator?._id,
      title: cleanMarketText(args.title, 100, "Título"),
      description: cleanMarketText(args.description, 6000, "Descripción"),
      category: args.category,
      coverStorageId: args.coverStorageId,
      priceMode: args.priceMode,
      delivery: (["hardware", "used"].includes(args.category)
        ? "inquiry"
        : "assets") as "inquiry" | "assets",
      externalUrl,
      affiliate: args.affiliate ?? false,
      assets,
      status: "draft" as const,
      reviewReason: undefined,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch("marketplaceProducts", existing._id, values);
      return existing._id;
    }
    return ctx.db.insert("marketplaceProducts", {
      ...values,
      userId: user._id,
      createdAt: Date.now(),
    });
  },
});

export const submitProduct = mutation({
  args: { productId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const product = await ownedProduct(ctx, args.productId, user._id);
    if (product.userId !== user._id)
      marketplaceError("Sólo el autor puede enviar el producto.");
    const creator = await creatorFor(ctx, user._id);
    if (!isMarketplaceAdmin(user._id) && creator?.status !== "approved")
      marketplaceError("Tu perfil de creador debe estar aprobado.");
    await ctx.db.patch("marketplaceProducts", product._id, {
      status: "pending",
      reviewReason: undefined,
      updatedAt: Date.now(),
    });
    return product._id;
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
    if (args.decision === "rejected" && !args.reason?.trim())
      marketplaceError("Indicá el motivo del rechazo.");
    if (args.decision === "approved") {
      if (product.status !== "pending")
        marketplaceError("El producto debe enviarse a revisión primero.");
      if (
        !isMarketplaceAdmin(product.userId) &&
        (await creatorFor(ctx, product.userId))?.status !== "approved"
      )
        marketplaceError("El creador no está aprobado.");
    }
    await ctx.db.patch("marketplaceProducts", product._id, {
      status: args.decision === "approved" ? "published" : args.decision,
      reviewReason: args.reason?.trim()
        ? cleanMarketText(args.reason, 1200, "Motivo")
        : undefined,
      reviewedBy: admin._id,
      updatedAt: Date.now(),
      ...(args.decision === "approved" ? { publishedAt: Date.now() } : {}),
    });
    return product._id;
  },
});

export const acquire = mutation({
  args: { productId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const firstParty = builtin(args.productId);
    const product = firstParty ?? (await dbProduct(ctx, args.productId));
    if (!product || ("status" in product && product.status !== "published"))
      marketplaceError("El recurso no está disponible.");
    if (product.priceMode !== "free")
      marketplaceError(
        "Este producto se compra o consulta en su sitio externo.",
      );
    const existing = await libraryFor(ctx, user._id, args.productId);
    if (existing) return existing._id;
    const entries = await ctx.db
      .query("marketplaceLibrary")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(MAX_MARKETPLACE_LIBRARY);
    if (entries.length >= MAX_MARKETPLACE_LIBRARY)
      marketplaceError("Tu biblioteca alcanzó el límite de recursos.");
    return ctx.db.insert("marketplaceLibrary", {
      userId: user._id,
      productId: args.productId,
      title: product.title,
      category: product.category,
      creatorName: product.creatorName,
      delivery: product.delivery,
      assets: product.assets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        mediaType: asset.mediaType,
        ...("storageId" in asset && asset.storageId
          ? { storageId: asset.storageId }
          : {}),
        ...("builtinPath" in asset && asset.builtinPath
          ? { builtinPath: asset.builtinPath }
          : {}),
      })),
      ...(firstParty?.profileTemplate
        ? { profileTemplate: firstParty.profileTemplate }
        : {}),
      acquiredAt: Date.now(),
    });
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
