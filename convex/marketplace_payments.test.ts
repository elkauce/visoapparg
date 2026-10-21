import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { encryptPaymentToken, hashPaymentState, verifyPaymentSignature, commissionFor, providerAmountToMinor } from "./lib/marketplace_payment_provider";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function providerEnvs() {
  for (const name of ["MP_APPLICATION_ID", "MP_CLIENT_SECRET", "MP_ACCESS_TOKEN", "MP_WEBHOOK_SECRET"]) vi.stubEnv(name, "local-test-only");
  vi.stubEnv("MP_TOKEN_ENCRYPTION_KEY", btoa("0123456789abcdef0123456789abcdef"));
  vi.stubEnv("MP_MODE", "test");
  vi.stubEnv("MP_COLLECTOR_ID", "99");
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
  vi.stubEnv("SITE_URL", "https://viso.example.test");
}
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const adminId = await ctx.db.insert("users", { email: "admin@example.test" });
    const sellerId = await ctx.db.insert("users", { email: "seller@example.test" });
    const buyerId = await ctx.db.insert("users", { email: "buyer@example.test" });
    const productId = await ctx.db.insert("marketplaceProducts", {
      userId: sellerId, creatorName: "Creador", title: "Iconos premium", description: "Un recurso de prueba.",
      category: "icons", priceMode: "paid", priceAmount: 12345, currency: "ARS", affiliate: false,
      delivery: "assets", assets: [{ id: "first", name: "Icono", mediaType: "image", builtinPath: "/marketplace/test/icon.png" }],
      status: "published", revision: 1, createdAt: Date.now(), updatedAt: Date.now(),
    });
    return { adminId, sellerId, buyerId, productId };
  });
  vi.stubEnv("MARKETPLACE_ADMIN_USER_IDS", ids.adminId);
  return { t, ...ids, admin: t.withIdentity({ subject: `${ids.adminId}|admin` }),
    seller: t.withIdentity({ subject: `${ids.sellerId}|seller` }), buyer: t.withIdentity({ subject: `${ids.buyerId}|buyer` }) };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function enable(f: Fixture, rate = 1250) {
  providerEnvs();
  await f.admin.mutation(api.marketplace_payments.saveSettings, {
    digitalCommissionBps: rate, enabled: true, splitApproved: true, policiesAccepted: true,
  });
  await f.t.mutation(internal.marketplace_payments.storeAccount, {
    userId: f.sellerId, providerUserId: "123", encryptedAccessToken: await encryptPaymentToken("seller-test-token"),
  });
}
async function reserve(f: Fixture) {
  return f.buyer.mutation(internal.marketplace_payments.reserveOrder, { productId: f.productId });
}
async function verified(f: Fixture, orderId: Awaited<ReturnType<typeof reserve>>["orderId"], extra: Record<string, unknown> = {}) {
  return f.t.mutation(internal.marketplace_payments.applyVerifiedPayment, {
    orderId, paymentId: "777", amount: 12345, currency: "ARS", collectorId: "123", externalReference: orderId,
    liveMode: false, status: "approved", eventKey: "777:approved:1", ...extra,
  });
}

describe("Marketplace payment controls and snapshots", () => {
  it("requires login, immutable admin grants and configured provider before enabling payment", async () => {
    const f = await fixture();
    await expect(f.t.query(api.marketplace_payments.configuration, {})).rejects.toThrow(/iniciar sesión/);
    await expect(f.buyer.mutation(api.marketplace_payments.saveSettings, { enabled: false, splitApproved: false, policiesAccepted: false })).rejects.toThrow(/permiso/);
    expect((await f.admin.query(api.marketplace_payments.configuration, {})).enabled).toBe(false);
    await expect(f.admin.mutation(api.marketplace_payments.saveSettings, { digitalCommissionBps: 1500, enabled: true, splitApproved: true, policiesAccepted: true })).rejects.toThrow(/Completá/);
    await expect(reserve(f)).rejects.toThrow(/no están habilitados/);
    await expect(f.admin.mutation(api.marketplace_payments.saveSettings, { digitalCommissionBps: 10001, enabled: false, splitApproved: false, policiesAccepted: false })).rejects.toThrow(/comisión/);
  });

  it("snapshots configurable commission and licensed content before the provider call", async () => {
    const f = await fixture(); await enable(f);
    const first = await reserve(f);
    expect(first.commissionAmount).toBe(1543);
    await f.admin.mutation(api.marketplace_payments.saveSettings, { digitalCommissionBps: 2000, enabled: true, splitApproved: true, policiesAccepted: true });
    const second = await reserve(f);
    const before = await f.t.run((ctx) => ctx.db.get("marketplaceOrders", first.orderId));
    const after = await f.t.run((ctx) => ctx.db.get("marketplaceOrders", second.orderId));
    expect(before).toMatchObject({ amount: 12345, commissionBps: 1250, commissionAmount: 1543, sellerAmount: 10802, status: "pending" });
    expect(after).toMatchObject({ commissionBps: 2000, commissionAmount: 2469 });
    expect(await f.buyer.query(api.marketplace.library, {})).toEqual([]);
    await f.t.run((ctx) => ctx.db.patch("marketplaceProducts", f.productId, {
      title: "Nuevo título", assets: [{ id: "replacement", name: "Otro", mediaType: "image", builtinPath: "/marketplace/test/replaced.png" }],
    }));
    await verified(f, first.orderId);
    const library = await f.buyer.query(api.marketplace.library, {});
    expect(library).toHaveLength(1);
    expect(library[0]).toMatchObject({ title: "Iconos premium", assets: [{ id: "first" }] });
  });

  it("rejects wrong amounts, recipients, currencies, references and live/test mode before entitlement", async () => {
    const f = await fixture(); await enable(f); const order = await reserve(f);
    for (const change of [{ amount: 12344 }, { collectorId: "wrong" }, { currency: "USD" }, { externalReference: "other" }, { liveMode: true }]) {
      await expect(verified(f, order.orderId, change)).rejects.toThrow(/no coincide/);
    }
    expect(await f.buyer.query(api.marketplace.library, {})).toEqual([]);
    await verified(f, order.orderId);
    await verified(f, order.orderId);
    await verified(f, order.orderId, { status: "pending", eventKey: "late-pending" });
    expect(await f.buyer.query(api.marketplace.library, {})).toHaveLength(1);
    expect((await f.t.run((ctx) => ctx.db.get("marketplaceOrders", order.orderId)))?.status).toBe("approved");
    const otherOrder = await f.t.run(async (ctx) => {
      const original = (await ctx.db.get("marketplaceOrders", order.orderId))!;
      const { _id: _ignoreId, _creationTime: _ignoreCreationTime, paymentId: _ignorePayment, ...values } = original;
      void _ignoreId; void _ignoreCreationTime; void _ignorePayment;
      return ctx.db.insert("marketplaceOrders", { ...values, status: "pending" });
    });
    await expect(verified(f, otherOrder)).rejects.toThrow(/otra compra/);
  });

  it("keeps physical category disabled until its own rate is defined and never charges affiliates/free", async () => {
    const f = await fixture(); await enable(f);
    await f.t.run((ctx) => ctx.db.patch("marketplaceProducts", f.productId, { category: "hardware", assets: [], delivery: "inquiry" }));
    await expect(reserve(f)).rejects.toThrow(/entrega y garantía/);
    await f.t.run((ctx) => ctx.db.patch("marketplaceProducts", f.productId, { category: "icons", priceMode: "external", affiliate: true, externalUrl: "https://meli.la/test" }));
    await expect(reserve(f)).rejects.toThrow(/sitio externo/);
    await f.t.run((ctx) => ctx.db.patch("marketplaceProducts", f.productId, { priceMode: "free", affiliate: false }));
    await expect(reserve(f)).rejects.toThrow(/sitio externo/);
  });

  it("collects VISO own sales without self commission and hides account tokens from all public queries", async () => {
    const f = await fixture(); await enable(f);
    await f.t.run((ctx) => ctx.db.patch("marketplaceProducts", f.productId, { userId: f.adminId }));
    const order = await reserve(f);
    expect(order.commissionAmount).toBe(0);
    const stored = await f.t.run((ctx) => ctx.db.get("marketplaceOrders", order.orderId));
    expect(stored?.sellerProviderUserId).toBe("99");
    const publicAccount = await f.seller.query(api.marketplace_payments.account, {});
    expect(publicAccount).toEqual({ connected: true, providerUserId: "123", country: "AR", updatedAt: expect.any(Number) });
    expect(JSON.stringify(publicAccount)).not.toMatch(/token/i);
    expect(await f.seller.query(api.marketplace_payments.myOrders, {})).toEqual([]);
    expect(await f.buyer.query(api.marketplace_payments.myOrders, {})).toHaveLength(1);
  });

  it("calls the provider with one seller, trusted amount and snapshot commission; callback alone grants nothing", async () => {
    const f = await fixture(); await enable(f);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "preference-1", sandbox_init_point: "https://sandbox.mercadopago.com.ar/checkout/test" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const checkout = await f.buyer.action(api.marketplace_payments.createCheckout, { productId: f.productId });
    expect(checkout.checkoutUrl).toMatch(/^https:\/\/sandbox.mercadopago.com.ar\//);
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.items).toEqual([{ id: f.productId, title: "Iconos premium", quantity: 1, unit_price: 123.45, currency_id: "ARS" }]);
    expect(request.marketplace_fee).toBe(15.43);
    expect(request.external_reference).toBe(checkout.orderId);
    expect(request.notification_url).toContain(`order_id=${checkout.orderId}`);
    expect(await f.buyer.query(api.marketplace.library, {})).toEqual([]);
  });

  it("delivers the original paid snapshot once after a signed approval for a 10 percent split checkout", async () => {
    const f = await fixture(); await enable(f, 1000);
    await f.t.run((ctx) => ctx.db.patch("marketplaceProducts", f.productId, { priceAmount: 10000 }));
    let providerOrderId = "";
    const fetchMock = vi.fn(async (url: string, request: RequestInit = {}) => {
      if (url === "https://api.mercadopago.com/checkout/preferences") {
        providerOrderId = JSON.parse(String(request.body)).external_reference;
        return new Response(JSON.stringify({
          id: "preference-ten-percent", sandbox_init_point: "https://sandbox.mercadopago.com.ar/checkout/test",
        }), { status: 200 });
      }
      if (url === "https://api.mercadopago.com/v1/payments/777") {
        return new Response(JSON.stringify({
          id: 777, transaction_amount: 100, currency_id: "ARS", collector_id: 123,
          external_reference: providerOrderId, live_mode: false, status: "approved",
          date_last_updated: "2026-10-21T12:00:00Z",
        }), { status: 200 });
      }
      throw new Error("Unexpected simulated provider request");
    });
    vi.stubGlobal("fetch", fetchMock);

    const checkout = await f.buyer.action(api.marketplace_payments.createCheckout, { productId: f.productId });
    const orderId = await f.t.run(async (ctx) => ctx.db.normalizeId("marketplaceOrders", checkout.orderId));
    if (orderId === null) throw new Error("Checkout did not return a valid marketplace order ID");
    const preference = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(preference.items).toEqual([{ id: f.productId, title: "Iconos premium", quantity: 1, unit_price: 100, currency_id: "ARS" }]);
    expect(preference.marketplace_fee).toBe(10);
    expect(preference.external_reference).toBe(checkout.orderId);
    expect(preference.notification_url).toContain(`order_id=${checkout.orderId}`);
    expect(await f.buyer.query(api.marketplace.library, {})).toEqual([]);
    expect(await f.t.run((ctx) => ctx.db.get("marketplaceOrders", orderId))).toMatchObject({
      amount: 10000, commissionBps: 1000, commissionAmount: 1000, sellerAmount: 9000, status: "pending",
    });

    await f.admin.mutation(api.marketplace_payments.saveSettings, {
      digitalCommissionBps: 2500, enabled: true, splitApproved: true, policiesAccepted: true,
    });
    await f.t.run((ctx) => ctx.db.patch("marketplaceProducts", f.productId, {
      title: "Edición posterior", priceAmount: 20000, revision: 2,
      assets: [{ id: "replacement", name: "Otro", mediaType: "image", builtinPath: "/marketplace/test/replaced.png" }],
    }));

    const webhookUrl = `/marketplace/payments/webhook?order_id=${checkout.orderId}&data.id=777`;
    const body = JSON.stringify({ type: "payment", data: { id: "777" } });
    expect((await f.t.fetch(webhookUrl, { method: "POST", body })).status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await f.buyer.query(api.marketplace.library, {})).toEqual([]);

    const ts = String(Math.floor(Date.now() / 1000));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("local-test-only"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const hash = [...new Uint8Array(await crypto.subtle.sign("HMAC", key,
      new TextEncoder().encode(`id:777;request-id:request-ten-percent;ts:${ts};`)))].map((value) => value.toString(16).padStart(2, "0")).join("");
    const headers = { "x-request-id": "request-ten-percent", "x-signature": `ts=${ts},v1=${hash}` };
    for (let attempt = 0; attempt < 2; attempt++) {
      expect((await f.t.fetch(webhookUrl, { method: "POST", body, headers })).status).toBe(200);
      const library = await f.buyer.query(api.marketplace.library, {});
      expect(library).toHaveLength(1);
      expect(library[0]).toMatchObject({ title: "Iconos premium", assets: [{ id: "first", builtinPath: "/marketplace/test/icon.png" }] });
    }
    expect(fetchMock.mock.calls.slice(1).map(([url]) => url)).toEqual([
      "https://api.mercadopago.com/v1/payments/777", "https://api.mercadopago.com/v1/payments/777",
    ]);
    expect(await f.t.run((ctx) => ctx.db.get("marketplaceOrders", orderId))).toMatchObject({
      amount: 10000, commissionBps: 1000, commissionAmount: 1000, sellerAmount: 9000,
      status: "approved", paymentId: "777", productSnapshot: { title: "Iconos premium", revision: 1 },
    });
    expect(await f.t.run((ctx) => ctx.db.query("marketplacePaymentWebhookEvents").collect())).toHaveLength(1);
    expect(await f.buyer.query(api.marketplace_payments.myOrders, {})).toEqual([
      expect.objectContaining({ id: checkout.orderId, title: "Iconos premium", amount: 10000, status: "approved" }),
    ]);
  });

  it("consumes OAuth state once, rejects expiry, and replaces earlier pending authorizations", async () => {
    const f = await fixture(); providerEnvs();
    const hash = await hashPaymentState("first-state");
    await f.admin.mutation(internal.marketplace_payments.createOAuthState, { stateHash: hash });
    const userId = await f.t.mutation(internal.marketplace_payments.consumeOAuthState, { stateHash: hash });
    expect(userId).toBe(f.adminId);
    await expect(f.t.mutation(internal.marketplace_payments.consumeOAuthState, { stateHash: hash })).rejects.toThrow(/venció/);
    const expiredHash = await hashPaymentState("expired-state");
    await f.t.run((ctx) => ctx.db.insert("marketplacePaymentOAuthStates", { userId: f.adminId, stateHash: expiredHash, createdAt: 1, expiresAt: 2 }));
    await expect(f.t.mutation(internal.marketplace_payments.consumeOAuthState, { stateHash: expiredHash })).rejects.toThrow(/venció/);
    await f.admin.mutation(internal.marketplace_payments.createOAuthState, { stateHash: await hashPaymentState("next") });
    const rows = await f.t.run((ctx) => ctx.db.query("marketplacePaymentOAuthStates").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].consumedAt).toBeUndefined();
  });

  it("accepts a successful new payment attempt after a declined one, and never reuses earlier attempt IDs", async () => {
    const f = await fixture(); await enable(f); const order = await reserve(f);
    await verified(f, order.orderId, { paymentId: "700", status: "rejected", eventKey: "700:rejected" });
    expect(await f.buyer.query(api.marketplace.library, {})).toEqual([]);
    await verified(f, order.orderId, { paymentId: "701", status: "approved", eventKey: "701:approved" });
    expect(await f.buyer.query(api.marketplace.library, {})).toHaveLength(1);
    expect((await f.t.run((ctx) => ctx.db.get("marketplaceOrders", order.orderId)))?.paymentId).toBe("701");
    const another = await f.t.run(async (ctx) => {
      const original = (await ctx.db.get("marketplaceOrders", order.orderId))!;
      const { _id: id, _creationTime: time, paymentId, ...values } = original;
      void id; void time; void paymentId;
      return ctx.db.insert("marketplaceOrders", { ...values, status: "pending" });
    });
    await expect(verified(f, another, { paymentId: "700", eventKey: "700:approved" })).rejects.toThrow(/otra compra/);
  });

  it("keeps old orders verifiable after disconnect while preventing new seller checkouts", async () => {
    const f = await fixture(); await enable(f); const order = await reserve(f);
    await f.seller.mutation(api.marketplace_payments.disconnect, {});
    expect((await f.seller.query(api.marketplace_payments.account, {})).connected).toBe(false);
    await expect(reserve(f)).rejects.toThrow(/no vinculó/);
    await expect(f.t.action(internal.marketplace_payments.sellerToken, { userId: f.sellerId })).rejects.toThrow(/conectar/);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 777, transaction_amount: 123.45, currency_id: "ARS", collector_id: 123,
      external_reference: order.orderId, live_mode: false, status: "approved", date_last_updated: "2026-10-20T12:00:00Z",
    }), { status: 200 })));
    await f.t.action(internal.marketplace_payments.processNotification, { orderId: order.orderId, paymentId: "777" });
    expect(await f.buyer.query(api.marketplace.library, {})).toHaveLength(1);
    expect((await f.seller.query(api.marketplace_payments.account, {})).connected).toBe(false);
  });

  it("verifies webhook signature then retrieves authoritative provider status instead of trusting submitted status", async () => {
    const f = await fixture(); await enable(f); const order = await reserve(f);
    const url = `/marketplace/payments/webhook?order_id=${order.orderId}&data.id=777`;
    const body = JSON.stringify({ type: "payment", data: { id: "777" }, status: "approved" });
    expect((await f.t.fetch(url, { method: "POST", body })).status).toBe(401);
    const ts = String(Math.floor(Date.now() / 1000));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("local-test-only"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const hash = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`id:777;request-id:request-2;ts:${ts};`)))].map((value) => value.toString(16).padStart(2, "0")).join("");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 777, transaction_amount: 123.45, currency_id: "ARS", collector_id: 123,
      external_reference: order.orderId, live_mode: false, status: "pending", date_last_updated: "pending-1",
    }), { status: 200 })));
    const result = await f.t.fetch(url, { method: "POST", body, headers: { "x-request-id": "request-2", "x-signature": `ts=${ts},v1=${hash}` } });
    expect(result.status).toBe(200);
    expect(await f.buyer.query(api.marketplace.library, {})).toEqual([]);
    expect((await f.t.run((ctx) => ctx.db.get("marketplaceOrders", order.orderId)))?.status).toBe("pending");
  });

  it("delivers a paid snapshot even if the buyer filled the free library during checkout", async () => {
    const f = await fixture(); await enable(f); const order = await reserve(f);
    await f.t.run(async (ctx) => {
      for (let n = 0; n < 500; n++) await ctx.db.insert("marketplaceLibrary", {
        userId: f.buyerId, productId: `free-${n}`, title: "Gratis", category: "icons", creatorName: "VISO", delivery: "assets", assets: [], acquiredAt: Date.now(),
      });
    });
    await verified(f, order.orderId);
    expect(await f.buyer.query(api.marketplace.library, {})).toHaveLength(501);
  });
});

describe("Payment signature and amount boundaries", () => {
  it("verifies signed notification identity and timestamp without trusting body status", async () => {
    const now = Date.now(); const ts = String(Math.floor(now / 1000));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`id:777;request-id:request-1;ts:${ts};`)))].map((v) => v.toString(16).padStart(2, "0")).join("");
    const input = { signature: `ts=${ts},v1=${signature}`, requestId: "request-1", paymentId: "777", secret: "secret", now };
    expect(await verifyPaymentSignature(input)).toBe(true);
    expect(await verifyPaymentSignature({ ...input, paymentId: "778" })).toBe(false);
    expect(await verifyPaymentSignature({ ...input, requestId: "request-2" })).toBe(false);
    expect(await verifyPaymentSignature({ ...input, now: now + 10 * 60_000 })).toBe(false);
    expect(await verifyPaymentSignature({ ...input, signature: null })).toBe(false);
  });
  it("bounds integer amounts and basis points including a zero commission", () => {
    expect(commissionFor(10000, 0)).toBe(0);
    expect(commissionFor(10000, 10000)).toBe(10000);
    expect(commissionFor(999_999_999_999, 3333)).toBe(333_300_000_000);
    expect(commissionFor(1_000_000_000_000, 10_000)).toBe(1_000_000_000_000);
    expect(commissionFor(1, 5000)).toBe(1);
    expect(providerAmountToMinor(9_999_999_999.99)).toBe(999_999_999_999);
    expect(providerAmountToMinor(123.45)).toBe(12345);
    expect(providerAmountToMinor(1.001)).toBeNull();
    expect(() => commissionFor(0, 10)).toThrow();
    expect(() => commissionFor(1.5, 10)).toThrow();
    expect(() => commissionFor(10000, 10001)).toThrow();
  });
});
