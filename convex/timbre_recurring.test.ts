import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { addBillingMonths, billingPeriodBounds, paidCoverage, verifyRecurringSignature } from "./lib/timbre_recurring_provider";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const features = { audio: true, video: true, chat: true, messages: true, families: true, buildings: false, offices: false, access: false };
const limits = { maxSites: 1, maxQrs: 2, maxMembers: 3, maxUnits: 1 };
const providerId = "0123456789abcdef0123456789abcdef";
async function fixture() {
  const t = convexTest(schema, modules);
  const { adminId, ownerId, otherId } = await t.run(async (ctx) => ({ adminId: await ctx.db.insert("users", { email: "admin@example.test" }),
    ownerId: await ctx.db.insert("users", { email: "owner@example.test" }), otherId: await ctx.db.insert("users", { email: "other@example.test" }) }));
  vi.stubEnv("MARKETPLACE_ADMIN_USER_IDS", adminId);
  for (const key of ["MP_ACCESS_TOKEN", "MP_CLIENT_SECRET", "MP_WEBHOOK_SECRET", "MP_TOKEN_ENCRYPTION_KEY"]) vi.stubEnv(key, "local-test-only");
  vi.stubEnv("MP_APPLICATION_ID", "42"); vi.stubEnv("MP_COLLECTOR_ID", "99"); vi.stubEnv("MP_MODE", "live");
  vi.stubEnv("SITE_URL", "https://viso.example.test");
  const admin = t.withIdentity({ subject: `${adminId}|admin` }), owner = t.withIdentity({ subject: `${ownerId}|owner` }), other = t.withIdentity({ subject: `${otherId}|other` });
  await admin.mutation(api.marketplace_payments.saveSettings, { enabled: true, splitApproved: true, policiesAccepted: true, digitalCommissionBps: 1000 });
  const planId = await admin.mutation(api.timbre_commerce.savePlan, { code: "digital", name: "Suscripción de prueba local", description: "No es una tarifa real.",
    enabled: true, priceAmount: 12345, currency: "ARS", period: "monthly", features, limits });
  const state = { preapproval: { id: providerId, payer_id: 77, payer_email: "owner@example.test", collector_id: 99, application_id: 42,
    status: "pending", external_reference: "", init_point: `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=${providerId}`,
    auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 123.45, currency_id: "ARS" } } as Record<string, unknown>,
    invoices: new Map<string, Record<string, unknown>>(), payments: new Map<string, Record<string, unknown>>(), requests: [] as Array<{ url: string; method: string; body?: Record<string, unknown> }> };
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url).replace("https://api.mercadopago.com", ""), method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    state.requests.push({ url: String(url), method, body });
    if (path === "/preapproval/" && method === "POST") {
      state.preapproval.external_reference = body.external_reference;
      return Response.json(state.preapproval);
    }
    if (path === `/preapproval/${providerId}`) {
      if (method === "PUT") state.preapproval.status = body.status;
      return Response.json(state.preapproval);
    }
    if (path.startsWith("/authorized_payments/")) return Response.json(state.invoices.get(path.split("/").pop()!) ?? { error: "notfound" });
    if (path.startsWith("/v1/payments/")) return Response.json(state.payments.get(path.split("/").pop()!) ?? { error: "notfound" });
    throw new Error(`Unexpected mocked provider request ${method} ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { t, adminId, ownerId, otherId, admin, owner, other, planId, state, fetchMock };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function checkout(f: Fixture) {
  vi.stubEnv("TIMBRE_RECURRING_ENABLED", "true"); return f.owner.action(api.timbre_recurring.createSubscriptionCheckout, { planId: f.planId });
}
function invoice(f: Fixture, id = "1001", paymentId = "9001", start?: number) {
  const now = new Date(), startsAt = start ?? Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  f.state.preapproval.status = "authorized";
  f.state.preapproval.next_payment_date = new Date(addBillingMonths(startsAt, 1)).toISOString();
  f.state.invoices.set(id, { id, preapproval_id: providerId, external_reference: f.state.preapproval.external_reference, payer_id: 77,
    currency_id: "ARS", transaction_amount: 123.45, debit_date: new Date(startsAt).toISOString(), status: "processed", payment: { id: paymentId, status: "approved" } });
  f.state.payments.set(paymentId, { id: paymentId, external_reference: f.state.preapproval.external_reference, payer: { id: 77 }, collector_id: 99,
    transaction_amount: 123.45, currency_id: "ARS", live_mode: true, status: "approved", date_approved: new Date().toISOString() });
  return { id, paymentId, startsAt };
}
async function notification(f: Fixture, resourceId = "1001", topic: "subscription_preapproval" | "subscription_authorized_payment" | "payment" = "subscription_authorized_payment") {
  return f.t.action(internal.timbre_recurring.processNotification, { topic, resourceId });
}

describe("Timbre verified recurring Mercado Pago adapter", () => {
  it("is disabled by default and creates no provider transaction without explicit live configuration", async () => {
    const f = await fixture(); expect((await f.owner.query(api.timbre_recurring.configuration, {})).enabled).toBe(false);
    await expect(f.owner.action(api.timbre_recurring.createSubscriptionCheckout, { planId: f.planId })).rejects.toThrow(/no están habilitadas/);
    vi.stubEnv("TIMBRE_RECURRING_ENABLED", "true"); vi.stubEnv("MP_MODE", "test");
    await expect(f.owner.action(api.timbre_recurring.createSubscriptionCheckout, { planId: f.planId })).rejects.toThrow(/no están habilitadas/);
    expect(f.fetchMock).not.toHaveBeenCalled(); expect(await f.owner.query(api.timbre_commerce.myLicenses, {})).toEqual([]);
  });
  it("creates an authorization checkout using server price/email and a plain return URL, with no free trial", async () => {
    const f = await fixture(); const result = await checkout(f);
    expect(result.checkoutUrl).toBe(f.state.preapproval.init_point);
    expect(f.state.requests[0]).toMatchObject({ method: "POST", body: { external_reference: result.subscriptionId, payer_email: "owner@example.test",
      back_url: "https://viso.example.test/timbre", status: "pending", auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 123.45, currency_id: "ARS" } } });
    expect(f.state.requests[0].body).not.toHaveProperty("card_token_id"); expect(f.state.requests[0].body?.auto_recurring).not.toHaveProperty("free_trial");
    expect(await f.owner.action(api.timbre_recurring.createSubscriptionCheckout, { planId: f.planId })).toEqual(result);
    expect(f.state.requests.filter((x) => x.method === "POST")).toHaveLength(1);
    f.state.preapproval.status = "authorized";
    expect(await f.owner.action(api.timbre_recurring.refreshSubscription, { id: result.subscriptionId })).toEqual({ status: "authorized", activated: false });
    expect(await f.owner.query(api.timbre_commerce.myLicenses, {})).toEqual([]);
    await expect(f.other.action(api.timbre_recurring.refreshSubscription, { id: result.subscriptionId })).rejects.toThrow(/tu cuenta/);
  });
  it("grants only a fully verified live invoice/payment and keeps purchased terms after plan edits", async () => {
    const f = await fixture(); const result = await checkout(f); const charge = invoice(f);
    await f.t.run((ctx) => ctx.db.patch("timbrePlans", f.planId, { priceAmount: 99999, features: { ...features, video: false } }));
    await notification(f); await notification(f);
    const licenses = await f.owner.query(api.timbre_commerce.myLicenses, {});
    expect(licenses).toHaveLength(1); expect(licenses[0]).toMatchObject({ status: "active", active: true, source: "subscription", features,
      startsAt: charge.startsAt, expiresAt: addBillingMonths(charge.startsAt, 1) });
    expect((await f.owner.query(api.timbre_recurring.mySubscriptions, {}))[0]).toMatchObject({ _id: result.subscriptionId, periods: [{ paymentId: charge.paymentId, amount: 12345 }] });
    expect(await f.other.query(api.timbre_commerce.myLicenses, {})).toEqual([]);
  });
  it("rejects wrong identity, price, reference, currency, payer, test mode and missing billing dates", async () => {
    const f = await fixture(); await checkout(f); invoice(f);
    const original = { ...f.state.payments.get("9001")! };
    for (const change of [{ live_mode: false }, { collector_id: 1 }, { transaction_amount: 1 }, { currency_id: "USD" }, { payer: { id: 1 } }, { external_reference: "another" }, { date_approved: undefined }]) {
      f.state.payments.set("9001", { ...original, ...change }); await expect(notification(f)).rejects.toThrow();
      expect(await f.owner.query(api.timbre_commerce.myLicenses, {})).toEqual([]);
    }
    f.state.payments.set("9001", original); f.state.preapproval.application_id = 1;
    await expect(notification(f)).rejects.toThrow(/no coincide/); f.state.preapproval.application_id = 42;
    f.state.invoices.get("1001")!.debit_date = undefined;
    await expect(notification(f)).rejects.toThrow(/fecha de facturación/);
  });
  it("renews the same license by calendar periods, revokes refunded coverage and ignores stale approval", async () => {
    const f = await fixture(); await checkout(f); const first = invoice(f); await notification(f);
    const licenseId = (await f.owner.query(api.timbre_commerce.myLicenses, {}))[0]._id;
    const second = invoice(f, "1002", "9002", addBillingMonths(first.startsAt, 1)); await notification(f, second.id);
    let licenses = await f.owner.query(api.timbre_commerce.myLicenses, {});
    expect(licenses).toHaveLength(1); expect(licenses[0]).toMatchObject({ _id: licenseId, expiresAt: addBillingMonths(second.startsAt, 1) });
    f.state.payments.get(second.paymentId)!.status = "refunded"; await notification(f, second.paymentId, "payment");
    licenses = await f.owner.query(api.timbre_commerce.myLicenses, {}); expect(licenses[0].expiresAt).toBe(addBillingMonths(first.startsAt, 1));
    f.state.payments.get(first.paymentId)!.status = "charged_back"; await notification(f, first.paymentId, "payment");
    expect((await f.owner.query(api.timbre_commerce.myLicense, {})).active).toBe(false);
    f.state.payments.get(first.paymentId)!.status = "approved"; await notification(f, first.id);
    expect((await f.owner.query(api.timbre_commerce.myLicense, {})).active).toBe(false);
  });
  it("does not overwrite an administrator revocation when a renewal is paid", async () => {
    const f = await fixture(); await checkout(f); const first = invoice(f); await notification(f);
    const license = (await f.owner.query(api.timbre_commerce.myLicenses, {}))[0];
    await f.admin.mutation(api.timbre_commerce.revokeLicense, { id: license._id, reason: "Revocación administrativa de prueba" });
    const next = invoice(f, "1002", "9002", addBillingMonths(first.startsAt, 1)); await notification(f, next.id);
    expect((await f.owner.query(api.timbre_commerce.myLicense, {})).active).toBe(false);
  });
  it("revokes a partially refunded invoice even when MP still reports approved", async () => {
    const f = await fixture(); await checkout(f); invoice(f); await notification(f);
    f.state.payments.get("9001")!.transaction_amount_refunded = 1;
    await notification(f, "9001", "payment");
    expect((await f.owner.query(api.timbre_commerce.myLicense, {})).active).toBe(false);
    expect((await f.owner.query(api.timbre_recurring.mySubscriptions, {}))[0].periods[0].status).toBe("refunded");
  });
  it("schedules disjoint prepaid coverage at its start without a new payment webhook", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-01-15T00:00:00Z"));
    const f = await fixture(); const checkoutResult = await checkout(f);
    invoice(f, "1001", "9001", Date.parse("2026-01-01T00:00:00Z")); await notification(f, "1001");
    invoice(f, "1003", "9003", Date.parse("2026-03-01T00:00:00Z")); await notification(f, "1003");
    let row = (await f.owner.query(api.timbre_recurring.mySubscriptions, {}))[0];
    expect(row.coverageScheduledAt).toBe(Date.parse("2026-02-01T00:00:00Z"));
    // Execute the exact persisted boundary job as the scheduler would. This
    // avoids Node's 24.8-day timeout cap in the local Convex test scheduler.
    vi.setSystemTime(new Date("2026-02-01T00:00:00Z"));
    await f.t.mutation(internal.timbre_recurring.recalculateCoverage, { id: checkoutResult.subscriptionId, at: row.coverageScheduledAt! });
    expect((await f.owner.query(api.timbre_commerce.myLicense, {})).active).toBe(false);
    row = (await f.owner.query(api.timbre_recurring.mySubscriptions, {}))[0];
    expect(row.coverageScheduledAt).toBe(Date.parse("2026-03-01T00:00:00Z"));
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));
    await f.t.mutation(internal.timbre_recurring.recalculateCoverage, { id: checkoutResult.subscriptionId, at: row.coverageScheduledAt! });
    expect((await f.owner.query(api.timbre_commerce.myLicenses, {}))[0]).toMatchObject({ active: true, startsAt: Date.parse("2026-03-01T00:00:00Z"), expiresAt: Date.parse("2026-04-01T00:00:00Z") });
    vi.clearAllTimers();
  });
  it("cancels at the provider, confirms status, and preserves the already paid period", async () => {
    const f = await fixture(); const result = await checkout(f); const first = invoice(f); await notification(f);
    await expect(f.other.action(api.timbre_recurring.cancelSubscription, { id: result.subscriptionId })).rejects.toThrow(/tu cuenta/);
    expect(await f.owner.action(api.timbre_recurring.cancelSubscription, { id: result.subscriptionId })).toEqual({ status: "cancelled", providerCancellationPending: false });
    expect(f.state.requests.some((x) => x.method === "PUT" && x.body?.status === "cancelled")).toBe(true);
    expect((await f.owner.query(api.timbre_commerce.myLicenses, {}))[0]).toMatchObject({ active: true, expiresAt: addBillingMonths(first.startsAt, 1) });
  });
  it("does not blindly retry a subscription POST whose outcome is unknown", async () => {
    const f = await fixture(); vi.stubEnv("TIMBRE_RECURRING_ENABLED", "true"); f.fetchMock.mockRejectedValueOnce(new Error("Unknown network result"));
    await expect(f.owner.action(api.timbre_recurring.createSubscriptionCheckout, { planId: f.planId })).rejects.toThrow(/Unknown/);
    await expect(f.owner.action(api.timbre_recurring.createSubscriptionCheckout, { planId: f.planId })).rejects.toThrow(/cobro duplicado/);
    expect(f.fetchMock).toHaveBeenCalledTimes(1); expect(await f.owner.query(api.timbre_commerce.myLicenses, {})).toEqual([]);
  });
  it("rejects reusing a marketplace payment for a subscription period", async () => {
    const f = await fixture(); await checkout(f); invoice(f);
    await f.t.run((ctx) => ctx.db.insert("marketplaceOrders", { buyerId: f.ownerId, sellerId: f.adminId, productId: "other", title: "Otra compra", currency: "ARS", amount: 12345,
      commissionBps: 0, commissionAmount: 0, sellerAmount: 12345, sellerProviderUserId: "99", providerMode: "live", status: "approved", paymentId: "9001", paidAt: Date.now(),
      productSnapshot: { productId: "other", title: "Otra compra", category: "icons", creatorName: "VISO", delivery: "assets", assets: [] }, createdAt: Date.now(), updatedAt: Date.now() }));
    await expect(notification(f)).rejects.toThrow(/otra factura o compra/); expect(await f.owner.query(api.timbre_commerce.myLicenses, {})).toEqual([]);
  });
  it("bounds webhook bytes, rejects unsigned calls, and deduplicates equivalent signed replays", async () => {
    const f = await fixture(); await checkout(f);
    const path = `/timbre/payments/webhook?data.id=${providerId}`;
    expect((await f.t.fetch(path, { method: "POST", body: "x".repeat(8193) })).status).toBe(413);
    expect((await f.t.fetch(path, { method: "POST", body: JSON.stringify({ type: "subscription_preapproval", data: { id: providerId } }) })).status).toBe(401);
    const ts = String(Math.floor(Date.now() / 1000)), requestId = "webhook-test-request";
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("local-test-only"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`id:${providerId};request-id:${requestId};ts:${ts};`));
    const hash = Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, "0")).join("");
    const headers = { "x-request-id": requestId, "x-signature": `ts=${ts},v1=${hash}` };
    const payload = { type: "subscription_preapproval", data: { id: providerId }, status: "approved" };
    const before = f.fetchMock.mock.calls.length;
    expect((await f.t.fetch(path, { method: "POST", headers, body: JSON.stringify(payload) })).status).toBe(200);
    expect(f.fetchMock.mock.calls.length).toBe(before + 1);
    expect((await f.t.fetch(path.replace(providerId, providerId.toUpperCase()), { method: "POST",
      headers: { ...headers, "x-signature": `v1=${hash.toUpperCase()},ts=${ts}` }, body: JSON.stringify({ ...payload, data: { id: providerId.toUpperCase() } }) })).status).toBe(200);
    expect(f.fetchMock.mock.calls.length).toBe(before + 1);
    expect(await f.owner.query(api.timbre_commerce.myLicenses, {})).toEqual([]);
  });
});

describe("Recurring dates and signed notification boundary", () => {
  it("uses calendar month/year boundaries and never fills an unpaid gap", () => {
    expect(new Date(addBillingMonths(Date.parse("2024-01-31T15:00:00Z"), 1)).toISOString()).toBe("2024-02-29T15:00:00.000Z");
    expect(new Date(addBillingMonths(Date.parse("2024-02-29T15:00:00Z"), 12)).toISOString()).toBe("2025-02-28T15:00:00.000Z");
    expect(paidCoverage([{ startsAt: 100, endsAt: 200, status: "approved" }, { startsAt: 300, endsAt: 400, status: "approved" }], 250)).toEqual({ startsAt: 300, endsAt: 400 });
    expect(paidCoverage([{ startsAt: 100, endsAt: 200, status: "refunded" }], 150)).toBeNull();
    const january31 = Date.parse("2025-01-31T15:00:00Z"), february28 = Date.parse("2025-02-28T15:00:00Z"), march31 = Date.parse("2025-03-31T15:00:00Z");
    expect(billingPeriodBounds(january31, 1, undefined, february28)).toEqual({ endsAt: february28, anchorDay: 31 });
    expect(billingPeriodBounds(february28, 1, 31, march31)).toEqual({ endsAt: march31, anchorDay: 31 });
    expect(billingPeriodBounds(february28, 1, 31, Date.parse("2025-06-30T15:00:00Z"))).toEqual({ endsAt: march31, anchorDay: 31 });
    expect(() => billingPeriodBounds(february28, 1)).toThrow(/próxima fecha/);
  });
  it("verifies alphanumeric resource signatures with timestamp freshness", async () => {
    const now = Date.now(), ts = String(Math.floor(now / 1000)), secret = "local-test-only", requestId = "request-test-123";
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`id:${providerId};request-id:${requestId};ts:${ts};`));
    const hash = Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, "0")).join("");
    const input = { signature: `ts=${ts},v1=${hash}`, requestId, resourceId: providerId.toUpperCase(), secret, now };
    expect(await verifyRecurringSignature(input)).toBe(true);
    expect(await verifyRecurringSignature({ ...input, now: now + 360_000 })).toBe(false);
    expect(await verifyRecurringSignature({ ...input, resourceId: "different" })).toBe(false);
    expect(await verifyRecurringSignature({ ...input, signature: null })).toBe(false);
  });
});
