import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireCurrentUser } from "./lib/current_user";
import { isMarketplaceAdmin } from "./marketplace";
import { marketplaceError } from "./lib/marketplace_validation";
import { providerRequest } from "./lib/marketplace_payment_provider";
import { billingPeriodBounds, objectField, paidCoverage, parseProviderDate, recurringFrequency, recurringRedirect, recurringResourceId,
  verifiedInvoicePayment, verifiedPreapproval, type RecurringIdentity, type RecurringTopic } from "./lib/timbre_recurring_provider";

const topicValidator = v.union(v.literal("subscription_preapproval"), v.literal("subscription_authorized_payment"), v.literal("payment"));
const periodStatus = v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"), v.literal("cancelled"), v.literal("refunded"), v.literal("charged_back"));
const providerStatus = v.union(v.literal("pending"), v.literal("authorized"), v.literal("paused"), v.literal("cancelled"));

export const claimNotification = internalMutation({ args: { key: v.string() }, handler: async (ctx, args) => {
  if (!/^[a-f0-9]{64}$/.test(args.key)) marketplaceError("La recepción de webhook no es válida.");
  const row = await ctx.db.query("timbreRecurringEvents").withIndex("by_key", (q) => q.eq("key", args.key)).unique(); const now = Date.now();
  if (row?.status === "done") return { process: false, pending: false };
  if (row && row.leaseUntil > now) return { process: false, pending: true };
  if (row) await ctx.db.patch("timbreRecurringEvents", row._id, { status: "processing", leaseUntil: now + 120_000, updatedAt: now });
  else {
    const id = await ctx.db.insert("timbreRecurringEvents", { key: args.key, status: "processing", leaseUntil: now + 120_000,
      expiresAt: now + 10 * 60_000, createdAt: now, updatedAt: now });
    await ctx.scheduler.runAfter(10 * 60_000, internal.timbre_recurring.cleanupNotification, { id });
  }
  return { process: true, pending: false };
} });
export const finishNotification = internalMutation({ args: { key: v.string(), success: v.boolean() }, handler: async (ctx, args) => {
  const row = await ctx.db.query("timbreRecurringEvents").withIndex("by_key", (q) => q.eq("key", args.key)).unique();
  if (row) await ctx.db.patch("timbreRecurringEvents", row._id, { status: args.success ? "done" : "processing", leaseUntil: 0, updatedAt: Date.now() }); return null;
} });
export const cleanupNotification = internalMutation({ args: { id: v.id("timbreRecurringEvents") }, handler: async (ctx, args) => {
  const row = await ctx.db.get("timbreRecurringEvents", args.id);
  if (row && row.expiresAt <= Date.now()) await ctx.db.delete("timbreRecurringEvents", row._id); return null;
} });

async function ready(ctx: Pick<QueryCtx, "db">) {
  const settings = await ctx.db.query("marketplacePaymentSettings").withIndex("by_key", (q) => q.eq("key", "mercadopago-ar")).unique();
  return !!(process.env.TIMBRE_RECURRING_ENABLED === "true" && process.env.MP_MODE === "live" && process.env.MP_ACCESS_TOKEN &&
    process.env.MP_APPLICATION_ID && process.env.MP_COLLECTOR_ID && process.env.MP_WEBHOOK_SECRET && process.env.MP_CLIENT_SECRET &&
    process.env.MP_TOKEN_ENCRYPTION_KEY && settings?.enabled && settings.splitApproved && settings.policiesAccepted);
}
function expectedIdentity(row: Doc<"timbreSubscriptions">): RecurringIdentity {
  if (!row.providerReference || !row.collectorId || !row.applicationId || !row.payerEmail) marketplaceError("La suscripción todavía no fue registrada con el proveedor.");
  return { providerId: row.providerReference, externalReference: row._id, collectorId: row.collectorId, applicationId: row.applicationId,
    payerEmail: row.payerEmail, payerId: row.providerPayerId, amount: row.planSnapshot.priceAmount, currency: row.planSnapshot.currency,
    frequency: recurringFrequency(row.planSnapshot.period), billingAnchorDay: row.billingAnchorDay };
}
function plainBackUrl() {
  try {
    const url = new URL(process.env.SITE_URL ?? "");
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    return `${url.origin}/timbre`;
  } catch { return marketplaceError("Falta configurar la dirección segura de VISO."); }
}
function providerHeaders(token: string) { return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }; }
async function tokenFor(ctx: Pick<ActionCtx, "runAction">, row: Doc<"timbreSubscriptions">) {
  if (!row.sellerId) marketplaceError("La cuenta de cobro de la suscripción no está configurada.");
  return ctx.runAction(internal.marketplace_payments.sellerToken, { userId: row.sellerId, allowDisconnected: true });
}

export const configuration = query({ args: {}, handler: async (ctx) => {
  await requireCurrentUser(ctx); return { enabled: await ready(ctx), externallyValidated: false,
    webhookPath: "/timbre/payments/webhook", message: "La autorización no activa Timbre; se requiere confirmar el pago de cada período." };
} });

export const mySubscriptions = query({ args: {}, handler: async (ctx) => {
  const user = await requireCurrentUser(ctx);
  const rows = await ctx.db.query("timbreSubscriptions").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).order("desc").take(100);
  const result = [];
  for (const row of rows) {
    const periods = await ctx.db.query("timbreSubscriptionPeriods").withIndex("by_subscription", (q) => q.eq("subscriptionId", row._id)).order("desc").take(100);
    result.push({ ...row, periods });
  }
  return result;
} });

export const subscriptionForOwner = internalQuery({ args: { id: v.id("timbreSubscriptions") }, handler: async (ctx, args) => {
  const user = await requireCurrentUser(ctx); const row = await ctx.db.get("timbreSubscriptions", args.id);
  if (!row || row.ownerId !== user._id) marketplaceError("No se encontró una suscripción de tu cuenta."); return row;
} });
export const subscriptionForProvider = internalQuery({ args: { providerId: v.string() }, handler: async (ctx, args) =>
  ctx.db.query("timbreSubscriptions").withIndex("by_provider", (q) => q.eq("providerReference", args.providerId)).unique() });
export const periodForPayment = internalQuery({ args: { paymentId: v.string() }, handler: async (ctx, args) =>
  ctx.db.query("timbreSubscriptionPeriods").withIndex("by_payment", (q) => q.eq("paymentId", args.paymentId)).unique() });

export const beginCheckout = internalMutation({ args: { planId: v.id("timbrePlans") }, handler: async (ctx, args) => {
  const user = await requireCurrentUser(ctx);
  if (!await ready(ctx)) marketplaceError("Las suscripciones recurrentes todavía no están habilitadas para cobrar.");
  const plan = await ctx.db.get("timbrePlans", args.planId);
  if (!plan?.enabled || !plan.priceAmount || plan.currency !== "ARS" || !["digital", "edificios"].includes(plan.code) ||
    plan.period === "one_time" || !isMarketplaceAdmin(plan.sellerId) || plan.sellerId === user._id) marketplaceError("El plan recurrente no está disponible.");
  if (!user.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) marketplaceError("Completá el correo de tu cuenta antes de contratar.");
  const rows = await ctx.db.query("timbreSubscriptions").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).collect();
  const pending = rows.find((x) => x.planId === plan._id && x.status === "pending_external");
  if (pending?.checkoutState === "ready" && pending.initPoint) return { row: pending, create: false };
  if (pending?.checkoutState === "creating" || pending?.checkoutState === "failed") marketplaceError("La contratación anterior necesita comprobarse con Mercado Pago antes de volver a intentarla; no iniciaremos un cobro duplicado.");
  const fields = { sellerId: plan.sellerId, collectorId: process.env.MP_COLLECTOR_ID!, applicationId: process.env.MP_APPLICATION_ID!,
    payerEmail: user.email.toLowerCase(), checkoutState: "creating" as const, updatedAt: Date.now() };
  const id = pending?._id ?? await ctx.db.insert("timbreSubscriptions", { ownerId: user._id, planId: plan._id, status: "pending_external",
    planSnapshot: { name: plan.name, priceAmount: plan.priceAmount, currency: plan.currency, period: plan.period,
      durationDays: plan.durationDays, features: plan.features, limits: plan.limits }, createdAt: Date.now(), ...fields });
  if (pending) {
    // A previous interest registration is not an agreed checkout. Take the
    // currently displayed commercial terms when starting the real checkout.
    await ctx.db.patch("timbreSubscriptions", id, { ...fields, planSnapshot: { name: plan.name, priceAmount: plan.priceAmount,
      currency: plan.currency, period: plan.period, durationDays: plan.durationDays, features: plan.features, limits: plan.limits } });
  }
  return { row: (await ctx.db.get("timbreSubscriptions", id))!, create: true };
} });

export const recordCheckout = internalMutation({ args: { id: v.id("timbreSubscriptions"), providerId: v.string(), initPoint: v.string(),
  collectorId: v.string(), applicationId: v.string(), status: providerStatus, payerId: v.optional(v.string()) }, handler: async (ctx, args) => {
  const row = await ctx.db.get("timbreSubscriptions", args.id);
  if (!row || !recurringResourceId(args.providerId) || row.collectorId !== args.collectorId || row.applicationId !== args.applicationId ||
    (row.providerReference && row.providerReference !== args.providerId) || (row.checkoutState !== "creating" && row.checkoutState !== "ready")) marketplaceError("La respuesta no corresponde a esta contratación.");
  const duplicate = await ctx.db.query("timbreSubscriptions").withIndex("by_provider", (q) => q.eq("providerReference", args.providerId)).unique();
  if (duplicate && duplicate._id !== row._id) marketplaceError("La suscripción ya corresponde a otra cuenta.");
  await ctx.db.patch("timbreSubscriptions", row._id, { providerReference: args.providerId,
    initPoint: recurringRedirect(args.initPoint, args.providerId), providerPayerId: args.payerId,
    status: args.status === "pending" ? "pending_external" : args.status, checkoutState: "ready", updatedAt: Date.now() }); return null;
} });
export const recordCheckoutFailure = internalMutation({ args: { id: v.id("timbreSubscriptions") }, handler: async (ctx, args) => {
  const row = await ctx.db.get("timbreSubscriptions", args.id);
  if (row?.checkoutState === "creating") await ctx.db.patch("timbreSubscriptions", row._id, { checkoutState: "failed", updatedAt: Date.now() }); return null;
} });

export const createSubscriptionCheckout = action({ args: { planId: v.id("timbrePlans") },
  handler: async (ctx, args): Promise<{ checkoutUrl: string; subscriptionId: Id<"timbreSubscriptions"> }> => {
    const reservation = await ctx.runMutation(internal.timbre_recurring.beginCheckout, args); const row = reservation.row;
    if (!reservation.create) return { checkoutUrl: recurringRedirect(row.initPoint, row.providerReference!), subscriptionId: row._id };
    try {
      const token = await tokenFor(ctx, row);
      const created = await providerRequest("/preapproval/", { method: "POST", headers: { ...providerHeaders(token), "X-Idempotency-Key": row._id },
        body: JSON.stringify({ reason: row.planSnapshot.name, external_reference: row._id, payer_email: row.payerEmail,
          back_url: plainBackUrl(), status: "pending", auto_recurring: { frequency: recurringFrequency(row.planSnapshot.period),
            frequency_type: "months", transaction_amount: row.planSnapshot.priceAmount / 100, currency_id: row.planSnapshot.currency } }) });
      if (!recurringResourceId(created.id)) marketplaceError("Mercado Pago no identificó la suscripción creada.");
      const canonical = await providerRequest(`/preapproval/${encodeURIComponent(created.id)}`, { method: "GET", headers: providerHeaders(token) });
      const identity = expectedIdentity({ ...row, providerReference: created.id });
      const status = verifiedPreapproval(canonical, identity);
      const initPoint = recurringRedirect(canonical.init_point ?? created.init_point, created.id);
      await ctx.runMutation(internal.timbre_recurring.recordCheckout, { id: row._id, providerId: created.id, initPoint,
        collectorId: identity.collectorId, applicationId: identity.applicationId, status: status.status, payerId: status.payerId });
      return { checkoutUrl: initPoint, subscriptionId: row._id };
    } catch (error) {
      // An uncertain POST is never automatically repeated: the provider may
      // have created the subscription even when its response was lost.
      await ctx.runMutation(internal.timbre_recurring.recordCheckoutFailure, { id: row._id }); throw error;
    }
  },
});

export const recordProviderStatus = internalMutation({ args: { id: v.id("timbreSubscriptions"), providerId: v.string(),
  collectorId: v.string(), applicationId: v.string(), payerId: v.optional(v.string()), status: providerStatus }, handler: async (ctx, args) => {
  const row = await ctx.db.get("timbreSubscriptions", args.id);
  if (!row || row.providerReference !== args.providerId || row.collectorId !== args.collectorId || row.applicationId !== args.applicationId ||
    (row.providerPayerId && row.providerPayerId !== args.payerId)) marketplaceError("La actualización no corresponde a esta suscripción.");
  // A provider-confirmed cancellation cannot be undone by an older message.
  if (row.status === "cancelled" && args.status !== "cancelled") return null;
  await ctx.db.patch("timbreSubscriptions", row._id, { status: args.status === "pending" ? "pending_external" : args.status,
    providerPayerId: args.payerId, updatedAt: Date.now() }); return null;
} });
async function syncPreapproval(ctx: Pick<ActionCtx, "runAction" | "runMutation">, row: Doc<"timbreSubscriptions">) {
  const token = await tokenFor(ctx, row), expected = expectedIdentity(row);
  const canonical = await providerRequest(`/preapproval/${encodeURIComponent(expected.providerId)}`, { method: "GET", headers: providerHeaders(token) });
  const verified = verifiedPreapproval(canonical, expected);
  await ctx.runMutation(internal.timbre_recurring.recordProviderStatus, { id: row._id, providerId: expected.providerId,
    collectorId: expected.collectorId, applicationId: expected.applicationId, status: verified.status, payerId: verified.payerId });
  return { token, expected: { ...expected, payerId: verified.payerId,
    nextBillingAt: canonical.next_payment_date === undefined ? undefined : parseProviderDate(canonical.next_payment_date) }, status: verified.status };
}
export const refreshSubscription = action({ args: { id: v.id("timbreSubscriptions") }, handler: async (ctx, args): Promise<{ status: string; activated: false }> => {
  const row = await ctx.runQuery(internal.timbre_recurring.subscriptionForOwner, args); const result = await syncPreapproval(ctx, row);
  // No GET/return URL or authorization status can activate paid access.
  return { status: result.status, activated: false };
} });
export const requestCancellation = internalMutation({ args: { id: v.id("timbreSubscriptions") }, handler: async (ctx, args) => {
  const user = await requireCurrentUser(ctx), row = await ctx.db.get("timbreSubscriptions", args.id);
  if (!row || row.ownerId !== user._id) marketplaceError("No se encontró una suscripción de tu cuenta.");
  await ctx.db.patch("timbreSubscriptions", row._id, { cancelRequestedAt: Date.now(), updatedAt: Date.now() }); return row;
} });
export const cancelSubscription = action({ args: { id: v.id("timbreSubscriptions") }, handler: async (ctx, args): Promise<{ status: string; providerCancellationPending: boolean }> => {
  const row = await ctx.runMutation(internal.timbre_recurring.requestCancellation, args);
  if (!row.providerReference) marketplaceError("La contratación pendiente requiere conciliación; no se declaró una cancelación inexistente.");
  const token = await tokenFor(ctx, row), expected = expectedIdentity(row);
  if (row.status !== "cancelled") await providerRequest(`/preapproval/${encodeURIComponent(expected.providerId)}`, { method: "PUT", headers: providerHeaders(token), body: JSON.stringify({ status: "cancelled" }) });
  const result = await syncPreapproval(ctx, row);
  return { status: result.status, providerCancellationPending: result.status !== "cancelled" };
} });

async function recalculateLicense(ctx: MutationCtx, row: Doc<"timbreSubscriptions">) {
  const periods = await ctx.db.query("timbreSubscriptionPeriods").withIndex("by_subscription", (q) => q.eq("subscriptionId", row._id)).collect();
  const coverage = paidCoverage(periods), now = Date.now();
  const license = row.licenseId ? await ctx.db.get("timbreLicenses", row.licenseId) : null;
  if (license && (license.ownerId !== row.ownerId || license.source !== "subscription" || license.sourceReference !== `mp-subscription:${row._id}`)) marketplaceError("La licencia no corresponde a esta suscripción.");
  if (row.coverageScheduledId) await ctx.scheduler.cancel(row.coverageScheduledId);
  await ctx.db.patch("timbreSubscriptions", row._id, { coverageScheduledId: undefined, coverageScheduledAt: undefined });
  if (license?.revokedByAdmin) return;
  // Already paid, disjoint future periods must activate at their actual start
  // even when no new webhook arrives. This job never invents payment evidence.
  const boundary = periods.filter((x) => x.status === "approved").flatMap((x) => [x.startsAt, x.endsAt]).filter((time) => time > now).sort((a, b) => a - b)[0];
  if (boundary !== undefined) {
    const scheduledId = await ctx.scheduler.runAt(boundary, internal.timbre_recurring.recalculateCoverage, { id: row._id, at: boundary });
    await ctx.db.patch("timbreSubscriptions", row._id, { coverageScheduledId: scheduledId, coverageScheduledAt: boundary });
  }
  if (!coverage) {
    if (license) await ctx.db.patch("timbreLicenses", license._id, { status: "revoked", revokedAt: now, revocationReason: "subscription_no_paid_coverage", updatedAt: now });
    return;
  }
  const fields = { status: coverage.endsAt > now ? "active" as const : "expired" as const, startsAt: coverage.startsAt, expiresAt: coverage.endsAt,
    revokedAt: undefined, revocationReason: undefined, updatedAt: now };
  if (license) { await ctx.db.patch("timbreLicenses", license._id, fields); return; }
  const licenseId = await ctx.db.insert("timbreLicenses", { ownerId: row.ownerId, planId: row.planId, planName: row.planSnapshot.name,
    source: "subscription", sourceReference: `mp-subscription:${row._id}`, features: row.planSnapshot.features, limits: row.planSnapshot.limits,
    ...fields, createdAt: now });
  await ctx.db.patch("timbreSubscriptions", row._id, { licenseId, updatedAt: now });
}

export const recalculateCoverage = internalMutation({ args: { id: v.id("timbreSubscriptions"), at: v.number() }, handler: async (ctx, args) => {
  const row = await ctx.db.get("timbreSubscriptions", args.id); if (!row) return null;
  if (row.coverageScheduledAt !== args.at) return null;
  // The executing scheduled function cannot cancel itself.
  await ctx.db.patch("timbreSubscriptions", row._id, { coverageScheduledId: undefined, coverageScheduledAt: undefined });
  await recalculateLicense(ctx, { ...row, coverageScheduledId: undefined, coverageScheduledAt: undefined }); return null;
} });

export const recordVerifiedPeriod = internalMutation({ args: { id: v.id("timbreSubscriptions"), providerId: v.string(), collectorId: v.string(), applicationId: v.string(),
  payerId: v.string(), liveMode: v.boolean(), invoiceId: v.string(), paymentId: v.string(), startsAt: v.number(), endsAt: v.number(),
  amount: v.number(), currency: v.string(), status: periodStatus, paidAt: v.optional(v.number()), nextBillingAt: v.optional(v.number()) }, handler: async (ctx, args) => {
  const row = await ctx.db.get("timbreSubscriptions", args.id);
  if (!row || row.providerReference !== args.providerId || row.collectorId !== args.collectorId || row.applicationId !== args.applicationId ||
    !row.providerPayerId || row.providerPayerId !== args.payerId || args.liveMode !== true || args.amount !== row.planSnapshot.priceAmount ||
    args.currency !== row.planSnapshot.currency || !/^\d{1,30}$/.test(args.paymentId) || !recurringResourceId(args.invoiceId) ||
    !Number.isFinite(args.startsAt) || args.startsAt <= 0 || args.endsAt !== billingPeriodBounds(args.startsAt, recurringFrequency(row.planSnapshot.period), row.billingAnchorDay, args.nextBillingAt).endsAt ||
    (args.status === "approved" && (args.paidAt === undefined || !Number.isFinite(args.paidAt) || args.paidAt <= 0 || args.paidAt > Date.now() + 60_000))) marketplaceError("El período pagado no coincide con la suscripción.");
  const [invoice, payment, marketplacePayment] = await Promise.all([
    ctx.db.query("timbreSubscriptionPeriods").withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoiceId)).unique(),
    ctx.db.query("timbreSubscriptionPeriods").withIndex("by_payment", (q) => q.eq("paymentId", args.paymentId)).unique(),
    ctx.db.query("marketplaceOrders").withIndex("by_payment", (q) => q.eq("paymentId", args.paymentId)).unique(),
  ]);
  if (marketplacePayment || (invoice && (invoice.subscriptionId !== row._id || invoice.paymentId !== args.paymentId)) ||
    (payment && (payment.subscriptionId !== row._id || payment.invoiceId !== args.invoiceId))) marketplaceError("Este pago ya corresponde a otra factura o compra.");
  if (invoice && (invoice.startsAt !== args.startsAt || invoice.endsAt !== args.endsAt || invoice.amount !== args.amount || invoice.currency !== args.currency)) marketplaceError("El período de la factura ya está fijado.");
  if (invoice && (["refunded", "charged_back"].includes(invoice.status) || (invoice.status === "approved" && ["pending", "rejected", "cancelled"].includes(args.status)))) return null;
  const now = Date.now(), fields = { subscriptionId: row._id, invoiceId: args.invoiceId, paymentId: args.paymentId, startsAt: args.startsAt,
    endsAt: args.endsAt, amount: args.amount, currency: args.currency, status: args.status, paidAt: args.paidAt ?? invoice?.paidAt, verifiedAt: now, updatedAt: now };
  if (invoice) await ctx.db.patch("timbreSubscriptionPeriods", invoice._id, fields);
  else await ctx.db.insert("timbreSubscriptionPeriods", { ...fields, createdAt: now });
  const bounds = billingPeriodBounds(args.startsAt, recurringFrequency(row.planSnapshot.period), row.billingAnchorDay, args.nextBillingAt);
  await ctx.db.patch("timbreSubscriptions", row._id, { billingAnchorDay: bounds.anchorDay });
  await recalculateLicense(ctx, { ...row, billingAnchorDay: bounds.anchorDay }); return null;
} });

async function syncInvoice(ctx: Pick<ActionCtx, "runAction" | "runQuery" | "runMutation">, row: Doc<"timbreSubscriptions">, invoiceId: string) {
  const preapproval = await syncPreapproval(ctx, row);
  const invoice = await providerRequest(`/authorized_payments/${encodeURIComponent(invoiceId)}`, { method: "GET", headers: providerHeaders(preapproval.token) });
  const payment = objectField(invoice.payment), paymentId = String(payment.id);
  if (!/^\d{1,30}$/.test(paymentId)) marketplaceError("La factura todavía no tiene un pago verificable.");
  const canonicalPayment = await providerRequest(`/v1/payments/${paymentId}`, { method: "GET", headers: providerHeaders(preapproval.token) });
  const verified = verifiedInvoicePayment(invoice, canonicalPayment, preapproval.expected, invoiceId);
  if (!preapproval.expected.payerId) marketplaceError("La factura no identifica al titular.");
  await ctx.runMutation(internal.timbre_recurring.recordVerifiedPeriod, { id: row._id, providerId: preapproval.expected.providerId,
    collectorId: preapproval.expected.collectorId, applicationId: preapproval.expected.applicationId, payerId: preapproval.expected.payerId, liveMode: true, ...verified });
}

export const processNotification = internalAction({ args: { topic: topicValidator, resourceId: v.string() }, handler: async (ctx, args): Promise<null> => {
  if (!recurringResourceId(args.resourceId)) marketplaceError("El identificador del proveedor no es válido.");
  if (args.topic === "subscription_preapproval") {
    const row = await ctx.runQuery(internal.timbre_recurring.subscriptionForProvider, { providerId: args.resourceId });
    if (row) await syncPreapproval(ctx, row); return null;
  }
  if (args.topic === "payment") {
    if (!/^\d{1,30}$/.test(args.resourceId)) marketplaceError("El pago no es válido.");
    const period = await ctx.runQuery(internal.timbre_recurring.periodForPayment, { paymentId: args.resourceId });
    if (!period) return null;
    // Lookup is by our immutable subscription id; no external_reference from a
    // visitor request is accepted as proof of account ownership.
    const subscription = await ctx.runQuery(internal.timbre_recurring.subscriptionById, { id: period.subscriptionId });
    if (subscription) await syncInvoice(ctx, subscription, period.invoiceId); return null;
  }
  // Fetch invoice to discover the provider subscription, then independently
  // verify it again under the stored seller account before any entitlement.
  if (!process.env.MP_ACCESS_TOKEN) marketplaceError("Falta la cuenta de cobro.");
  const invoice = await providerRequest(`/authorized_payments/${encodeURIComponent(args.resourceId)}`, { method: "GET", headers: providerHeaders(process.env.MP_ACCESS_TOKEN) });
  if (!recurringResourceId(invoice.preapproval_id)) marketplaceError("La factura no identifica una suscripción.");
  const row = await ctx.runQuery(internal.timbre_recurring.subscriptionForProvider, { providerId: invoice.preapproval_id });
  if (row) await syncInvoice(ctx, row, args.resourceId); return null;
} });
export const subscriptionById = internalQuery({ args: { id: v.id("timbreSubscriptions") }, handler: async (ctx, args) => ctx.db.get("timbreSubscriptions", args.id) });

// Exposed only as a type for the isolated signed HTTP adapter.
export type { RecurringTopic };
