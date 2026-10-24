import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { requireCurrentUser } from "./lib/current_user";
import { cleanMarketText, marketplaceError } from "./lib/marketplace_validation";
import { isMarketplaceAdmin } from "./marketplace";
import { providerRequest } from "./lib/marketplace_payment_provider";
import { validateStoredTimbreDesign } from "./lib/timbre_access";
import { applyTimbreOrderPayment, licenseIsActive, planBenefit, requireValidTimbreLicense,
  validateDuration, validateMoney, validatePlanBenefits } from "./lib/timbre_commerce";
import { timbreAddress, timbreFeatures, timbreLimits, timbreOfferCode, timbrePeriod,
  timbrePlateStatus, timbrePrintDesign } from "./timbre_commerce_tables";

async function adminUser(ctx: QueryCtx | MutationCtx) {
  const user = await requireCurrentUser(ctx);
  if (!isMarketplaceAdmin(user._id)) marketplaceError("No tenés permiso para administrar Timbre.");
  return user;
}
export async function paymentReadiness(ctx: Pick<QueryCtx, "db">) {
  const settings = await ctx.db.query("marketplacePaymentSettings").withIndex("by_key", (q) => q.eq("key", "mercadopago-ar")).unique();
  return !!(process.env.MP_APPLICATION_ID && process.env.MP_CLIENT_SECRET && process.env.MP_ACCESS_TOKEN &&
    process.env.MP_WEBHOOK_SECRET && process.env.MP_TOKEN_ENCRYPTION_KEY && process.env.MP_COLLECTOR_ID &&
    process.env.MP_MODE === "live" &&
    settings?.enabled && settings.splitApproved && settings.policiesAccepted);
}
const offers = [
  { code: "digital" as const, title: "Timbre Digital", description: "Un QR para comunicar visitas con tu cuenta VISO, según las funciones y límites del plan." },
  { code: "personalizado" as const, title: "Timbre VISO Personalizado", description: "Tu diseño en una placa física. Material, entrega y licencia incluida se informan antes de comprar." },
  { code: "hardware" as const, title: "Timbre con Hardware VISO", description: "Incluido únicamente con los productos y variantes que indiquen expresamente una licencia Timbre." },
  { code: "edificios" as const, title: "Timbre Edificios", description: "Licencias para consorcios, unidades y oficinas, con límites comerciales configurados." },
];

export const catalog = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await requireCurrentUser(ctx);
    const [plans, variants, shipping, hardware, paymentsReady] = await Promise.all([
      ctx.db.query("timbrePlans").collect(), ctx.db.query("timbrePlateVariants").collect(),
      ctx.db.query("timbreShippingOptions").collect(), ctx.db.query("timbreHardwareEligibility").collect(), paymentReadiness(ctx),
    ]);
    const visibleHardware = (await Promise.all(hardware.filter((x) => x.enabled).map(async (mapping) => {
      const id = ctx.db.normalizeId("marketplaceProducts", mapping.productId);
      const product = id ? await ctx.db.get("marketplaceProducts", id) : null;
      return product?.status === "published" && ["hardware", "new"].includes(product.category) && !product.affiliate &&
        isMarketplaceAdmin(product.userId) && plans.some((x) => x._id === mapping.planId && x.enabled)
        ? { productId: mapping.productId, planId: mapping.planId, title: product.title } : null;
    }))).filter((x): x is NonNullable<typeof x> => x !== null);
    return offers.map((offer) => {
      const offerPlans = plans.filter((p) => p.enabled && p.code === offer.code).map((p) => ({
        id: p._id, name: p.name, description: p.description, priceAmount: p.priceAmount ?? null,
        currency: p.currency, period: p.period, durationDays: p.durationDays ?? null, features: p.features, limits: p.limits,
        buyable: paymentsReady && ["digital", "edificios"].includes(p.code) &&
          (p.period === "one_time" || process.env.TIMBRE_RECURRING_ENABLED === "true") && p.currency === "ARS" && !!p.priceAmount && isMarketplaceAdmin(p.sellerId) && p.sellerId !== currentUser._id,
      }));
      const activeVariants = offer.code === "personalizado" ? variants.filter((x) => x.enabled).map((x) => ({
        id: x._id, name: x.name, material: x.material, widthMm: x.widthMm, heightMm: x.heightMm,
        priceAmount: x.priceAmount ?? null, currency: x.currency, availability: x.availability,
        warranty: x.warranty, includedPlanId: x.includedPlanId ?? null,
        buyable: paymentsReady && x.availability === "available" && !!x.priceAmount && x.currency === "ARS" && !!x.warranty && !!x.productionNotes &&
          (!x.includedPlanId || plans.some((p) => p._id === x.includedPlanId && p.enabled)) &&
          shipping.some((s) => s.enabled && s.currency === x.currency) && isMarketplaceAdmin(x.sellerId) && x.sellerId !== currentUser._id,
      })) : [];
      const eligibleProducts = offer.code === "hardware" ? visibleHardware : [];
      const configured = offerPlans.some((x) => x.priceAmount !== null) || activeVariants.some((x) => x.priceAmount !== null) || eligibleProducts.length > 0;
      const buyable = offerPlans.some((x) => x.buyable) || activeVariants.some((x) => x.buyable);
      return { ...offer, configured, buyable, plans: offerPlans, variants: activeVariants, eligibleProducts,
        blockReason: buyable ? null : !configured ? "Pendiente de configuración comercial" : process.env.MP_MODE !== "live" ? "El modo de prueba no activa licencias Timbre" : !paymentsReady ? "Cobros todavía no habilitados" :
          offer.code === "hardware" ? "La licencia se incluye con una compra elegible verificada" : "La contratación recurrente requiere completar la integración de suscripciones" };
    });
  },
});

export const myLicenses = query({
  args: {}, handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const licenses = await ctx.db.query("timbreLicenses").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).collect();
    return licenses.map((license) => ({ ...license, active: licenseIsActive(license) }));
  },
});
// Convenience for account navigation. Site authorization always uses its exact licenseId.
export const myLicense = query({
  args: {}, handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const licenses = await ctx.db.query("timbreLicenses").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).collect();
    const license = licenses.find((x) => licenseIsActive(x));
    return license ? { active: true, license, licenses, reason: null } : { active: false, license: null, licenses, reason: "Necesitás contratar Timbre o activar una compra elegible." };
  },
});

export const savePlan = mutation({
  args: { id: v.optional(v.id("timbrePlans")), code: timbreOfferCode, name: v.string(), description: v.string(),
    enabled: v.boolean(), priceAmount: v.optional(v.number()), currency: v.union(v.literal("ARS"), v.literal("USD")),
    period: timbrePeriod, durationDays: v.optional(v.number()), features: timbreFeatures, limits: timbreLimits },
  handler: async (ctx, args) => {
    const admin = await adminUser(ctx); validateMoney(args.priceAmount); validateDuration(args.durationDays); validatePlanBenefits(args.features, args.limits);
    const existing = args.id ? await ctx.db.get("timbrePlans", args.id) : null;
    if (args.id && !existing) marketplaceError("No se encontró el plan.");
    const { id: _id, ...fields } = args; void _id;
    const values = { ...fields, name: cleanMarketText(args.name, 120, "Nombre"), description: cleanMarketText(args.description, 3000, "Descripción"),
      sellerId: existing?.sellerId ?? admin._id, updatedAt: Date.now() };
    if (existing) { await ctx.db.replace("timbrePlans", existing._id, { ...values, createdAt: existing.createdAt }); return existing._id; }
    return ctx.db.insert("timbrePlans", { ...values, createdAt: Date.now() });
  },
});

export const saveHardwareEligibility = mutation({
  args: { productId: v.string(), planId: v.id("timbrePlans"), enabled: v.boolean(), durationDays: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const admin = await adminUser(ctx); validateDuration(args.durationDays);
    const productId = cleanMarketText(args.productId, 200, "Producto");
    const product = ctx.db.normalizeId("marketplaceProducts", productId);
    const row = product ? await ctx.db.get("marketplaceProducts", product) : null;
    if (!row || !["hardware", "new"].includes(row.category) || row.affiliate || row.userId !== admin._id) {
      marketplaceError("Elegí un producto físico VISO propio, publicado por este administrador y sin enlaces de afiliado.");
    }
    if (!await ctx.db.get("timbrePlans", args.planId)) marketplaceError("No se encontró el plan.");
    const existing = await ctx.db.query("timbreHardwareEligibility").withIndex("by_product", (q) => q.eq("productId", productId)).unique();
    const values = { ...args, productId, updatedBy: admin._id, updatedAt: Date.now() };
    if (existing) { await ctx.db.replace("timbreHardwareEligibility", existing._id, values); return existing._id; }
    return ctx.db.insert("timbreHardwareEligibility", values);
  },
});

export const saveDiscount = mutation({
  args: { id: v.optional(v.id("timbreDiscounts")), code: v.string(), planIds: v.array(v.id("timbrePlans")), percentBps: v.number(), enabled: v.boolean(),
    startsAt: v.number(), expiresAt: v.number(), maxRedemptions: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const admin = await adminUser(ctx); const code = args.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,40}$/.test(code) || !Number.isSafeInteger(args.percentBps) || args.percentBps < 1 || args.percentBps >= 10_000) {
      marketplaceError("Usá un código válido y un descuento entre 0,01% y 99,99%; Timbre requiere una compra paga.");
    }
    if (!Number.isFinite(args.startsAt) || !Number.isFinite(args.expiresAt) || args.expiresAt <= args.startsAt ||
      !args.planIds.length || args.planIds.length > 100 || (args.maxRedemptions !== undefined && (!Number.isSafeInteger(args.maxRedemptions) || args.maxRedemptions < 1))) marketplaceError("Revisá la vigencia, los planes y el límite del descuento.");
    for (const planId of args.planIds) if (!await ctx.db.get("timbrePlans", planId)) marketplaceError("No se encontró un plan.");
    const duplicate = await ctx.db.query("timbreDiscounts").withIndex("by_code", (q) => q.eq("code", code)).unique();
    if (duplicate && duplicate._id !== args.id) marketplaceError("Ese código ya existe.");
    const existing = args.id ? await ctx.db.get("timbreDiscounts", args.id) : null;
    if (args.id && !existing) marketplaceError("No se encontró el descuento.");
    const { id: _id, ...fields } = args; void _id;
    const values = { ...fields, code, redemptions: existing?.redemptions ?? 0, updatedBy: admin._id, updatedAt: Date.now() };
    if (existing) { await ctx.db.replace("timbreDiscounts", existing._id, values); return existing._id; }
    return ctx.db.insert("timbreDiscounts", values);
  },
});

export async function createServiceOrder(ctx: MutationCtx, ownerId: Id<"users">, sellerId: Id<"users">, productId: string, title: string,
  amount: number, currency: string, physical = false) {
  validateMoney(amount);
  if (!await paymentReadiness(ctx)) marketplaceError("Los cobros todavía no están habilitados.");
  if (!isMarketplaceAdmin(sellerId) || !process.env.MP_COLLECTOR_ID || currency !== "ARS") marketplaceError("La cuenta receptora y el cobro en pesos deben estar configurados.");
  if (ownerId === sellerId) marketplaceError("No podés comprar tu propio producto.");
  return ctx.db.insert("marketplaceOrders", { buyerId: ownerId, sellerId, productId, title, currency, amount, commissionBps: 0,
    commissionAmount: 0, sellerAmount: amount, sellerProviderUserId: process.env.MP_COLLECTOR_ID,
    providerMode: process.env.MP_MODE === "live" ? "live" : "test", status: "pending", createdAt: Date.now(), updatedAt: Date.now(),
    productSnapshot: { productId, title, category: physical ? "hardware" : "plugins", creatorName: "VISO", delivery: "inquiry", assets: [] } });
}

export const reservePlanOrder = internalMutation({
  args: { planId: v.id("timbrePlans"), coupon: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx); const plan = await ctx.db.get("timbrePlans", args.planId);
    if (!plan?.enabled || !plan.priceAmount || plan.code === "hardware" || plan.code === "personalizado") marketplaceError("Este plan no está disponible para compra digital.");
    if (plan.period !== "one_time") marketplaceError("La contratación mensual o anual necesita completar la integración recurrente de Mercado Pago. No se cobrará ni activará una licencia.");
    let amount = plan.priceAmount; let discountId: Id<"timbreDiscounts"> | undefined;
    if (args.coupon) {
      const code = args.coupon.trim().toUpperCase();
      const discount = await ctx.db.query("timbreDiscounts").withIndex("by_code", (q) => q.eq("code", code)).unique();
      const now = Date.now();
      if (!discount?.enabled || discount.startsAt > now || discount.expiresAt <= now || !discount.planIds.includes(plan._id)) marketplaceError("El cupón no es válido para este plan.");
      const reservations = await ctx.db.query("timbreOrderBenefits").withIndex("by_discount", (q) => q.eq("discountId", discount._id)).collect();
      // A pending provider preference may still be paid. Do not release its
      // limited coupon allocation based only on local elapsed time.
      const pending = reservations.filter((x) => x.state === "pending").length;
      if (discount.maxRedemptions !== undefined && discount.redemptions + pending >= discount.maxRedemptions) marketplaceError("El cupón alcanzó su límite de usos.");
      amount = Math.max(1, amount - Math.floor(amount * discount.percentBps / 10_000)); discountId = discount._id;
    }
    const orderId = await createServiceOrder(ctx, user._id, plan.sellerId, `timbre:plan:${plan._id}`, plan.name, amount, plan.currency);
    await ctx.db.insert("timbreOrderBenefits", { orderId, ownerId: user._id, ...planBenefit(plan),
      source: plan.code === "edificios" ? "building_contract" : "one_time_purchase", state: "pending", discountId, createdAt: Date.now(), updatedAt: Date.now() });
    return { orderId, sellerId: plan.sellerId, title: plan.name, amount, currency: plan.currency };
  },
});

export const createCheckout = action({
  args: { planId: v.id("timbrePlans"), coupon: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ checkoutUrl: string; orderId: Id<"marketplaceOrders"> }> => {
    const order = await ctx.runMutation(internal.timbre_commerce.reservePlanOrder, args);
    return checkoutPreference(ctx, order);
  },
});

export async function checkoutPreference(ctx: Pick<ActionCtx, "runAction" | "runMutation">,
  order: { orderId: Id<"marketplaceOrders">; sellerId: Id<"users">; title: string; amount: number; currency: string },
  destination?: { origin: string | undefined; returnPath: string }) {
  let origin: URL; let webhook: URL;
  try {
    origin = new URL(destination ? destination.origin ?? "" : process.env.SITE_URL ?? ""); webhook = new URL(process.env.CONVEX_SITE_URL ?? "");
    if ([origin, webhook].some((url) => url.protocol !== "https:" || url.username || url.password)) throw new Error();
  } catch { return marketplaceError("Falta configurar las direcciones de VISO."); }
  const token = await ctx.runAction(internal.marketplace_payments.sellerToken, { userId: order.sellerId });
  const result = await providerRequest("/checkout/preferences", { method: "POST", headers: {
    "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Idempotency-Key": order.orderId,
  }, body: JSON.stringify({ items: [{ id: order.orderId, title: order.title, quantity: 1, unit_price: order.amount / 100, currency_id: order.currency }],
    external_reference: order.orderId, notification_url: `${webhook.origin}/marketplace/payments/webhook?order_id=${order.orderId}`,
    back_urls: { success: `${origin.origin}${destination?.returnPath ?? "/marketplace"}?order=${order.orderId}`, pending: `${origin.origin}${destination?.returnPath ?? "/marketplace"}?order=${order.orderId}`, failure: `${origin.origin}${destination?.returnPath ?? "/marketplace"}?order=${order.orderId}` }, auto_return: "approved" }) });
  const value = process.env.MP_MODE === "live" ? result.init_point : result.sandbox_init_point;
  if (typeof result.id !== "string" || typeof value !== "string") marketplaceError("Mercado Pago no devolvió un enlace de compra.");
  let url: URL; try { url = new URL(value); } catch { return marketplaceError("El enlace de compra no es válido."); }
  if (url.protocol !== "https:" || url.username || url.password || !["www.mercadopago.com.ar", "sandbox.mercadopago.com.ar"].includes(url.hostname)) marketplaceError("El enlace de compra no es válido.");
  await ctx.runMutation(internal.marketplace_payments.recordPreference, { orderId: order.orderId, preferenceId: result.id });
  return { checkoutUrl: url.href, orderId: order.orderId };
}

export const requestSubscription = mutation({
  args: { planId: v.id("timbrePlans") }, handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx); const plan = await ctx.db.get("timbrePlans", args.planId);
    if (!plan?.enabled || !plan.priceAmount || plan.period === "one_time") marketplaceError("Elegí un plan mensual o anual configurado.");
    const existing = await ctx.db.query("timbreSubscriptions").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).collect();
    const pending = existing.find((x) => x.planId === plan._id && x.status === "pending_external");
    const id = pending?._id ?? await ctx.db.insert("timbreSubscriptions", { ownerId: user._id, planId: plan._id,
      planSnapshot: { name: plan.name, priceAmount: plan.priceAmount, currency: plan.currency, period: plan.period,
        durationDays: plan.durationDays, features: plan.features, limits: plan.limits },
      status: "pending_external", createdAt: Date.now(), updatedAt: Date.now() });
    return { id, status: "pending_external" as const, activated: false, message: "Solicitud registrada. Falta completar el proveedor recurrente; no hay cobro ni licencia activada." };
  },
});

export const cancelSubscription = mutation({
  args: { id: v.id("timbreSubscriptions") }, handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx); const row = await ctx.db.get("timbreSubscriptions", args.id);
    if (!row || row.ownerId !== user._id) marketplaceError("No se encontró la suscripción.");
    // Never claim a provider-side cancellation that has not actually happened.
    await ctx.db.patch("timbreSubscriptions", row._id, { cancelRequestedAt: Date.now(), updatedAt: Date.now(),
      ...(row.status === "pending_external" && !row.providerReference ? { status: "cancelled" as const } : {}) });
    return { providerCancellationPending: !!row.providerReference };
  },
});

export const revokeLicense = mutation({
  args: { id: v.id("timbreLicenses"), reason: v.string() }, handler: async (ctx, args) => {
    await adminUser(ctx); const row = await ctx.db.get("timbreLicenses", args.id);
    if (!row) marketplaceError("No se encontró la licencia.");
    await ctx.db.patch("timbreLicenses", row._id, { status: "revoked", revokedByAdmin: true, revocationReason: cleanMarketText(args.reason, 500, "Motivo"), revokedAt: Date.now(), updatedAt: Date.now() });
    return null;
  },
});

export const recordPaidContract = mutation({
  args: { ownerId: v.id("users"), planId: v.id("timbrePlans"), reference: v.string(), amount: v.number(),
    currency: v.union(v.literal("ARS"), v.literal("USD")), paidAt: v.number() },
  handler: async (ctx, args) => {
    const admin = await adminUser(ctx); validateMoney(args.amount);
    if (!Number.isFinite(args.paidAt) || args.paidAt > Date.now() || args.paidAt <= 0) marketplaceError("Indicá la fecha real del pago confirmado.");
    const reference = cleanMarketText(args.reference, 200, "Referencia de pago confirmado");
    const previous = await ctx.db.query("timbreExternalPayments").withIndex("by_reference", (q) => q.eq("reference", reference)).unique();
    if (previous) {
      if (previous.ownerId !== args.ownerId || previous.planId !== args.planId || previous.amount !== args.amount || previous.currency !== args.currency) marketplaceError("La referencia ya corresponde a otro pago.");
      return previous.licenseId;
    }
    const plan = await ctx.db.get("timbrePlans", args.planId);
    if (!plan?.enabled || !await ctx.db.get("users", args.ownerId)) marketplaceError("No se encontró el usuario o el plan activo.");
    if (plan.period !== "one_time" && plan.durationDays === undefined) marketplaceError("Configurá la duración del período pagado antes de registrar una suscripción externa.");
    const now = Date.now();
    const licenseId = await ctx.db.insert("timbreLicenses", { ownerId: args.ownerId, planId: plan._id, planName: plan.name,
      status: "active", startsAt: args.paidAt, expiresAt: plan.durationDays === undefined ? undefined : args.paidAt + plan.durationDays * 86_400_000,
      source: "building_contract", sourceReference: `external:${reference}`, features: plan.features, limits: plan.limits, createdAt: now, updatedAt: now });
    await ctx.db.insert("timbreExternalPayments", { ...args, reference, recordedBy: admin._id, licenseId, createdAt: now });
    return licenseId;
  },
});

export const savePlateVariant = mutation({
  args: { id: v.optional(v.id("timbrePlateVariants")), name: v.string(), material: v.string(), widthMm: v.number(), heightMm: v.number(), enabled: v.boolean(),
    priceAmount: v.optional(v.number()), currency: v.union(v.literal("ARS"), v.literal("USD")),
    availability: v.union(v.literal("unconfigured"), v.literal("available"), v.literal("unavailable")),
    productionNotes: v.string(), warranty: v.string(), includedPlanId: v.optional(v.id("timbrePlans")) },
  handler: async (ctx, args) => {
    const admin = await adminUser(ctx); validateMoney(args.priceAmount); dimensions(args.widthMm, args.heightMm);
    if (args.includedPlanId && !await ctx.db.get("timbrePlans", args.includedPlanId)) marketplaceError("No se encontró la licencia incluida.");
    if (args.availability === "available" && (!args.priceAmount || !args.warranty.trim() || !args.productionNotes.trim())) marketplaceError("Configurá precio, garantía y producción antes de ofrecer la placa.");
    const existing = args.id ? await ctx.db.get("timbrePlateVariants", args.id) : null;
    if (args.id && !existing) marketplaceError("No se encontró la variante.");
    const { id: _id, ...fields } = args; void _id;
    const values = { ...fields, name: cleanMarketText(args.name, 120, "Nombre"), material: cleanMarketText(args.material, 120, "Material"),
      productionNotes: args.productionNotes.trim().slice(0, 3000), warranty: args.warranty.trim().slice(0, 3000), sellerId: existing?.sellerId ?? admin._id, updatedAt: Date.now() };
    if (existing) { await ctx.db.replace("timbrePlateVariants", existing._id, values); return existing._id; }
    return ctx.db.insert("timbrePlateVariants", values);
  },
});
function dimensions(width: number, height: number) {
  if (![width, height].every((value) => Number.isFinite(value) && value >= 50 && value <= 300) || Math.max(width, height) / Math.min(width, height) > 2.8) marketplaceError("Las dimensiones deben estar entre 50 y 300 mm, con una proporción máxima de 2,8:1.");
}

export const saveShippingOption = mutation({
  args: { id: v.optional(v.id("timbreShippingOptions")), name: v.string(), country: v.string(), regions: v.array(v.string()),
    enabled: v.boolean(), priceAmount: v.number(), currency: v.union(v.literal("ARS"), v.literal("USD")), terms: v.string() },
  handler: async (ctx, args) => {
    const admin = await adminUser(ctx); validateMoney(args.priceAmount, true);
    const country = args.country.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(country) || args.regions.length > 100) marketplaceError("Indicá país ISO y zonas de entrega válidas.");
    const existing = args.id ? await ctx.db.get("timbreShippingOptions", args.id) : null;
    if (args.id && !existing) marketplaceError("No se encontró el envío.");
    const { id: _id, ...fields } = args; void _id;
    const values = { ...fields, country, name: cleanMarketText(args.name, 120, "Envío"), terms: cleanMarketText(args.terms, 3000, "Condiciones de entrega"),
      regions: args.regions.map((x) => cleanMarketText(x, 100, "Zona")), updatedBy: admin._id, updatedAt: Date.now() };
    if (existing) { await ctx.db.replace("timbreShippingOptions", existing._id, values); return existing._id; }
    return ctx.db.insert("timbreShippingOptions", values);
  },
});

export const shippingOptions = query({ args: {}, handler: async (ctx) => {
  await requireCurrentUser(ctx); return (await ctx.db.query("timbreShippingOptions").collect()).filter((x) => x.enabled).map(({ updatedBy: _admin, ...x }) => { void _admin; return x; });
} });

async function ownProductionQr(ctx: Pick<QueryCtx, "db">, qrId: Id<"timbreQrs">, ownerId: Id<"users">) {
  const qr = await ctx.db.get("timbreQrs", qrId); const site = qr ? await ctx.db.get("timbreSites", qr.siteId) : null;
  if (!qr || !site || site.ownerId !== ownerId || qr.revokedAt || !qr.enabled) marketplaceError("Elegí un QR activo de tu cuenta.");
  await requireValidTimbreLicense(ctx, site.licenseId, ownerId); return qr;
}

export const createPlateOrder = mutation({
  args: { variantId: v.id("timbrePlateVariants"), qrId: v.optional(v.id("timbreQrs")), design: timbrePrintDesign,
    shippingOptionId: v.id("timbreShippingOptions"), shippingAddress: timbreAddress },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx); const variant = await ctx.db.get("timbrePlateVariants", args.variantId);
    validateStoredTimbreDesign(args.design);
    const shipping = await ctx.db.get("timbreShippingOptions", args.shippingOptionId);
    if (!variant?.enabled || variant.availability !== "available" || !variant.priceAmount || !variant.warranty || !variant.productionNotes || !isMarketplaceAdmin(variant.sellerId)) marketplaceError("La placa todavía no está disponible para comprar.");
    if (!shipping?.enabled || shipping.currency !== variant.currency || shipping.country !== args.shippingAddress.country.toUpperCase() ||
      (shipping.regions.length > 0 && !shipping.regions.some((x) => x.toLowerCase() === args.shippingAddress.region.trim().toLowerCase()))) marketplaceError("Elegí un envío disponible para tu dirección.");
    if (args.design.widthMm !== variant.widthMm || args.design.heightMm !== variant.heightMm) marketplaceError("El diseño debe tener las dimensiones de la variante elegida.");
    let includedBenefit: Doc<"timbrePlateOrders">["includedBenefit"];
    if (variant.includedPlanId) {
      const plan = await ctx.db.get("timbrePlans", variant.includedPlanId);
      if (!plan?.enabled) marketplaceError("La licencia incluida no está disponible.");
      includedBenefit = planBenefit(plan);
    }
    const qr = args.qrId ? await ownProductionQr(ctx, args.qrId, user._id) : null;
    if (!qr && !includedBenefit) marketplaceError("Elegí tu QR o una placa que incluya expresamente una licencia.");
    const shippingAddress = { ...args.shippingAddress, country: args.shippingAddress.country.toUpperCase() };
    for (const field of ["name", "street", "city", "region", "postalCode", "phone"] as const) shippingAddress[field] = cleanMarketText(shippingAddress[field], 200, "Dirección de entrega");
    if ((shippingAddress.notes?.length ?? 0) > 1000) marketplaceError("Las notas de entrega son demasiado largas.");
    const { imageDataUrl: _image, ...designSummary } = args.design; void _image;
    const plateId = await ctx.db.insert("timbrePlateOrders", { ownerId: user._id, qrId: args.qrId, qrTokenSnapshot: qr?.token, variantId: variant._id,
      variant: { name: variant.name, material: variant.material, widthMm: variant.widthMm, heightMm: variant.heightMm,
        warranty: variant.warranty, productionNotes: variant.productionNotes, priceAmount: variant.priceAmount, currency: variant.currency },
      design: designSummary, shippingAddress, shipping: { optionId: shipping._id, name: shipping.name, priceAmount: shipping.priceAmount, terms: shipping.terms },
      amount: variant.priceAmount + shipping.priceAmount, currency: variant.currency, status: "draft", includedPlanId: variant.includedPlanId,
      includedBenefit, createdAt: Date.now(), updatedAt: Date.now() });
    await ctx.db.insert("timbrePlateDesigns", { orderId: plateId, design: args.design, createdAt: Date.now() });
    return plateId;
  },
});

export const reservePlateOrder = internalMutation({
  args: { id: v.id("timbrePlateOrders") }, handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx); const plate = await ctx.db.get("timbrePlateOrders", args.id);
    if (!plate || plate.ownerId !== user._id || !["draft", "pending_payment"].includes(plate.status)) marketplaceError("No se encontró un pedido pendiente de tu cuenta.");
    const variant = await ctx.db.get("timbrePlateVariants", plate.variantId);
    if (!variant?.enabled || variant.availability !== "available") marketplaceError("La variante ya no está disponible. Creá un nuevo pedido.");
    if (plate.marketplaceOrderId) {
      const previous = await ctx.db.get("marketplaceOrders", plate.marketplaceOrderId);
      if (!previous || !["pending", "rejected"].includes(previous.status)) marketplaceError("La compra ya no está pendiente.");
      if (!await paymentReadiness(ctx)) marketplaceError("Los cobros todavía no están habilitados.");
      return { orderId: previous._id, sellerId: previous.sellerId, title: previous.title, amount: previous.amount, currency: previous.currency };
    }
    const orderId = await createServiceOrder(ctx, user._id, variant.sellerId, `timbre:plate:${plate._id}`, plate.variant.name, plate.amount, plate.currency, true);
    await ctx.db.patch("timbrePlateOrders", plate._id, { marketplaceOrderId: orderId, status: "pending_payment", updatedAt: Date.now() });
    if (plate.includedBenefit) await ctx.db.insert("timbreOrderBenefits", { orderId, ownerId: user._id, ...plate.includedBenefit,
      source: "hardware_bundle", state: "pending", createdAt: Date.now(), updatedAt: Date.now() });
    return { orderId, sellerId: variant.sellerId, title: plate.variant.name, amount: plate.amount, currency: plate.currency };
  },
});
export const createPlateCheckout = action({
  args: { id: v.id("timbrePlateOrders") }, handler: async (ctx, args): Promise<{ checkoutUrl: string; orderId: Id<"marketplaceOrders"> }> => {
    const order = await ctx.runMutation(internal.timbre_commerce.reservePlateOrder, args); return checkoutPreference(ctx, order);
  },
});

export const attachPlateQr = mutation({
  args: { id: v.id("timbrePlateOrders"), qrId: v.id("timbreQrs") }, handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx); const plate = await ctx.db.get("timbrePlateOrders", args.id);
    if (!plate || plate.ownerId !== user._id || !["draft", "pending_payment", "paid"].includes(plate.status)) marketplaceError("Este pedido no permite cambiar el QR.");
    const qr = await ownProductionQr(ctx, args.qrId, user._id);
    const changed = plate.qrId !== args.qrId || plate.qrTokenSnapshot !== qr.token;
    await ctx.db.patch("timbrePlateOrders", plate._id, { qrId: args.qrId, qrTokenSnapshot: qr.token, updatedAt: Date.now(),
      ...(changed ? { productionFileId: undefined, productionFileName: undefined, productionFileSha256: undefined, productionQrToken: undefined } : {}) }); return null;
  },
});

export const myPlateOrders = query({ args: {}, handler: async (ctx) => {
  const user = await requireCurrentUser(ctx); return ctx.db.query("timbrePlateOrders").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).order("desc").take(100);
} });
export const adminOverview = query({ args: {}, handler: async (ctx) => {
  const admin = await adminUser(ctx); const [plans, variants, shippingOptions, orders, hardware, discounts, subscriptions, licenses, externalPayments, products] = await Promise.all([
    ctx.db.query("timbrePlans").take(100), ctx.db.query("timbrePlateVariants").take(100), ctx.db.query("timbreShippingOptions").take(100),
    ctx.db.query("timbrePlateOrders").order("desc").take(100), ctx.db.query("timbreHardwareEligibility").take(100),
    ctx.db.query("timbreDiscounts").take(100), ctx.db.query("timbreSubscriptions").order("desc").take(100),
    ctx.db.query("timbreLicenses").order("desc").take(100), ctx.db.query("timbreExternalPayments").order("desc").take(100),
    ctx.db.query("marketplaceProducts").withIndex("by_user", (q) => q.eq("userId", admin._id)).take(500),
  ]); return { plans, variants, shippingOptions, orders, hardware, discounts, subscriptions, licenses, externalPayments,
    products: products.filter((x) => ["hardware", "new"].includes(x.category) && !x.affiliate).map((x) => ({ id: x._id, title: x.title })) };
} });

export const adminSearchUsers = query({ args: { query: v.string() }, handler: async (ctx, args) => {
  await adminUser(ctx); const email = args.query.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !email.includes("@")) return [];
  // Exact email only: no public user enumeration or broad customer export.
  const rows = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", email)).take(10);
  return rows.map((x) => ({ id: x._id, email: x.email, name: x.name ?? null }));
} });

export const generateProductionUploadUrl = mutation({ args: {}, handler: async (ctx) => { await adminUser(ctx); return ctx.storage.generateUploadUrl(); } });
export const recordProductionFile = mutation({
  args: { id: v.id("timbrePlateOrders"), storageId: v.id("_storage"), fileName: v.string(), expectedQrToken: v.string() }, handler: async (ctx, args) => {
    await adminUser(ctx); const plate = await ctx.db.get("timbrePlateOrders", args.id);
    if (!plate || plate.status !== "paid" || !plate.qrId) marketplaceError("El pedido debe estar pagado y tener un QR antes de producir; el archivo queda inmovilizado al iniciar producción.");
    const qr = await ownProductionQr(ctx, plate.qrId, plate.ownerId);
    if (!plate.qrTokenSnapshot || args.expectedQrToken !== plate.qrTokenSnapshot || qr.token !== plate.qrTokenSnapshot) marketplaceError("El QR cambió desde la vista previa. Volvé a adjuntarlo y generá el archivo nuevamente.");
    const metadata = await ctx.db.system.get("_storage", args.storageId);
    if (!metadata || metadata.size > 25 * 1024 * 1024 || !["application/pdf", "image/svg+xml", "image/png"].includes(metadata.contentType ?? "")) marketplaceError("Subí un PDF, SVG o PNG de producción de hasta 25 MB.");
    await ctx.db.patch("timbrePlateOrders", plate._id, { productionFileId: args.storageId,
      productionFileName: cleanMarketText(args.fileName, 200, "Archivo"), productionFileSha256: metadata.sha256,
      productionQrToken: plate.qrTokenSnapshot, updatedAt: Date.now() }); return null;
  },
});
export const adminUpdatePlateOrder = mutation({
  args: { id: v.id("timbrePlateOrders"), status: timbrePlateStatus, carrier: v.optional(v.string()), trackingReference: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await adminUser(ctx); const plate = await ctx.db.get("timbrePlateOrders", args.id);
    if (!plate) marketplaceError("No se encontró el pedido.");
    const transitions: Record<string, string[]> = { draft: ["cancelled"], paid: ["production"], production: ["ready"], ready: ["shipped"], shipped: ["delivered"] };
    if (!transitions[plate.status]?.includes(args.status)) marketplaceError("Ese cambio de pedido no está permitido. Los pagos y reintegros se confirman con Mercado Pago.");
    if (["production", "ready", "shipped", "delivered"].includes(args.status)) {
      const order = plate.marketplaceOrderId ? await ctx.db.get("marketplaceOrders", plate.marketplaceOrderId) : null;
      if (!order || order.status !== "approved" || !order.paidAt || !plate.productionFileId || !plate.qrId) marketplaceError("Falta confirmar el pago, el QR o el archivo de producción.");
      const qr = await ownProductionQr(ctx, plate.qrId, plate.ownerId);
      const file = await ctx.db.system.get("_storage", plate.productionFileId);
      if (qr.token !== plate.qrTokenSnapshot || plate.productionQrToken !== plate.qrTokenSnapshot || !file || file.sha256 !== plate.productionFileSha256) marketplaceError("El QR o el archivo cambió desde la aprobación de producción.");
    }
    if (args.status === "shipped" && (!args.carrier?.trim() || !args.trackingReference?.trim())) marketplaceError("Registrá transportista y seguimiento reales antes de despachar.");
    await ctx.db.patch("timbrePlateOrders", plate._id, { status: args.status, updatedAt: Date.now(),
      ...(args.carrier ? { carrier: cleanMarketText(args.carrier, 120, "Transportista") } : {}),
      ...(args.trackingReference ? { trackingReference: cleanMarketText(args.trackingReference, 200, "Seguimiento") } : {}) }); return null;
  },
});

export const productionExport = query({
  args: { id: v.id("timbrePlateOrders") }, handler: async (ctx, args) => {
    await adminUser(ctx); const plate = await ctx.db.get("timbrePlateOrders", args.id);
    if (!plate || !["paid", "production", "ready", "shipped", "delivered"].includes(plate.status) || !plate.qrId) marketplaceError("No hay un pedido pagado con QR para exportar.");
    const qr = await ownProductionQr(ctx, plate.qrId, plate.ownerId);
    if (!plate.qrTokenSnapshot || qr.token !== plate.qrTokenSnapshot) marketplaceError("El QR cambió. Adjuntá su versión actual y regenerá el archivo antes de producir.");
    const stored = await ctx.db.query("timbrePlateDesigns").withIndex("by_order", (q) => q.eq("orderId", plate._id)).unique();
    return { orderId: plate._id, design: stored?.design ?? plate.design, variant: plate.variant, qrToken: plate.qrTokenSnapshot,
      print: { minimumDpi: 300, quietZoneModules: 4, widthMm: plate.variant.widthMm, heightMm: plate.variant.heightMm },
      fileUrl: plate.productionFileId ? await ctx.storage.getUrl(plate.productionFileId) : null };
  },
});

// Administrative reconciliation for an already verified, approved hardware
// order. It cannot approve a pending order or infer eligibility from ownership.
export const reconcileHardwareLicense = mutation({
  args: { orderId: v.id("marketplaceOrders") }, handler: async (ctx, args) => {
    await adminUser(ctx); const order = await ctx.db.get("marketplaceOrders", args.orderId);
    if (!order || order.status !== "approved" || !order.paidAt || !order.paymentId || order.amount <= 0) marketplaceError("El pedido debe tener un pago confirmado y aprobado.");
    const benefit = await ctx.db.query("timbreOrderBenefits").withIndex("by_order", (q) => q.eq("orderId", order._id)).unique();
    if (!benefit || benefit.source !== "hardware_bundle") marketplaceError("La compra no incluía una licencia Timbre configurada al reservarla.");
    await applyTimbreOrderPayment(ctx, order, "approved"); return null;
  },
});
