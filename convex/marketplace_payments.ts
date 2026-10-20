import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireCurrentUser } from "./lib/current_user";
import { marketplaceError } from "./lib/marketplace_validation";
import { acquireProductSnapshot, isMarketplaceAdmin, paymentProductFor } from "./marketplace";
import {
  commissionFor, decryptPaymentToken, encryptPaymentToken, hashPaymentState,
  providerAmountToMinor, providerPaymentStatus, providerRequest,
} from "./lib/marketplace_payment_provider";

const SETTINGS_KEY = "mercadopago-ar";
const paymentStatus = v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"),
  v.literal("cancelled"), v.literal("refunded"), v.literal("charged_back"));

function providerMode(): "test" | "live" {
  return process.env.MP_MODE === "live" ? "live" : "test";
}
function configured() {
  return !!(process.env.MP_APPLICATION_ID && process.env.MP_CLIENT_SECRET &&
    process.env.MP_ACCESS_TOKEN && process.env.MP_WEBHOOK_SECRET && process.env.MP_TOKEN_ENCRYPTION_KEY);
}
function callbackUrl() {
  const value = process.env.MP_REDIRECT_URI ?? `${process.env.CONVEX_SITE_URL ?? ""}/marketplace/payments/oauth/callback`;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error();
    return url.href;
  } catch { return marketplaceError("Falta configurar la dirección de Mercado Pago."); }
}
function siteUrl() {
  try {
    const url = new URL(process.env.SITE_URL ?? "");
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    return url.origin;
  } catch { return marketplaceError("Falta configurar la dirección de VISO."); }
}
function connectionReady() {
  return !!(process.env.MP_APPLICATION_ID && process.env.MP_CLIENT_SECRET && process.env.MP_TOKEN_ENCRYPTION_KEY);
}
async function settingsFor(ctx: Parameters<typeof requireCurrentUser>[0]) {
  return ctx.db.query("marketplacePaymentSettings").withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY)).unique();
}

export const configuration = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const settings = await settingsFor(ctx);
    const admin = isMarketplaceAdmin(user._id);
    const ready = configured();
    return {
      isAdmin: admin,
      configured: ready,
      connectionReady: connectionReady(),
      mode: providerMode(),
      enabled: !!(ready && settings?.enabled && settings.splitApproved && settings.policiesAccepted),
      digitalCommissionBps: settings?.digitalCommissionBps ?? null,
      hardwareCommissionBps: settings?.hardwareCommissionBps ?? null,
      ...(admin ? {
        splitApproved: settings?.splitApproved ?? false,
        policiesAccepted: settings?.policiesAccepted ?? false,
        requestedEnabled: settings?.enabled ?? false,
      } : {}),
    };
  },
});

export const saveSettings = mutation({
  args: {
    digitalCommissionBps: v.optional(v.number()), hardwareCommissionBps: v.optional(v.number()),
    enabled: v.boolean(), splitApproved: v.boolean(), policiesAccepted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    if (!isMarketplaceAdmin(user._id)) marketplaceError("No tenés permiso para configurar cobros.");
    for (const rate of [args.digitalCommissionBps, args.hardwareCommissionBps]) {
      if (rate !== undefined && (!Number.isSafeInteger(rate) || rate < 0 || rate > 10_000)) {
        marketplaceError("La comisión debe estar entre 0 y 100%, con hasta dos decimales.");
      }
    }
    if (args.enabled && (!configured() || !args.splitApproved || !args.policiesAccepted ||
      (args.digitalCommissionBps === undefined && args.hardwareCommissionBps === undefined))) {
      marketplaceError("Completá la configuración, la habilitación del split, las políticas y al menos una comisión antes de activar cobros.");
    }
    const existing = await settingsFor(ctx);
    const values = { ...args, key: SETTINGS_KEY, updatedBy: user._id, updatedAt: Date.now() };
    if (existing) await ctx.db.patch("marketplacePaymentSettings", existing._id, values);
    else await ctx.db.insert("marketplacePaymentSettings", values);
    return null;
  },
});

export const account = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const account = await ctx.db.query("marketplacePaymentAccounts")
      .withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
    return account ? {
      connected: account.status === "connected", providerUserId: account.providerUserId,
      country: account.country, updatedAt: account.updatedAt,
    } : { connected: false };
  },
});

export const createOAuthState = internalMutation({
  args: { stateHash: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const creator = await ctx.db.query("creatorProfiles").withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
    if (!isMarketplaceAdmin(user._id) && creator?.status !== "approved") {
      marketplaceError("Primero necesitás un perfil de creador aprobado.");
    }
    const old = await ctx.db.query("marketplacePaymentOAuthStates").withIndex("by_user", (q) => q.eq("userId", user._id)).take(30);
    for (const state of old) await ctx.db.delete("marketplacePaymentOAuthStates", state._id);
    await ctx.db.insert("marketplacePaymentOAuthStates", {
      userId: user._id, stateHash: args.stateHash, createdAt: Date.now(), expiresAt: Date.now() + 10 * 60_000,
    });
  },
});

export const beginConnection = action({
  args: {},
  handler: async (ctx): Promise<{ authorizationUrl: string }> => {
    if (!connectionReady()) marketplaceError("Los cobros todavía no están configurados en VISO.");
    const state = [...crypto.getRandomValues(new Uint8Array(32))].map((v) => v.toString(16).padStart(2, "0")).join("");
    await ctx.runMutation(internal.marketplace_payments.createOAuthState, { stateHash: await hashPaymentState(state) });
    const url = new URL("https://auth.mercadopago.com.ar/authorization");
    url.searchParams.set("client_id", process.env.MP_APPLICATION_ID!);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("platform_id", "mp");
    url.searchParams.set("redirect_uri", callbackUrl());
    url.searchParams.set("state", state);
    return { authorizationUrl: url.href };
  },
});

export const consumeOAuthState = internalMutation({
  args: { stateHash: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db.query("marketplacePaymentOAuthStates").withIndex("by_state", (q) => q.eq("stateHash", args.stateHash)).unique();
    if (!row || row.consumedAt || row.expiresAt <= Date.now()) marketplaceError("La autorización venció. Volvé a iniciarla desde VISO.");
    await ctx.db.patch("marketplacePaymentOAuthStates", row._id, { consumedAt: Date.now() });
    return row.userId;
  },
});

export const storeAccount = internalMutation({
  args: { userId: v.id("users"), providerUserId: v.string(), encryptedAccessToken: v.string(),
    encryptedRefreshToken: v.optional(v.string()), expiresAt: v.optional(v.number()), retainDisconnected: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const other = await ctx.db.query("marketplacePaymentAccounts").withIndex("by_provider_user", (q) => q.eq("providerUserId", args.providerUserId)).unique();
    if (other && other.userId !== args.userId) marketplaceError("Esta cuenta de cobro ya está vinculada con otro creador.");
    const existing = await ctx.db.query("marketplacePaymentAccounts").withIndex("by_user", (q) => q.eq("userId", args.userId)).unique();
    const { retainDisconnected, ...credentials } = args;
    const values = { ...credentials, provider: "mercadopago" as const, country: "AR",
      status: retainDisconnected && existing?.status === "revoked" ? "revoked" as const : "connected" as const, updatedAt: Date.now() };
    if (existing) await ctx.db.patch("marketplacePaymentAccounts", existing._id, values);
    else await ctx.db.insert("marketplacePaymentAccounts", { ...values, createdAt: Date.now() });
  },
});

export const completeConnection = internalAction({
  args: { code: v.string(), state: v.string() },
  handler: async (ctx, args): Promise<{ returnUrl: string }> => {
    if (!connectionReady() || !/^[a-f0-9]{64}$/.test(args.state) || args.code.length > 2048) {
      marketplaceError("No se pudo comprobar la autorización de Mercado Pago.");
    }
    const userId = await ctx.runMutation(internal.marketplace_payments.consumeOAuthState, { stateHash: await hashPaymentState(args.state) });
    const token = await providerRequest("/oauth/token", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: process.env.MP_APPLICATION_ID, client_secret: process.env.MP_CLIENT_SECRET,
        grant_type: "authorization_code", code: args.code, redirect_uri: callbackUrl() }),
    });
    if (typeof token.access_token !== "string" || !token.access_token || !token.user_id) {
      marketplaceError("Mercado Pago no devolvió una cuenta válida.");
    }
    const profile = await providerRequest("/users/me", { headers: { Authorization: `Bearer ${token.access_token}` } });
    if (String(profile.id) !== String(token.user_id) || (profile.site_id !== "MLA" && profile.country_id !== "AR")) {
      marketplaceError("Esta primera etapa requiere una cuenta de Mercado Pago Argentina.");
    }
    await ctx.runMutation(internal.marketplace_payments.storeAccount, {
      userId, providerUserId: String(token.user_id), encryptedAccessToken: await encryptPaymentToken(token.access_token),
      encryptedRefreshToken: typeof token.refresh_token === "string" ? await encryptPaymentToken(token.refresh_token) : undefined,
      expiresAt: typeof token.expires_in === "number" ? Date.now() + token.expires_in * 1000 : undefined,
    });
    return { returnUrl: `${siteUrl()}/marketplace?view=studio&payment_connection=connected` };
  },
});

export const disconnect = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const account = await ctx.db.query("marketplacePaymentAccounts").withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
    if (account) await ctx.db.patch("marketplacePaymentAccounts", account._id, {
      // Retain encrypted credentials solely for already-created orders. New
      // reservations reject a revoked account, even if its token still works.
      status: "revoked", updatedAt: Date.now(),
    });
    return null;
  },
});

export const reserveOrder = internalMutation({
  args: { productId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const settings = await settingsFor(ctx);
    if (!configured() || !settings?.enabled || !settings.splitApproved || !settings.policiesAccepted) marketplaceError("Los cobros todavía no están habilitados.");
    const product = await paymentProductFor(ctx, args.productId, user._id);
    if (!product || product.priceMode !== "paid" || product.affiliate || product.status !== "published") marketplaceError("Este producto no usa el cobro de VISO.");
    if (product.currency !== "ARS" || !product.priceAmount) marketplaceError("Los cobros de esta etapa son en pesos argentinos.");
    if (product.sellerId === user._id) marketplaceError("No podés comprar tu propio producto.");
    const existing = await ctx.db.query("marketplaceLibrary").withIndex("by_user_product", (q) => q.eq("userId", user._id).eq("productId", args.productId)).unique();
    if (existing) marketplaceError("Este recurso ya está en tu biblioteca.");
    const ownViso = isMarketplaceAdmin(product.sellerId);
    const physical = ["hardware", "new", "used"].includes(product.category);
    if (physical) marketplaceError("El cobro integrado de hardware necesita configurar entrega y garantía. Usá por ahora un enlace de compra externo.");
    const rate = ownViso ? 0 : physical ? settings.hardwareCommissionBps : settings.digitalCommissionBps;
    if (rate === undefined) marketplaceError("Todavía no está definida la comisión para esta categoría.");
    const commissionAmount = commissionFor(product.priceAmount, rate);
    const account = ownViso ? null : await ctx.db.query("marketplacePaymentAccounts").withIndex("by_user", (q) => q.eq("userId", product.sellerId)).unique();
    if (!ownViso && account?.status !== "connected") marketplaceError("El vendedor todavía no vinculó su cuenta de cobro.");
    const sellerProviderUserId = ownViso ? process.env.MP_COLLECTOR_ID : account!.providerUserId;
    if (!sellerProviderUserId) marketplaceError("Falta configurar la cuenta receptora de VISO.");
    const now = Date.now();
    const orderId = await ctx.db.insert("marketplaceOrders", {
      buyerId: user._id, sellerId: product.sellerId, productId: args.productId, title: product.title,
      currency: product.currency, amount: product.priceAmount, commissionBps: rate, commissionAmount,
      sellerAmount: product.priceAmount - commissionAmount, sellerProviderUserId, providerMode: providerMode(),
      productSnapshot: { productId: args.productId, title: product.title, category: product.category,
        creatorName: product.creatorName, delivery: product.delivery, assets: product.assets,
        profileTemplate: product.profileTemplate, pageTemplate: product.pageTemplate, pageSettings: product.pageSettings, revision: product.revision },
      status: "pending", createdAt: now, updatedAt: now,
    });
    return { orderId, amount: product.priceAmount, commissionAmount, title: product.title, ownViso,
      sellerId: product.sellerId, currency: product.currency };
  },
});

export const sellerAccount = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => ctx.db.query("marketplacePaymentAccounts").withIndex("by_user", (q) => q.eq("userId", args.userId)).unique(),
});
export const recordPreference = internalMutation({
  args: { orderId: v.id("marketplaceOrders"), preferenceId: v.string() },
  handler: async (ctx, args) => {
    const order = await ctx.db.get("marketplaceOrders", args.orderId);
    if (!order || order.status !== "pending") marketplaceError("La compra ya no está pendiente.");
    await ctx.db.patch("marketplaceOrders", args.orderId, { preferenceId: args.preferenceId, updatedAt: Date.now() });
  },
});

export const sellerToken = internalAction({
  args: { userId: v.id("users"), allowDisconnected: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<string> => {
    if (isMarketplaceAdmin(args.userId)) {
      if (!process.env.MP_ACCESS_TOKEN) marketplaceError("Falta configurar la cuenta de cobro.");
      return process.env.MP_ACCESS_TOKEN;
    }
    const account = await ctx.runQuery(internal.marketplace_payments.sellerAccount, { userId: args.userId });
    if (!account || (account.status !== "connected" && !args.allowDisconnected)) marketplaceError("El vendedor debe conectar su cuenta de cobro.");
    if (!account.expiresAt || account.expiresAt > Date.now() + 60_000) return decryptPaymentToken(account.encryptedAccessToken);
    if (!account.encryptedRefreshToken) marketplaceError("El vendedor debe volver a conectar su cuenta de cobro.");
    const data = await providerRequest("/oauth/token", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: process.env.MP_APPLICATION_ID, client_secret: process.env.MP_CLIENT_SECRET,
        grant_type: "refresh_token", refresh_token: await decryptPaymentToken(account.encryptedRefreshToken) }),
    });
    if (typeof data.access_token !== "string" || String(data.user_id) !== account.providerUserId) marketplaceError("El vendedor debe volver a conectar su cuenta de cobro.");
    await ctx.runMutation(internal.marketplace_payments.storeAccount, {
      userId: args.userId, providerUserId: account.providerUserId,
      encryptedAccessToken: await encryptPaymentToken(data.access_token),
      encryptedRefreshToken: typeof data.refresh_token === "string" ? await encryptPaymentToken(data.refresh_token) : account.encryptedRefreshToken,
      expiresAt: typeof data.expires_in === "number" ? Date.now() + data.expires_in * 1000 : undefined,
      retainDisconnected: args.allowDisconnected,
    });
    return data.access_token;
  },
});

export const createCheckout = action({
  args: { productId: v.string() },
  handler: async (ctx, args): Promise<{ checkoutUrl: string; orderId: string }> => {
    const order = await ctx.runMutation(internal.marketplace_payments.reserveOrder, args);
    const token = await ctx.runAction(internal.marketplace_payments.sellerToken, { userId: order.sellerId });
    const notify = new URL("/marketplace/payments/webhook", callbackUrl());
    notify.searchParams.set("order_id", order.orderId);
    const returnUrl = `${siteUrl()}/marketplace?view=library&order=${encodeURIComponent(order.orderId)}`;
    const preference = await providerRequest("/checkout/preferences", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json",
        "X-Idempotency-Key": order.orderId },
      body: JSON.stringify({ items: [{ id: args.productId, title: order.title, quantity: 1,
        unit_price: order.amount / 100, currency_id: order.currency }],
        external_reference: order.orderId, notification_url: notify.href,
        back_urls: { success: returnUrl, pending: returnUrl, failure: returnUrl }, auto_return: "approved",
        ...(order.ownViso ? {} : { marketplace_fee: order.commissionAmount / 100 }) }),
    });
    const checkoutUrl = providerMode() === "live" ? preference.init_point : preference.sandbox_init_point;
    if (typeof preference.id !== "string" || typeof checkoutUrl !== "string") marketplaceError("Mercado Pago no devolvió un enlace de pago válido.");
    const checkout = new URL(checkoutUrl);
    if (checkout.protocol !== "https:" || !["www.mercadopago.com.ar", "sandbox.mercadopago.com.ar"].includes(checkout.hostname)) {
      marketplaceError("Mercado Pago no devolvió un enlace de pago válido.");
    }
    await ctx.runMutation(internal.marketplace_payments.recordPreference, { orderId: order.orderId, preferenceId: preference.id });
    return { checkoutUrl, orderId: order.orderId };
  },
});

export const orderForNotification = internalQuery({
  args: { orderId: v.id("marketplaceOrders") },
  handler: async (ctx, args) => ctx.db.get("marketplaceOrders", args.orderId),
});

export const applyVerifiedPayment = internalMutation({
  args: { orderId: v.id("marketplaceOrders"), paymentId: v.string(), amount: v.number(), currency: v.string(),
    collectorId: v.string(), externalReference: v.string(), liveMode: v.boolean(), status: paymentStatus, eventKey: v.string() },
  handler: async (ctx, args) => {
    const order = await ctx.db.get("marketplaceOrders", args.orderId);
    if (!order || args.externalReference !== order._id || args.collectorId !== order.sellerProviderUserId ||
        args.amount !== order.amount || args.currency !== order.currency || args.liveMode !== (order.providerMode === "live")) {
      marketplaceError("El pago no coincide con la compra.");
    }
    const existingPayment = await ctx.db.query("marketplaceOrders").withIndex("by_payment", (q) => q.eq("paymentId", args.paymentId)).unique();
    const attempt = await ctx.db.query("marketplacePaymentAttempts").withIndex("by_payment", (q) => q.eq("paymentId", args.paymentId)).unique();
    const locked = ["approved", "refunded", "charged_back"].includes(order.status);
    if ((existingPayment && existingPayment._id !== order._id) || (attempt && attempt.orderId !== order._id) ||
      (locked && order.paymentId && order.paymentId !== args.paymentId)) {
      marketplaceError("Este pago ya está asociado a otra compra.");
    }
    const processed = await ctx.db.query("marketplacePaymentWebhookEvents").withIndex("by_event", (q) => q.eq("eventKey", args.eventKey)).unique();
    if (processed) return null;
    if (attempt) await ctx.db.patch("marketplacePaymentAttempts", attempt._id, { status: args.status, updatedAt: Date.now() });
    else await ctx.db.insert("marketplacePaymentAttempts", { orderId: order._id, paymentId: args.paymentId, status: args.status, updatedAt: Date.now() });
    // A late pending/rejected notification cannot undo an approved resource.
    const terminal = order.status === "refunded" || order.status === "charged_back";
    const regressive = order.status === "approved" && ["pending", "rejected", "cancelled"].includes(args.status);
    if (!terminal && !regressive) {
      await ctx.db.patch("marketplaceOrders", order._id, {
        status: args.status, paymentId: args.paymentId, updatedAt: Date.now(),
        ...(args.status === "approved" && !order.paidAt ? { paidAt: Date.now() } : {}),
      });
      if (args.status === "approved" && order.productSnapshot && order.productSnapshot.delivery !== "inquiry") {
        await acquireProductSnapshot(ctx, order.buyerId, order.productId, order.productSnapshot, order.productSnapshot.revision, true);
      }
      // Previously downloaded resources cannot be recalled from a device. The
      // order records refunds/chargebacks for support without silently deleting
      // user pages or media; the commercial policy must address these cases.
    }
    await ctx.db.insert("marketplacePaymentWebhookEvents", { eventKey: args.eventKey, processedAt: Date.now() });
    return null;
  },
});

export const processNotification = internalAction({
  args: { orderId: v.id("marketplaceOrders"), paymentId: v.string() },
  handler: async (ctx, args): Promise<null> => {
    const order = await ctx.runQuery(internal.marketplace_payments.orderForNotification, { orderId: args.orderId });
    if (!order || !/^\d{1,30}$/.test(args.paymentId)) marketplaceError("Compra no encontrada.");
    const token = await ctx.runAction(internal.marketplace_payments.sellerToken, { userId: order.sellerId, allowDisconnected: true });
    const data = await providerRequest(`/v1/payments/${args.paymentId}`, { headers: { Authorization: `Bearer ${token}` } });
    const amount = providerAmountToMinor(data.transaction_amount);
    if (String(data.id) !== args.paymentId || amount === null || typeof data.currency_id !== "string" ||
      typeof data.external_reference !== "string" || typeof data.live_mode !== "boolean" || !data.collector_id) {
      marketplaceError("No se pudo comprobar el pago.");
    }
    await ctx.runMutation(internal.marketplace_payments.applyVerifiedPayment, {
      orderId: args.orderId, paymentId: args.paymentId, amount, currency: data.currency_id,
      collectorId: String(data.collector_id), externalReference: data.external_reference,
      liveMode: data.live_mode, status: providerPaymentStatus(data.status),
      eventKey: `${args.paymentId}:${String(data.status)}:${String(data.date_last_updated ?? "")}`,
    });
    return null;
  },
});

export const myOrders = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const orders = await ctx.db.query("marketplaceOrders").withIndex("by_buyer", (q) => q.eq("buyerId", user._id)).order("desc").take(50);
    return orders.map(({ _id, productId, title, currency, amount, status, createdAt, paidAt }) => ({ id: _id, productId, title, currency, amount, status, createdAt, paidAt }));
  },
});
