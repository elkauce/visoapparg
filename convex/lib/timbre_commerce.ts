import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { marketplaceError } from "./marketplace_validation";

export type TimbreReadCtx = Pick<QueryCtx, "db">;
export type TimbreWriteCtx = Pick<MutationCtx, "db">;
export type TimbreFeature = keyof Doc<"timbreLicenses">["features"];

export function licenseIsActive(license: Pick<Doc<"timbreLicenses">, "status" | "startsAt" | "expiresAt">, now = Date.now()) {
  return license.status === "active" && license.startsAt <= now &&
    (license.expiresAt === undefined || license.expiresAt > now);
}

export async function getValidTimbreLicense(ctx: TimbreReadCtx, licenseId: Id<"timbreLicenses">, ownerId: Id<"users">) {
  const license = await ctx.db.get("timbreLicenses", licenseId);
  return license && license.ownerId === ownerId && licenseIsActive(license) ? license : null;
}

export async function requireValidTimbreLicense(ctx: TimbreReadCtx, licenseId: Id<"timbreLicenses">, ownerId: Id<"users">) {
  const license = await getValidTimbreLicense(ctx, licenseId, ownerId);
  if (!license) marketplaceError("Necesitás una licencia Timbre activa para esta vivienda.");
  return license;
}

export function validatePlanBenefits(features: Doc<"timbrePlans">["features"], limits: Doc<"timbrePlans">["limits"]) {
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 1 || value > (key === "maxSites" ? 100 : 1000)) marketplaceError("Los límites admitidos son de 1 a 100 viviendas y de 1 a 1.000 QR, miembros o unidades por vivienda.");
  }
  if (!features.audio && !features.video && !features.chat && !features.messages) {
    marketplaceError("El plan debe incluir al menos un medio de comunicación.");
  }
}

export function validateMoney(value: number | undefined, allowZero = false) {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value > 1_000_000_000)) {
    marketplaceError("Indicá un importe válido en centavos.");
  }
}

export function validateDuration(value: number | undefined) {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 1 || value > 36_500)) {
    marketplaceError("La duración debe ser de 1 a 36.500 días.");
  }
}

export function planBenefit(plan: Doc<"timbrePlans">) {
  return { planId: plan._id, planName: plan.name, durationDays: plan.durationDays, features: plan.features, limits: plan.limits };
}

/** Only called at reservation, before contacting the payment provider. Editing
 * hardware eligibility later cannot add/remove an already purchased benefit. */
export async function snapshotMarketplaceTimbreBenefit(ctx: TimbreWriteCtx, orderId: Id<"marketplaceOrders">, productId: string) {
  const mapping = await ctx.db.query("timbreHardwareEligibility").withIndex("by_product", (q) => q.eq("productId", productId)).unique();
  if (!mapping?.enabled) return;
  const order = await ctx.db.get("marketplaceOrders", orderId);
  const plan = await ctx.db.get("timbrePlans", mapping.planId);
  if (!order || !plan?.enabled || !["hardware", "new"].includes(order.productSnapshot.category) || order.amount <= 0 || order.productId !== productId) return;
  await ctx.db.insert("timbreOrderBenefits", { orderId, ownerId: order.buyerId, ...planBenefit(plan),
    durationDays: mapping.durationDays ?? plan.durationDays, source: "hardware_bundle", state: "pending", createdAt: Date.now(), updatedAt: Date.now() });
}

/** Called ONLY inside the existing verified-payment transaction, after its
 * amount/collector/currency/reference/mode/replay and terminal-state checks.
 * No library row, callback URL or client action can activate a license. */
export async function applyTimbreOrderPayment(ctx: TimbreWriteCtx, order: Doc<"marketplaceOrders">,
  status: Doc<"marketplaceOrders">["status"]) {
  const benefit = await ctx.db.query("timbreOrderBenefits").withIndex("by_order", (q) => q.eq("orderId", order._id)).unique();
  const plate = await ctx.db.query("timbrePlateOrders").withIndex("by_marketplace_order", (q) => q.eq("marketplaceOrderId", order._id)).unique();
  const now = Date.now();
  if (status === "refunded" || status === "charged_back") {
    // This is independent of downloadable marketplace-library content.
    const licenses = await ctx.db.query("timbreLicenses").withIndex("by_source_order", (q) => q.eq("sourceOrderId", order._id)).collect();
    for (const license of licenses) if (license.status !== "revoked") {
      await ctx.db.patch("timbreLicenses", license._id, { status: "revoked", revokedAt: now, revocationReason: status, updatedAt: now });
    }
    if (benefit && benefit.state !== "revoked") await ctx.db.patch("timbreOrderBenefits", benefit._id, { state: "revoked", updatedAt: now });
    if (plate && plate.status !== "refunded") await ctx.db.patch("timbrePlateOrders", plate._id, { status: "refunded", updatedAt: now });
    return;
  }
  if (status !== "approved" || order.amount <= 0 || order.providerMode !== "live") return;
  if (plate && plate.status === "pending_payment") await ctx.db.patch("timbrePlateOrders", plate._id, { status: "paid", updatedAt: now });
  if (!benefit || benefit.ownerId !== order.buyerId || benefit.state !== "pending") return;
  const existing = await ctx.db.query("timbreLicenses").withIndex("by_source_order", (q) => q.eq("sourceOrderId", order._id)).unique();
  // A manual administrative revocation is never reversed by a later replay.
  if (existing) {
    await ctx.db.patch("timbreOrderBenefits", benefit._id, { licenseId: existing._id, state: existing.status === "revoked" ? "revoked" : "granted", updatedAt: now });
    return;
  }
  const licenseId = await ctx.db.insert("timbreLicenses", { ownerId: order.buyerId, planId: benefit.planId,
    planName: benefit.planName, status: "active", startsAt: now,
    expiresAt: benefit.durationDays === undefined ? undefined : now + benefit.durationDays * 86_400_000,
    source: benefit.source, sourceReference: `marketplace:${order._id}`, sourceOrderId: order._id,
    features: benefit.features, limits: benefit.limits, createdAt: now, updatedAt: now });
  await ctx.db.patch("timbreOrderBenefits", benefit._id, { licenseId, state: "granted", updatedAt: now });
  if (benefit.discountId) {
    const discount = await ctx.db.get("timbreDiscounts", benefit.discountId);
    if (discount) await ctx.db.patch("timbreDiscounts", discount._id, { redemptions: discount.redemptions + 1 });
  }
}
