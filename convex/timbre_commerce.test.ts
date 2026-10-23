import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";
import { licenseIsActive } from "./lib/timbre_commerce";
import { snapshotMarketplaceTimbreBenefit } from "./lib/timbre_commerce";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const features = { audio: true, video: true, chat: true, messages: true, families: true, buildings: true, offices: true, access: false };
const limits = { maxSites: 2, maxQrs: 3, maxMembers: 4, maxUnits: 5 };
const design = { title: "Timbre VISO", streetNumber: "123", familyName: "Familia", businessName: "", unit: "", legend: "Escaneá para comunicarte",
  backgroundColor: "#F5F3EF", textColor: "#17191D", qrColor: "#17191D", qrBackground: "#FFFFFF",
  font: "sans" as const, emblem: "bell" as const, widthMm: 90, heightMm: 130, bleedMm: 3 };
const address = { name: "Comprador de prueba", street: "Calle de prueba 123", city: "Buenos Aires", region: "CABA", postalCode: "1000", country: "AR", phone: "+541100000000" };
function providerEnvs() {
  for (const name of ["MP_APPLICATION_ID", "MP_CLIENT_SECRET", "MP_ACCESS_TOKEN", "MP_WEBHOOK_SECRET"]) vi.stubEnv(name, "local-test-only");
  vi.stubEnv("MP_TOKEN_ENCRYPTION_KEY", btoa("0123456789abcdef0123456789abcdef"));
  vi.stubEnv("MP_MODE", "live"); vi.stubEnv("MP_COLLECTOR_ID", "99");
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site"); vi.stubEnv("SITE_URL", "https://viso.example.test");
}
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => ({ adminId: await ctx.db.insert("users", { email: "admin@example.test" }),
    buyerId: await ctx.db.insert("users", { email: "buyer@example.test" }), otherId: await ctx.db.insert("users", { email: "other@example.test" }) }));
  vi.stubEnv("MARKETPLACE_ADMIN_USER_IDS", ids.adminId);
  const admin = t.withIdentity({ subject: `${ids.adminId}|admin` }); const buyer = t.withIdentity({ subject: `${ids.buyerId}|buyer` });
  const other = t.withIdentity({ subject: `${ids.otherId}|other` });
  const planId = await admin.mutation(api.timbre_commerce.savePlan, { code: "digital", name: "Plan prueba", description: "Datos de prueba, no es una tarifa comercial.",
    enabled: true, priceAmount: 12345, currency: "ARS", period: "one_time", durationDays: 365, features, limits });
  return { t, ...ids, admin, buyer, other, planId };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function enable(f: Fixture) {
  providerEnvs(); await f.admin.mutation(api.marketplace_payments.saveSettings, { digitalCommissionBps: 1000, enabled: true, splitApproved: true, policiesAccepted: true });
}
async function reserve(f: Fixture, extra: { coupon?: string } = {}) {
  return f.buyer.mutation(internal.timbre_commerce.reservePlanOrder, { planId: f.planId, ...extra });
}
async function verified(f: Fixture, orderId: Id<"marketplaceOrders">, extra: Record<string, unknown> = {}) {
  const order = (await f.t.run((ctx) => ctx.db.get("marketplaceOrders", orderId)))!;
  return f.t.mutation(internal.marketplace_payments.applyVerifiedPayment, { orderId, paymentId: `p-${orderId}`, amount: order.amount, currency: order.currency,
    collectorId: "99", externalReference: orderId, liveMode: true, status: "approved", eventKey: `${orderId}:approved`, ...extra });
}
async function plateFixture(f: Fixture) {
  const variantId = await f.admin.mutation(api.timbre_commerce.savePlateVariant, { name: "Placa de prueba", material: "Material de prueba configurado por admin",
    widthMm: 90, heightMm: 130, enabled: true, priceAmount: 20000, currency: "ARS", availability: "available",
    productionNotes: "Archivo validado antes de producir", warranty: "Condiciones de prueba", includedPlanId: f.planId });
  const shippingOptionId = await f.admin.mutation(api.timbre_commerce.saveShippingOption, { name: "Envío de prueba", country: "AR", regions: ["CABA"], enabled: true,
    priceAmount: 3000, currency: "ARS", terms: "Entrega según condiciones reales configuradas. Sin plazo inventado." });
  return { variantId, shippingOptionId };
}
async function bindQr(f: Fixture, plateId: Id<"timbrePlateOrders">) {
  const licenses = await f.buyer.query(api.timbre_commerce.myLicenses, {});
  const qrId = await f.t.run(async (ctx) => {
    const siteId = await ctx.db.insert("timbreSites", { ownerId: f.buyerId, licenseId: licenses[0]._id, kind: "home", name: "Casa", timezone: "America/Argentina/Buenos_Aires",
      enabled: true, allowedAudio: true, allowedVideo: true, chatEnabled: true, messagesEnabled: true, notificationsEnabled: true,
      schedule: [], recipientIds: [f.buyerId], fallbackAfterSeconds: 15, createdAt: Date.now(), updatedAt: Date.now() });
    return ctx.db.insert("timbreQrs", { siteId, token: "a".repeat(64), label: "Puerta", enabled: true, design, createdAt: Date.now(), updatedAt: Date.now() });
  });
  await f.buyer.mutation(api.timbre_commerce.attachPlateQr, { id: plateId, qrId }); return qrId;
}
async function storeProductionPdf(f: Fixture) {
  return f.t.run(async (ctx) => {
    const id = await ctx.storage.store(new Blob(["%PDF-1.7 test production"], { type: "application/pdf" }));
    // convex-test omits contentType from stored metadata; model the metadata
    // returned by a real upload, keeping production validation strict.
    await ctx.db.patch("_storage" as never, id as never, { contentType: "application/pdf" } as never); return id;
  });
}

describe("Timbre commercial entitlement", () => {
  it("shows exactly four unconfigured offers without granting account access", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) => ctx.db.insert("users", {})); const user = t.withIdentity({ subject: `${userId}|user` });
    await expect(t.query(api.timbre_commerce.catalog, {})).rejects.toThrow(/iniciar sesión/);
    const catalog = await user.query(api.timbre_commerce.catalog, {});
    expect(catalog.map((x) => x.code)).toEqual(["digital", "personalizado", "hardware", "edificios"]);
    expect(catalog.every((x) => !x.configured && !x.buyable && x.plans.length === 0)).toBe(true);
    expect(await user.query(api.timbre_commerce.myLicense, {})).toMatchObject({ active: false, licenses: [] });
  });
  it("fails closed on disabled payment, missing price and unauthorized administration", async () => {
    const f = await fixture(); await expect(reserve(f)).rejects.toThrow(/no están habilitados/);
    await expect(f.buyer.mutation(api.timbre_commerce.savePlan, { code: "digital", name: "Plan", description: "Descripción", enabled: true,
      currency: "ARS", period: "one_time", features, limits })).rejects.toThrow(/permiso/);
    await f.admin.mutation(api.timbre_commerce.savePlan, { id: f.planId, code: "digital", name: "Sin precio", description: "Todavía sin definir", enabled: true,
      currency: "ARS", period: "one_time", features, limits });
    await enable(f); await expect(reserve(f)).rejects.toThrow(/no está disponible/);
    expect((await f.buyer.query(api.timbre_commerce.myLicense, {})).active).toBe(false);
  });
  it("grants only after provider verification, snapshots terms and revokes refunds idempotently", async () => {
    const f = await fixture(); await enable(f); const order = await reserve(f);
    expect((await f.buyer.query(api.timbre_commerce.myLicenses, {}))).toEqual([]);
    for (const change of [{ amount: 1 }, { currency: "USD" }, { collectorId: "attacker" }, { externalReference: "other" }, { liveMode: false }]) {
      await expect(verified(f, order.orderId, change)).rejects.toThrow(/no coincide/);
    }
    await f.t.run((ctx) => ctx.db.patch("timbrePlans", f.planId, { name: "Modificado", limits: { ...limits, maxSites: 99 }, features: { ...features, video: false } }));
    await verified(f, order.orderId); await verified(f, order.orderId);
    const licenses = await f.buyer.query(api.timbre_commerce.myLicenses, {});
    expect(licenses).toHaveLength(1); expect(licenses[0]).toMatchObject({ ownerId: f.buyerId, status: "active", planName: "Plan prueba", features, limits, active: true });
    expect(await f.buyer.query(api.marketplace.library, {})).toEqual([]);
    expect(await f.other.query(api.timbre_commerce.myLicenses, {})).toEqual([]);
    await verified(f, order.orderId, { status: "refunded", eventKey: "refund" });
    await verified(f, order.orderId, { status: "approved", eventKey: "late-approved" });
    const revoked = await f.buyer.query(api.timbre_commerce.myLicenses, {});
    expect(revoked).toHaveLength(1); expect(revoked[0]).toMatchObject({ status: "revoked", active: false, revocationReason: "refunded" });
  });
  it("does not revive an administratively revoked license on another approved event", async () => {
    const f = await fixture(); await enable(f); const order = await reserve(f); await verified(f, order.orderId);
    const license = (await f.buyer.query(api.timbre_commerce.myLicenses, {}))[0];
    await f.admin.mutation(api.timbre_commerce.revokeLicense, { id: license._id, reason: "Incumplimiento comercial confirmado" });
    await verified(f, order.orderId, { eventKey: "provider-replay-2" });
    expect((await f.buyer.query(api.timbre_commerce.myLicense, {})).active).toBe(false);
  });
  it("handles charged-back orders and ignores non-paid/regressive events", async () => {
    const f = await fixture(); await enable(f); const order = await reserve(f);
    await verified(f, order.orderId, { status: "pending", eventKey: "pending" }); expect(await f.buyer.query(api.timbre_commerce.myLicenses, {})).toEqual([]);
    await verified(f, order.orderId); await verified(f, order.orderId, { status: "rejected", eventKey: "late-rejected" });
    expect((await f.buyer.query(api.timbre_commerce.myLicense, {})).active).toBe(true);
    await verified(f, order.orderId, { status: "charged_back", eventKey: "chargeback" });
    expect((await f.buyer.query(api.timbre_commerce.myLicenses, {}))[0]).toMatchObject({ status: "revoked", revocationReason: "charged_back" });
  });
  it("revokes Timbre on a confirmed partial refund without deleting legacy library content", async () => {
    const f = await fixture(); await enable(f); const order = await reserve(f); await verified(f, order.orderId);
    await verified(f, order.orderId, { refundedAmount: 1, eventKey: "partial-refund" });
    expect((await f.buyer.query(api.timbre_commerce.myLicense, {})).active).toBe(false);
    expect((await f.t.run((ctx) => ctx.db.get("marketplaceOrders", order.orderId)))?.status).toBe("approved");
    expect(await f.buyer.query(api.marketplace.library, {})).toEqual([]);
  });
  it("does not pretend a recurring authorization is a paid subscription", async () => {
    const f = await fixture(); await enable(f);
    await f.t.run((ctx) => ctx.db.patch("timbrePlans", f.planId, { period: "monthly" }));
    await expect(reserve(f)).rejects.toThrow(/integración recurrente/);
    const request = await f.buyer.mutation(api.timbre_commerce.requestSubscription, { planId: f.planId });
    expect(request).toMatchObject({ status: "pending_external", activated: false });
    const duplicate = await f.buyer.mutation(api.timbre_commerce.requestSubscription, { planId: f.planId }); expect(duplicate.id).toBe(request.id);
    await expect(f.other.mutation(api.timbre_commerce.cancelSubscription, { id: request.id })).rejects.toThrow(/no se encontró/i);
    expect(await f.buyer.mutation(api.timbre_commerce.cancelSubscription, { id: request.id })).toEqual({ providerCancellationPending: false });
    expect(await f.buyer.query(api.timbre_commerce.myLicenses, {})).toEqual([]);
  });
  it("never activates a real service license from a sandbox payment", async () => {
    const f = await fixture(); await enable(f); const order = await reserve(f);
    await f.t.run((ctx) => ctx.db.patch("marketplaceOrders", order.orderId, { providerMode: "test" }));
    await verified(f, order.orderId, { liveMode: false });
    expect(await f.buyer.query(api.timbre_commerce.myLicenses, {})).toEqual([]);
    vi.stubEnv("MP_MODE", "test"); await expect(reserve(f)).rejects.toThrow(/no están habilitados/);
    expect((await f.buyer.query(api.timbre_commerce.catalog, {}))[0]).toMatchObject({ buyable: false, blockReason: expect.stringMatching(/modo de prueba/) });
  });
  it("requires explicit hardware eligibility and preserves its reservation snapshot", async () => {
    const f = await fixture(); await enable(f);
    const productId = await f.t.run((ctx) => ctx.db.insert("marketplaceProducts", { userId: f.adminId, creatorName: "VISO", title: "Hardware de prueba",
      description: "Sólo fixture local", category: "hardware", priceMode: "paid", priceAmount: 50000, currency: "ARS", affiliate: false,
      delivery: "inquiry", assets: [], status: "published", createdAt: Date.now(), updatedAt: Date.now() }));
    await f.admin.mutation(api.timbre_commerce.saveHardwareEligibility, { productId, planId: f.planId, enabled: true, durationDays: 30 });
    await expect(f.buyer.mutation(internal.marketplace_payments.reserveOrder, { productId })).rejects.toThrow(/entrega y garantía/);
    const orderId = await f.t.run(async (ctx) => {
      const id = await ctx.db.insert("marketplaceOrders", { buyerId: f.buyerId, sellerId: f.adminId, productId, title: "Hardware de prueba", currency: "ARS", amount: 50000,
        commissionBps: 0, commissionAmount: 0, sellerAmount: 50000, sellerProviderUserId: "99", providerMode: "live", status: "pending", createdAt: Date.now(), updatedAt: Date.now(),
        productSnapshot: { productId, title: "Hardware de prueba", creatorName: "VISO", category: "hardware", delivery: "inquiry", assets: [] } });
      await snapshotMarketplaceTimbreBenefit(ctx, id, productId); return id;
    });
    await f.admin.mutation(api.timbre_commerce.saveHardwareEligibility, { productId, planId: f.planId, enabled: false });
    expect(await f.buyer.query(api.timbre_commerce.myLicenses, {})).toEqual([]);
    await verified(f, orderId);
    const license = (await f.buyer.query(api.timbre_commerce.myLicenses, {}))[0]; expect(license).toMatchObject({ source: "hardware_bundle", active: true });
    expect(license.expiresAt! - license.startsAt).toBe(30 * 86_400_000);
    const unrelated = await f.t.run(async (ctx) => {
      const original = (await ctx.db.get("marketplaceOrders", orderId))!;
      const { _id, _creationTime, paymentId, paidAt, ...fields } = original; void _id; void _creationTime; void paymentId; void paidAt;
      return ctx.db.insert("marketplaceOrders", { ...fields, productId: "other-product", status: "pending" });
    });
    await verified(f, unrelated); expect(await f.buyer.query(api.timbre_commerce.myLicenses, {})).toHaveLength(1);
    await expect(f.admin.mutation(api.timbre_commerce.reconcileHardwareLicense, { orderId: unrelated })).rejects.toThrow(/no incluía/);
  });
  it("applies bounded discounts without making service free or exceeding configured uses", async () => {
    const f = await fixture(); await enable(f); const now = Date.now();
    const discount = { code: "PROMO", planIds: [f.planId], enabled: true, startsAt: now - 1000, expiresAt: now + 60_000, maxRedemptions: 1 };
    await expect(f.admin.mutation(api.timbre_commerce.saveDiscount, { ...discount, percentBps: 10000 })).rejects.toThrow(/compra paga/);
    await f.admin.mutation(api.timbre_commerce.saveDiscount, { ...discount, percentBps: 2500 });
    const order = await reserve(f, { coupon: "promo" }); expect(order.amount).toBe(9259);
    await expect(reserve(f, { coupon: "PROMO" })).rejects.toThrow(/límite/);
    await verified(f, order.orderId); await verified(f, order.orderId, { eventKey: "extra-approved" });
    const overview = await f.admin.query(api.timbre_commerce.adminOverview, {}); expect(overview.discounts[0].redemptions).toBe(1);
  });
  it("records an explicit external paid contract once and never accepts zero payment", async () => {
    const f = await fixture(); const input = { ownerId: f.buyerId, planId: f.planId, reference: "paid-receipt-test-1", amount: 12345, currency: "ARS" as const, paidAt: Date.now() - 1000 };
    await expect(f.buyer.mutation(api.timbre_commerce.recordPaidContract, input)).rejects.toThrow(/permiso/);
    await expect(f.admin.mutation(api.timbre_commerce.recordPaidContract, { ...input, amount: 0 })).rejects.toThrow(/importe/);
    const license = await f.admin.mutation(api.timbre_commerce.recordPaidContract, input);
    expect(await f.admin.mutation(api.timbre_commerce.recordPaidContract, input)).toBe(license);
    await expect(f.admin.mutation(api.timbre_commerce.recordPaidContract, { ...input, ownerId: f.otherId })).rejects.toThrow(/otro pago/);
    expect((await f.buyer.query(api.timbre_commerce.myLicenses, {}))).toHaveLength(1);
  });
  it("evaluates validity by server dates without granting expired, future or suspended licenses", () => {
    expect(licenseIsActive({ status: "active", startsAt: 100, expiresAt: 200 }, 150)).toBe(true);
    expect(licenseIsActive({ status: "active", startsAt: 100, expiresAt: 200 }, 200)).toBe(false);
    expect(licenseIsActive({ status: "active", startsAt: 100 }, 99)).toBe(false);
    expect(licenseIsActive({ status: "suspended", startsAt: 100 }, 150)).toBe(false);
    expect(licenseIsActive({ status: "active", startsAt: 100 }, 150)).toBe(true);
  });
});

describe("Timbre physical orders are separate from legacy hardware checkout", () => {
  it("blocks public token rotation during manufacturing while retaining emergency revocation", async () => {
    const f = await fixture(); await enable(f); const p = await plateFixture(f);
    const plateId = await f.buyer.mutation(api.timbre_commerce.createPlateOrder, { ...p, design, shippingAddress: address });
    const order = await f.buyer.mutation(internal.timbre_commerce.reservePlateOrder, { id: plateId }); await verified(f, order.orderId);
    const qrId = await bindQr(f, plateId);
    await f.t.run(async (ctx) => {
      const qr = (await ctx.db.get("timbreQrs", qrId))!;
      await ctx.db.insert("timbreMembers", { siteId: qr.siteId, userId: f.buyerId, role: "owner", unitIds: [], canReceive: true, createdAt: Date.now(), updatedAt: Date.now() });
    });
    const storageId = await storeProductionPdf(f);
    await f.admin.mutation(api.timbre_commerce.recordProductionFile, { id: plateId, storageId, fileName: "fixed.pdf", expectedQrToken: "a".repeat(64) });
    await f.admin.mutation(api.timbre_commerce.adminUpdatePlateOrder, { id: plateId, status: "production" });
    await expect(f.buyer.mutation(api.timbre.rotateQr, { qrId })).rejects.toThrow(/en producción/);
    await f.admin.mutation(api.timbre_commerce.adminUpdatePlateOrder, { id: plateId, status: "ready" });
    await expect(f.buyer.mutation(api.timbre.rotateQr, { qrId })).rejects.toThrow(/en producción/);
    await f.buyer.mutation(api.timbre.revokeQr, { qrId });
    expect((await f.t.run((ctx) => ctx.db.get("timbreQrs", qrId)))?.revokedAt).toBeTypeOf("number");
  });
  it("keeps order lists light while preserving the purchased image in production export", async () => {
    const f = await fixture(); await enable(f); const p = await plateFixture(f);
    const imageDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZwAAAABJRU5ErkJggg==";
    const plateId = await f.buyer.mutation(api.timbre_commerce.createPlateOrder, { ...p, design: { ...design, imageDataUrl }, shippingAddress: address });
    expect((await f.buyer.query(api.timbre_commerce.myPlateOrders, {}))[0].design.imageDataUrl).toBeUndefined();
    const overview = await f.admin.query(api.timbre_commerce.adminOverview, {});
    expect(overview.orders[0].design.imageDataUrl).toBeUndefined();
    expect(JSON.stringify(overview.orders)).not.toContain("data:image");
    const order = await f.buyer.mutation(internal.timbre_commerce.reservePlateOrder, { id: plateId }); await verified(f, order.orderId);
    await bindQr(f, plateId);
    expect((await f.admin.query(api.timbre_commerce.productionExport, { id: plateId })).design.imageDataUrl).toBe(imageDataUrl);
    await expect(f.other.query(api.timbre_commerce.productionExport, { id: plateId })).rejects.toThrow(/permiso/);
  });
  it("does not invent prices, shipping options or warranties", async () => {
    const f = await fixture(); const variantId = await f.admin.mutation(api.timbre_commerce.savePlateVariant, { name: "Sin configurar", material: "Material a confirmar", widthMm: 90,
      heightMm: 130, enabled: true, currency: "ARS", availability: "unconfigured", productionNotes: "", warranty: "" });
    const catalog = await f.buyer.query(api.timbre_commerce.catalog, {}); const offer = catalog.find((x) => x.code === "personalizado")!;
    expect(offer.variants[0]).toMatchObject({ id: variantId, priceAmount: null, buyable: false });
    expect(await f.buyer.query(api.timbre_commerce.shippingOptions, {})).toEqual([]);
    await expect(f.admin.mutation(api.timbre_commerce.savePlateVariant, { name: "No lista", material: "Prueba", widthMm: 90, heightMm: 130,
      enabled: true, currency: "ARS", availability: "available", productionNotes: "", warranty: "" })).rejects.toThrow(/precio, garantía/);
  });
  it("snapshots real plate, address, shipping and license before a verified charge", async () => {
    const f = await fixture(); await enable(f); const p = await plateFixture(f);
    const plateId = await f.buyer.mutation(api.timbre_commerce.createPlateOrder, { ...p, design, shippingAddress: address });
    const before = (await f.buyer.query(api.timbre_commerce.myPlateOrders, {}))[0]; expect(before).toMatchObject({ amount: 23000, status: "draft", design, shippingAddress: address });
    await expect(f.other.mutation(internal.timbre_commerce.reservePlateOrder, { id: plateId })).rejects.toThrow(/tu cuenta/);
    const order = await f.buyer.mutation(internal.timbre_commerce.reservePlateOrder, { id: plateId });
    expect((await f.buyer.mutation(internal.timbre_commerce.reservePlateOrder, { id: plateId })).orderId).toBe(order.orderId);
    expect(await f.buyer.query(api.timbre_commerce.myLicenses, {})).toEqual([]);
    await f.t.run(async (ctx) => { await ctx.db.patch("timbrePlateVariants", p.variantId, { priceAmount: 99999, material: "Otra" });
      await ctx.db.patch("timbreShippingOptions", p.shippingOptionId, { priceAmount: 99999 }); });
    await expect(f.admin.mutation(api.timbre_commerce.adminUpdatePlateOrder, { id: plateId, status: "paid" })).rejects.toThrow(/no está permitido/);
    await expect(f.admin.mutation(api.timbre_commerce.adminUpdatePlateOrder, { id: plateId, status: "production" })).rejects.toThrow(/no está permitido/);
    await verified(f, order.orderId); const after = (await f.buyer.query(api.timbre_commerce.myPlateOrders, {}))[0];
    expect(after).toMatchObject({ amount: 23000, variant: { priceAmount: 20000, material: "Material de prueba configurado por admin" }, shipping: { priceAmount: 3000 }, status: "paid" });
    expect((await f.buyer.query(api.timbre_commerce.myLicenses, {}))[0]).toMatchObject({ source: "hardware_bundle", active: true });
    await verified(f, order.orderId, { status: "refunded", eventKey: "plate-refund" });
    expect((await f.buyer.query(api.timbre_commerce.myPlateOrders, {}))[0].status).toBe("refunded");
    expect((await f.buyer.query(api.timbre_commerce.myLicense, {})).active).toBe(false);
  });
  it("validates print contrast, exact dimensions and shipping coverage before ordering", async () => {
    const f = await fixture(); const p = await plateFixture(f);
    const input = { ...p, design, shippingAddress: address };
    await expect(f.buyer.mutation(api.timbre_commerce.createPlateOrder, { ...input, design: { ...design, qrColor: "#EEEEEE" } })).rejects.toThrow(/contraste/i);
    await expect(f.buyer.mutation(api.timbre_commerce.createPlateOrder, { ...input, design: { ...design, widthMm: 100 } })).rejects.toThrow(/dimensiones/);
    await expect(f.buyer.mutation(api.timbre_commerce.createPlateOrder, { ...input, shippingAddress: { ...address, region: "Fuera de cobertura" } })).rejects.toThrow(/envío disponible/);
    await expect(f.buyer.query(api.timbre_commerce.adminOverview, {})).rejects.toThrow(/permiso/);
  });
  it("requires a paid order, active QR, production file and tracking for fulfillment", async () => {
    const f = await fixture(); await enable(f); const p = await plateFixture(f);
    const plateId = await f.buyer.mutation(api.timbre_commerce.createPlateOrder, { ...p, design, shippingAddress: address });
    const order = await f.buyer.mutation(internal.timbre_commerce.reservePlateOrder, { id: plateId }); await verified(f, order.orderId);
    await expect(f.admin.query(api.timbre_commerce.productionExport, { id: plateId })).rejects.toThrow(/QR/);
    await bindQr(f, plateId);
    await expect(f.admin.mutation(api.timbre_commerce.adminUpdatePlateOrder, { id: plateId, status: "production" })).rejects.toThrow(/archivo de producción/);
    const storageId = await storeProductionPdf(f);
    await f.admin.mutation(api.timbre_commerce.recordProductionFile, { id: plateId, storageId, fileName: "placa-test.pdf", expectedQrToken: "a".repeat(64) });
    await f.admin.mutation(api.timbre_commerce.adminUpdatePlateOrder, { id: plateId, status: "production" });
    await expect(f.admin.mutation(api.timbre_commerce.recordProductionFile, { id: plateId, storageId, fileName: "replacement.pdf", expectedQrToken: "a".repeat(64) })).rejects.toThrow(/inmovilizado/);
    await f.admin.mutation(api.timbre_commerce.adminUpdatePlateOrder, { id: plateId, status: "ready" });
    await expect(f.admin.mutation(api.timbre_commerce.adminUpdatePlateOrder, { id: plateId, status: "shipped" })).rejects.toThrow(/seguimiento/);
    await f.admin.mutation(api.timbre_commerce.adminUpdatePlateOrder, { id: plateId, status: "shipped", carrier: "Operador real de prueba", trackingReference: "TEST-123" });
    await f.admin.mutation(api.timbre_commerce.adminUpdatePlateOrder, { id: plateId, status: "delivered" });
    expect((await f.admin.query(api.timbre_commerce.productionExport, { id: plateId })).print).toMatchObject({ minimumDpi: 300, quietZoneModules: 4, widthMm: 90, heightMm: 130 });
    await expect(f.buyer.query(api.timbre_commerce.productionExport, { id: plateId })).rejects.toThrow(/permiso/);
  });
  it("rejects a QR rotation between export and upload and invalidates stale production files", async () => {
    const f = await fixture(); await enable(f); const p = await plateFixture(f);
    const plateId = await f.buyer.mutation(api.timbre_commerce.createPlateOrder, { ...p, design, shippingAddress: address });
    const order = await f.buyer.mutation(internal.timbre_commerce.reservePlateOrder, { id: plateId }); await verified(f, order.orderId);
    const qrId = await bindQr(f, plateId); const preview = await f.admin.query(api.timbre_commerce.productionExport, { id: plateId });
    const storageId = await storeProductionPdf(f);
    await f.t.run((ctx) => ctx.db.patch("timbreQrs", qrId, { token: "b".repeat(64) }));
    await expect(f.admin.mutation(api.timbre_commerce.recordProductionFile, { id: plateId, storageId, fileName: "stale.pdf", expectedQrToken: preview.qrToken })).rejects.toThrow(/QR cambió/);
    await f.buyer.mutation(api.timbre_commerce.attachPlateQr, { id: plateId, qrId });
    await f.admin.mutation(api.timbre_commerce.recordProductionFile, { id: plateId, storageId, fileName: "fresh.pdf", expectedQrToken: "b".repeat(64) });
    await f.t.run((ctx) => ctx.db.patch("timbreQrs", qrId, { token: "c".repeat(64) }));
    await expect(f.admin.mutation(api.timbre_commerce.adminUpdatePlateOrder, { id: plateId, status: "production" })).rejects.toThrow(/QR o el archivo cambió/);
    await f.buyer.mutation(api.timbre_commerce.attachPlateQr, { id: plateId, qrId });
    expect((await f.buyer.query(api.timbre_commerce.myPlateOrders, {}))[0].productionFileId).toBeUndefined();
  });
});
