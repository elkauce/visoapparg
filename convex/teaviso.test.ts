import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { modules } from "./test.setup";
import { api, internal } from "./_generated/api";
import { googleAuthRedirect } from "./lib/google_auth_redirect";
import { teavisoOrigin } from "./lib/teaviso";

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => ({
    owner: await ctx.db.insert("users", { email: "owner@test.example" }),
    other: await ctx.db.insert("users", { email: "other@test.example" }),
  }));
  return {
    t,
    ...ids,
    me: t.withIdentity({ subject: `${ids.owner}|session` }),
    stranger: t.withIdentity({ subject: `${ids.other}|other` }),
  };
}
const form = {
  label: "Entrada",
  phone: "+54 9 11 1234 5678",
  message: "Hola & ¿podés atender?",
  enabled: true,
  consent: true,
};
afterEach(() => vi.unstubAllEnvs());
describe("Te a Viso WhatsApp QR", () => {
  it("requires an account, explicit consent and valid phone", async () => {
    const f = await fixture();
    await expect(
      f.t.mutation(api.teaviso.saveWhatsappQr, form),
    ).rejects.toThrow(/sesión/);
    await expect(
      f.me.mutation(api.teaviso.saveWhatsappQr, { ...form, consent: false }),
    ).rejects.toThrow(/Confirmá/);
    for (const phone of [
      "123",
      "javascript:alert(1)",
      "0000112345678",
      "5491112345678?text=evil",
    ])
      await expect(
        f.me.mutation(api.teaviso.saveWhatsappQr, { ...form, phone }),
      ).rejects.toThrow(/teléfono/);
    expect(await f.me.query(api.teaviso.myWhatsappQrs, {})).toEqual([]);
  });
  it("keeps the printed URL on edit and isolates account/private output", async () => {
    const f = await fixture();
    const id = await f.me.mutation(api.teaviso.saveWhatsappQr, form);
    const qr = (await f.me.query(api.teaviso.myWhatsappQrs, {}))[0];
    expect(qr.token).toMatch(/^[a-f0-9]{64}$/);
    const output = await f.t.query(api.teaviso.publicWhatsapp, {
      token: qr.token,
    });
    expect(output).toEqual({
      label: "Entrada",
      url: `https://wa.me/5491112345678?text=${encodeURIComponent(form.message)}`,
    });
    expect(JSON.stringify(output)).not.toMatch(
      /ownerId|consentAt|token|test.example/,
    );
    expect(await f.stranger.query(api.teaviso.myWhatsappQrs, {})).toEqual([]);
    await expect(
      f.stranger.mutation(api.teaviso.saveWhatsappQr, { ...form, id }),
    ).rejects.toThrow(/cuenta/);
    await expect(
      f.stranger.mutation(api.teaviso.archiveWhatsappQr, { id }),
    ).rejects.toThrow(/cuenta/);
    await f.me.mutation(api.teaviso.saveWhatsappQr, {
      ...form,
      id,
      phone: "5491187654321",
    });
    expect((await f.me.query(api.teaviso.myWhatsappQrs, {}))[0].token).toBe(
      qr.token,
    );
    expect(
      (await f.t.query(api.teaviso.publicWhatsapp, { token: qr.token }))?.url,
    ).toContain("5491187654321");
  });
  it("disables immediately, supports reenabling and archives permanently", async () => {
    const f = await fixture();
    const id = await f.me.mutation(api.teaviso.saveWhatsappQr, form);
    const qr = (await f.me.query(api.teaviso.myWhatsappQrs, {}))[0];
    await f.me.mutation(api.teaviso.saveWhatsappQr, {
      ...form,
      id,
      enabled: false,
    });
    expect(
      await f.t.query(api.teaviso.publicWhatsapp, { token: qr.token }),
    ).toBeNull();
    await f.me.mutation(api.teaviso.saveWhatsappQr, { ...form, id });
    expect(
      await f.t.query(api.teaviso.publicWhatsapp, { token: qr.token }),
    ).not.toBeNull();
    await f.me.mutation(api.teaviso.archiveWhatsappQr, { id });
    expect(await f.me.query(api.teaviso.myWhatsappQrs, {})).toEqual([]);
    expect(
      await f.t.query(api.teaviso.publicWhatsapp, { token: qr.token }),
    ).toBeNull();
    await expect(
      f.me.mutation(api.teaviso.saveWhatsappQr, { ...form, id }),
    ).rejects.toThrow(/cuenta/);
    expect(
      await f.t.query(api.teaviso.publicWhatsapp, { token: "invalid" }),
    ).toBeNull();
  });
  it("caps records even after archiving to prevent unlimited writes", async () => {
    const f = await fixture();
    await f.t.run(async (ctx) => {
      for (let i = 0; i < 50; i++)
        await ctx.db.insert("teavisoWhatsappQrs", {
          label: form.label,
          phone: form.phone,
          message: form.message,
          enabled: false,
          ownerId: f.owner,
          token: String(i).padStart(64, "0"),
          archived: true,
          consentAt: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
    });
    await expect(
      f.me.mutation(api.teaviso.saveWhatsappQr, form),
    ).rejects.toThrow(/límite/);
  });
});
describe("Business service authorization and verified payments", () => {
  it("records interest without charging or granting service; enforces ownership and admin", async () => {
    const f = await fixture();
    const id = await f.me.mutation(api.teaviso.requestBusiness, {
      businessName: "Oficina",
      contactPhone: form.phone,
      notes: "Necesito configuración",
    });
    const request = (await f.me.query(api.teaviso.myBusinessRequests, {}))[0];
    expect(request.status).toBe("requested");
    expect(request.enabled).toBe(false);
    expect(
      await f.t.query(api.teaviso.publicWhatsapp, { token: request.token }),
    ).toBeNull();
    expect(await f.stranger.query(api.teaviso.myBusinessRequests, {})).toEqual(
      [],
    );
    await expect(
      f.stranger.query(api.teaviso.adminBusiness, {}),
    ).rejects.toThrow(/permiso/);
    await expect(
      f.me.mutation(api.teaviso.saveBusinessSettings, {
        enabled: true,
        priceAmount: 10000,
        terms: "Configuración y mantenimiento definidos para el servicio.",
      }),
    ).rejects.toThrow(/permiso/);
    await expect(
      f.stranger.mutation(internal.teaviso.reserveBusinessOrder, {
        requestId: id,
        acceptedTerms: "x",
        acceptedAmount: 1,
      }),
    ).rejects.toThrow(/solicitud/);
    await expect(
      f.me.mutation(internal.teaviso.reserveBusinessOrder, {
        requestId: id,
        acceptedTerms: "x",
        acceptedAmount: 1,
      }),
    ).rejects.toThrow(/condiciones/);
    expect(
      await f.t.run((ctx) => ctx.db.query("marketplaceOrders").collect()),
    ).toEqual([]);
  });
  it("activates only after verified payment AND provisioning; refund disables public QR", async () => {
    const f = await fixture();
    const id = await f.me.mutation(api.teaviso.requestBusiness, {
      businessName: "Oficina",
      contactPhone: form.phone,
      notes: "",
    });
    const orderId = await f.t.run(async (ctx) => {
      const orderId = await ctx.db.insert("marketplaceOrders", {
        buyerId: f.owner,
        sellerId: f.other,
        productId: "teaviso:business:test",
        title: "Test",
        currency: "ARS",
        amount: 10000,
        commissionBps: 0,
        commissionAmount: 0,
        sellerAmount: 10000,
        sellerProviderUserId: "collector",
        providerMode: "live",
        status: "pending",
        productSnapshot: {
          productId: "teaviso:business:test",
          title: "Test",
          category: "plugins",
          creatorName: "Te a Viso",
          delivery: "inquiry",
          assets: [],
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.patch("teavisoBusinessRequests", id, {
        orderId,
        status: "awaiting_payment",
        adminNotes: "PRIVATE",
      });
      return orderId;
    });
    const args = {
      orderId,
      paymentId: "payment1",
      amount: 10000,
      currency: "ARS",
      collectorId: "collector",
      externalReference: orderId,
      liveMode: true,
      status: "approved" as const,
      eventKey: "event1",
    };
    await expect(
      f.t.mutation(internal.marketplace_payments.applyVerifiedPayment, {
        ...args,
        amount: 1,
      }),
    ).rejects.toThrow(/coincide/);
    await f.t.mutation(
      internal.marketplace_payments.applyVerifiedPayment,
      args,
    );
    let request = (await f.me.query(api.teaviso.myBusinessRequests, {}))[0];
    expect(request.status).toBe("paid");
    expect(JSON.stringify(request)).not.toContain("PRIVATE");
    expect(
      await f.t.query(api.teaviso.publicWhatsapp, { token: request.token }),
    ).toBeNull();
    vi.stubEnv("MARKETPLACE_ADMIN_USER_IDS", f.other);
    await expect(
      f.me.mutation(api.teaviso.provisionBusiness, {
        requestId: id,
        assignedPhone: "5491187654321",
        message: "Hola",
        activate: true,
        adminNotes: "",
      }),
    ).rejects.toThrow(/permiso/);
    await f.stranger.mutation(api.teaviso.provisionBusiness, {
      requestId: id,
      assignedPhone: "5491187654321",
      message: "Hola",
      activate: false,
      adminNotes: "PRIVATE",
    });
    expect(
      await f.t.query(api.teaviso.publicWhatsapp, { token: request.token }),
    ).toBeNull();
    await f.stranger.mutation(api.teaviso.provisionBusiness, {
      requestId: id,
      assignedPhone: "5491187654321",
      message: "Hola",
      activate: true,
      adminNotes: "PRIVATE",
    });
    await expect(
      f.stranger.mutation(api.teaviso.updateBusinessContact, {
        requestId: id,
        message: "No",
        enabled: false,
      }),
    ).rejects.toThrow(/cuenta/);
    await f.me.mutation(api.teaviso.saveQrTemplate, {
      kind: "business",
      id,
      template: "urban",
    });
    expect(
      (await f.me.query(api.teaviso.myBusinessRequests, {}))[0].qrTemplate,
    ).toBe("urban");
    await expect(
      f.stranger.mutation(api.teaviso.saveQrTemplate, {
        kind: "business",
        id,
        template: "night",
      }),
    ).rejects.toThrow(/cuenta/);
    await f.me.mutation(api.teaviso.updateBusinessContact, {
      requestId: id,
      message: "Hola",
      enabled: false,
    });
    expect(
      await f.t.query(api.teaviso.publicWhatsapp, { token: request.token }),
    ).toBeNull();
    await f.me.mutation(api.teaviso.updateBusinessContact, {
      requestId: id,
      message: "Hola",
      enabled: true,
    });
    expect(
      (await f.t.query(api.teaviso.publicWhatsapp, { token: request.token }))
        ?.url,
    ).toContain("5491187654321");
    await f.t.mutation(internal.marketplace_payments.applyVerifiedPayment, {
      ...args,
      status: "pending",
      eventKey: "late",
    });
    expect(
      (await f.me.query(api.teaviso.myBusinessRequests, {}))[0].status,
    ).toBe("active");
    await f.t.mutation(internal.marketplace_payments.applyVerifiedPayment, {
      ...args,
      status: "refunded",
      eventKey: "refund",
    });
    request = (await f.me.query(api.teaviso.myBusinessRequests, {}))[0];
    expect(request.status).toBe("cancelled");
    expect(request.enabled).toBe(false);
    expect(
      await f.t.query(api.teaviso.publicWhatsapp, { token: request.token }),
    ).toBeNull();
    await f.t.mutation(internal.marketplace_payments.applyVerifiedPayment, {
      ...args,
      eventKey: "late-approved",
    });
    expect(
      (await f.me.query(api.teaviso.myBusinessRequests, {}))[0].status,
    ).toBe("cancelled");
  });
});
describe("Business checkout reservation", () => {
  it("reserves one order with exact accepted conditions and refuses unpaid provisioning", async () => {
    const f = await fixture();
    vi.stubEnv("MARKETPLACE_ADMIN_USER_IDS", f.other);
    vi.stubEnv("TEAVISO_WEB_ORIGIN", "https://teaviso.example");
    for (const key of [
      "MP_APPLICATION_ID",
      "MP_CLIENT_SECRET",
      "MP_ACCESS_TOKEN",
      "MP_WEBHOOK_SECRET",
      "MP_TOKEN_ENCRYPTION_KEY",
      "MP_COLLECTOR_ID",
    ])
      vi.stubEnv(key, "synthetic-not-a-real-credential");
    vi.stubEnv("MP_MODE", "live");
    await f.t.run((ctx) =>
      ctx.db.insert("marketplacePaymentSettings", {
        key: "mercadopago-ar",
        enabled: true,
        splitApproved: true,
        policiesAccepted: true,
        updatedBy: f.other,
        updatedAt: Date.now(),
      }),
    );
    const terms =
      "Incluye número dedicado, configuración inicial y QR. El mantenimiento y las condiciones se detallan antes de contratar.";
    await f.stranger.mutation(api.teaviso.saveBusinessSettings, {
      enabled: true,
      priceAmount: 10000,
      terms,
    });
    const requestId = await f.me.mutation(api.teaviso.requestBusiness, {
      businessName: "Oficina",
      contactPhone: form.phone,
      notes: "",
    });
    await expect(
      f.stranger.mutation(api.teaviso.provisionBusiness, {
        requestId,
        assignedPhone: form.phone,
        message: "Hola",
        activate: true,
        adminNotes: "",
      }),
    ).rejects.toThrow(/pago/);
    await expect(
      f.me.mutation(internal.teaviso.reserveBusinessOrder, {
        requestId,
        acceptedTerms: terms,
        acceptedAmount: 1,
      }),
    ).rejects.toThrow(/condiciones/);
    const order = await f.me.mutation(internal.teaviso.reserveBusinessOrder, {
      requestId,
      acceptedTerms: terms,
      acceptedAmount: 10000,
    });
    const retry = await f.me.mutation(internal.teaviso.reserveBusinessOrder, {
      requestId,
      acceptedTerms: terms,
      acceptedAmount: 10000,
    });
    expect(retry.orderId).toBe(order.orderId);
    expect(
      await f.t.run((ctx) => ctx.db.query("marketplaceOrders").collect()),
    ).toHaveLength(1);
    expect(
      (await f.me.query(api.teaviso.myBusinessRequests, {}))[0],
    ).toMatchObject({
      status: "awaiting_payment",
      enabled: false,
      terms,
      priceAmount: 10000,
    });
    await f.stranger.mutation(api.teaviso.saveBusinessSettings, {
      enabled: true,
      priceAmount: 20000,
      terms,
    });
    await expect(
      f.me.mutation(internal.teaviso.reserveBusinessOrder, {
        requestId,
        acceptedTerms: terms,
        acceptedAmount: 20000,
      }),
    ).rejects.toThrow(/compra/);
  });
});

describe("Te a Viso exact OAuth destination", () => {
  it("allows only explicitly configured HTTPS callback, preserves existing VISO rules", () => {
    expect(
      googleAuthRedirect(
        "https://teaviso.example/panel?google=return",
        "https://viso.example",
        "https://teaviso.example",
      ),
    ).toBe("https://teaviso.example/panel?google=return");
    for (const target of [
      "https://teaviso.example.evil/panel?google=return",
      "https://teaviso.example/panel?google=return&next=evil",
      "https://teaviso.example/other",
      "https://teaviso.example/panel?google=return#evil",
    ])
      expect(() =>
        googleAuthRedirect(
          target,
          "https://viso.example",
          "https://teaviso.example",
        ),
      ).toThrow();
    expect(() =>
      googleAuthRedirect(
        "https://teaviso.example/panel?google=return",
        "https://viso.example",
        undefined,
      ),
    ).toThrow();
    expect(
      googleAuthRedirect(
        "/deck",
        "https://viso.example",
        "https://teaviso.example",
      ),
    ).toBe("https://viso.example/deck");
  });
  it("rejects unsafe origins", () => {
    for (const value of [
      "http://teaviso.example",
      "https://a.example/path",
      "https://u:p@a.example",
      "https://a.example/?x=1",
      "https://a.example/#x",
      "https://a.example.evil\\@ok.example",
    ])
      expect(teavisoOrigin(value)).toBeNull();
  });
});

describe("Plate template ownership", () => {
  it("persists a template without rotating the QR and rejects foreign, archived or invalid records", async () => {
    const f = await fixture();
    const id = await f.me.mutation(api.teaviso.saveWhatsappQr, form);
    const token = (await f.me.query(api.teaviso.myWhatsappQrs, {}))[0].token;
    await f.me.mutation(api.teaviso.saveQrTemplate, {
      kind: "personal",
      id,
      template: "night",
    });
    expect((await f.me.query(api.teaviso.myWhatsappQrs, {}))[0]).toMatchObject({
      qrTemplate: "night",
      token,
    });
    await expect(
      f.stranger.mutation(api.teaviso.saveQrTemplate, {
        kind: "personal",
        id,
        template: "urban",
      }),
    ).rejects.toThrow(/cuenta/);
    await expect(
      f.me.mutation(api.teaviso.saveQrTemplate, {
        kind: "business",
        id,
        template: "urban",
      }),
    ).rejects.toThrow(/cuenta/);
    await f.me.mutation(api.teaviso.archiveWhatsappQr, { id });
    await expect(
      f.me.mutation(api.teaviso.saveQrTemplate, {
        kind: "personal",
        id,
        template: "signal",
      }),
    ).rejects.toThrow(/cuenta/);
  });
});
