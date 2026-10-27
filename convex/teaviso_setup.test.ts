import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import schema from "./schema";
import { modules } from "./test.setup";
import { api } from "./_generated/api";
afterEach(() => vi.restoreAllMocks());
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => ({
    owner: await ctx.db.insert("users", { email: "owner@fixture.example" }),
    other: await ctx.db.insert("users", { email: "other@fixture.example" }),
  }));
  const me = t.withIdentity({ subject: `${ids.owner}|s` }),
    other = t.withIdentity({ subject: `${ids.other}|s` });
  const licenseId = await t.run(async (ctx) => {
    const features = {
        audio: true,
        video: true,
        chat: true,
        messages: true,
        families: true,
        buildings: true,
        offices: true,
        access: false,
        bookings: true,
        templates: true,
      },
      limits = { maxSites: 1, maxQrs: 2, maxMembers: 10, maxUnits: 10 };
    const planId = await ctx.db.insert("timbrePlans", {
      code: "digital",
      name: "Plan de prueba",
      description: "Fixture",
      enabled: false,
      currency: "ARS",
      period: "one_time",
      features,
      limits,
      sellerId: ids.owner,
      createdAt: 1,
      updatedAt: 1,
    });
    return ctx.db.insert("timbreLicenses", {
      ownerId: ids.owner,
      planId,
      planName: "Plan de prueba",
      status: "active",
      startsAt: 1,
      source: "internal_trial",
      sourceReference: "test-only",
      features,
      limits,
      createdAt: 1,
      updatedAt: 1,
    });
  });
  return {
    t,
    ...ids,
    otherId: ids.other,
    me,
    other,
    licenseId,
    base: {
      key: "a".repeat(64),
      name: "Mi casa",
      kind: "home" as const,
      timezone: "America/Argentina/Buenos_Aires",
      consent: true,
      phone: "+54 9 11 1234 5678",
    },
  };
}
it("creates a working WhatsApp entry directly and refuses empty contact or missing consent", async () => {
  const f = await fixture();
  await expect(
    f.t.mutation(api.teaviso_setup.create, { ...f.base, method: "whatsapp" }),
  ).rejects.toThrow(/sesión/);
  await expect(
    f.me.mutation(api.teaviso_setup.create, {
      ...f.base,
      method: "whatsapp",
      phone: "",
    }),
  ).rejects.toThrow(/teléfono/);
  await expect(
    f.me.mutation(api.teaviso_setup.create, {
      ...f.base,
      method: "whatsapp",
      consent: false,
    }),
  ).rejects.toThrow(/Confirmá/);
  const id = await f.me.mutation(api.teaviso_setup.create, {
    ...f.base,
    method: "whatsapp",
  });
  const s = await f.me.query(api.teaviso_spaces.get, { spaceId: id });
  expect(s.phone).toBe("5491112345678");
  expect(
    await f.t.query(api.teaviso_spaces.publicEntry, { token: s.token }),
  ).toMatchObject({
    name: "Mi casa",
    whatsappUrl: expect.stringContaining("wa.me/"),
  });
  expect(
    await f.t.run((ctx) => ctx.db.query("timbreSites").collect()),
  ).toHaveLength(0);
});
it("atomically wires calls, membership and QR while using one licensed location", async () => {
  const f = await fixture();
  const id = await f.me.mutation(api.teaviso_setup.create, {
    ...f.base,
    method: "calls",
    licenseId: f.licenseId,
  });
  const s = await f.me.query(api.teaviso_spaces.get, { spaceId: id });
  expect(s.phone).toBeUndefined();
  expect(s.timbreSiteId).toBeTruthy();
  expect(s.timbreQrId).toBeTruthy();
  const publicEntry = await f.t.query(api.teaviso_spaces.publicEntry, {
    token: s.token,
  });
  expect(publicEntry?.callToken).toBeTruthy();
  const workspace = await f.me.query(api.timbre.workspace, {});
  expect(workspace.sites).toHaveLength(1);
  expect(workspace.sites[0].licenseActive).toBe(true);
  const options = await f.me.query(api.teaviso_setup.options, { kind: "home" });
  expect(options.plans[0].remaining).toBe(0);
  expect(await f.me.query(api.teaviso_setup.list, {})).toHaveLength(1);
});
it("retries creation and activation without duplicating sites or public QRs", async () => {
  const f = await fixture();
  const args = { ...f.base, method: "both" as const, licenseId: f.licenseId };
  const id = await f.me.mutation(api.teaviso_setup.create, args);
  expect(await f.me.mutation(api.teaviso_setup.create, args)).toBe(id);
  const s = await f.me.query(api.teaviso_spaces.get, { spaceId: id });
  await f.me.mutation(api.teaviso_setup.activateCalls, {
    spaceId: id,
    revision: s.revision,
    licenseId: f.licenseId,
  });
  expect(
    await f.t.run((ctx) => ctx.db.query("timbreSites").collect()),
  ).toHaveLength(1);
  expect(
    await f.t.run((ctx) => ctx.db.query("timbreQrs").collect()),
  ).toHaveLength(1);
  expect(
    (await f.me.query(api.teaviso_spaces.get, { spaceId: id })).token,
  ).toBe(s.token);
});
it("rolls back every created record when the license is foreign, expired or full", async () => {
  const f = await fixture();
  await expect(
    f.other.mutation(api.teaviso_setup.create, {
      ...f.base,
      method: "both",
      licenseId: f.licenseId,
    }),
  ).rejects.toThrow(/activa/);
  expect(
    await f.t.run((ctx) => ctx.db.query("teavisoSpaces").collect()),
  ).toHaveLength(0);
  expect(
    await f.t.run((ctx) => ctx.db.query("teavisoWhatsappQrs").collect()),
  ).toHaveLength(0);
  await f.me.mutation(api.teaviso_setup.create, {
    ...f.base,
    method: "calls",
    licenseId: f.licenseId,
  });
  await expect(
    f.me.mutation(api.teaviso_setup.create, {
      ...f.base,
      key: "b".repeat(64),
      method: "both",
      licenseId: f.licenseId,
    }),
  ).rejects.toThrow(/todos sus timbres/);
  expect(
    await f.t.run((ctx) => ctx.db.query("teavisoSpaces").collect()),
  ).toHaveLength(1);
  expect(
    await f.t.run((ctx) => ctx.db.query("teavisoWhatsappQrs").collect()),
  ).toHaveLength(0);
  await f.t.run((ctx) =>
    ctx.db.patch("timbreLicenses", f.licenseId, {
      expiresAt: Date.now() - 100,
    }),
  );
  await expect(
    f.me.mutation(api.teaviso_setup.create, {
      ...f.base,
      key: "c".repeat(64),
      method: "calls",
      licenseId: f.licenseId,
    }),
  ).rejects.toThrow(/activa/);
});
it("adopts an existing Digital bell without changing its printed QR, members or creating a second location", async () => {
  const f = await fixture();
  const siteId = await f.me.mutation(api.timbre.createSite, {
    name: "Timbre existente",
    kind: "home",
    timezone: f.base.timezone,
    licenseId: f.licenseId,
  });
  const qrId = await f.me.mutation(api.timbre.createQr, {
    siteId,
    label: "Puerta",
  });
  const before = await f.t.run((ctx) => ctx.db.get("timbreQrs", qrId));
  await f.t.run((ctx) =>
    ctx.db.patch("timbreSites", siteId, { enabled: false }),
  );
  const id = await f.me.mutation(api.teaviso_setup.adoptDigital, { siteId });
  expect(await f.me.mutation(api.teaviso_setup.adoptDigital, { siteId })).toBe(
    id,
  );
  const s = await f.me.query(api.teaviso_spaces.get, { spaceId: id });
  expect(s.token).toBe(before?.token);
  expect(s.timbreQrId).toBe(qrId);
  expect(s.enabled).toBe(false);
  expect(
    await f.t.run((ctx) => ctx.db.query("timbreMembers").collect()),
  ).toHaveLength(1);
  expect(await f.me.query(api.teaviso_setup.list, {})).toHaveLength(1);
  await expect(
    f.other.mutation(api.teaviso_setup.adoptDigital, { siteId }),
  ).rejects.toThrow(/propietario/);
});
it("saves basic edits without erasing advanced settings, and protects changed contact and stale editors", async () => {
  const f = await fixture();
  const id = await f.me.mutation(api.teaviso_setup.create, {
    ...f.base,
    method: "both",
    licenseId: f.licenseId,
  });
  await f.t.run((ctx) =>
    ctx.db.patch("teavisoSpaces", id, {
      portalEnabled: true,
      templates: [
        { id: "entrega", label: "Entrega", message: "Estoy en la entrada." },
      ],
      cancelHours: 12,
    }),
  );
  const s = await f.me.query(api.teaviso_spaces.get, { spaceId: id });
  const args = {
    spaceId: id,
    revision: s.revision,
    name: "Entrada principal",
    phone: s.phone!,
    message: s.message,
    enabled: true,
    consent: false,
  };
  await f.me.mutation(api.teaviso_setup.saveBasics, args);
  const after = await f.me.query(api.teaviso_spaces.get, { spaceId: id });
  expect(after.templates).toEqual(s.templates);
  expect(after.cancelHours).toBe(12);
  expect(after.portalEnabled).toBe(true);
  expect(after.token).toBe(s.token);
  await expect(
    f.me.mutation(api.teaviso_setup.saveBasics, args),
  ).rejects.toThrow(/otra ventana/);
  await expect(
    f.me.mutation(api.teaviso_setup.saveBasics, {
      ...args,
      revision: after.revision,
      phone: "5491199998888",
    }),
  ).rejects.toThrow(/Confirmá/);
  await expect(
    f.other.mutation(api.teaviso_setup.saveBasics, {
      ...args,
      revision: after.revision,
    }),
  ).rejects.toThrow(/tu cuenta/);
});
it("pauses and resumes the old Digital QR and canonical link together without rotating their tokens", async () => {
  const f = await fixture();
  const id = await f.me.mutation(api.teaviso_setup.create, {
    ...f.base,
    method: "both",
    licenseId: f.licenseId,
  });
  const s = await f.me.query(api.teaviso_spaces.get, { spaceId: id });
  const args = {
    spaceId: id,
    revision: s.revision,
    name: s.name,
    phone: s.phone!,
    message: s.message,
    enabled: false,
    consent: false,
  };
  await f.me.mutation(api.teaviso_setup.saveBasics, args);
  expect(
    await f.t.query(api.teaviso_spaces.publicEntry, { token: s.token }),
  ).toBeNull();
  expect(
    (await f.t.run((ctx) => ctx.db.get("timbreSites", s.timbreSiteId!)))
      ?.enabled,
  ).toBe(false);
  expect(
    (await f.t.run((ctx) => ctx.db.get("timbreQrs", s.timbreQrId!)))?.enabled,
  ).toBe(false);
  await f.me.mutation(api.teaviso_setup.saveBasics, {
    ...args,
    revision: s.revision + 1,
    enabled: true,
  });
  expect(
    (await f.me.query(api.teaviso_setup.options, { kind: "home", spaceId: id }))
      .calls.enabled,
  ).toBe(true);
  expect(
    (await f.me.query(api.teaviso_spaces.get, { spaceId: id })).token,
  ).toBe(s.token);
});
it("lists received shared bells without granting residents ownership or exposing unrelated entries", async () => {
  const f = await fixture();
  const id = await f.me.mutation(api.teaviso_setup.create, {
    ...f.base,
    method: "calls",
    licenseId: f.licenseId,
  });
  const s = await f.me.query(api.teaviso_spaces.get, { spaceId: id });
  expect(await f.other.query(api.teaviso_setup.list, {})).toEqual([]);
  await f.t.run((ctx) =>
    ctx.db.insert("timbreMembers", {
      siteId: s.timbreSiteId!,
      userId: f.otherId,
      role: "resident",
      unitIds: [],
      canReceive: true,
      createdAt: 1,
      updatedAt: 1,
    }),
  );
  const rows = await f.other.query(api.teaviso_setup.list, {});
  expect(rows).toHaveLength(1);
  expect(rows[0].owner).toBe(false);
  await expect(
    f.other.mutation(api.teaviso_setup.adoptDigital, {
      siteId: s.timbreSiteId!,
    }),
  ).rejects.toThrow(/propietario/);
});

it("creates a working reception unit for building calls instead of leaving an empty directory", async () => {
  const f = await fixture();
  const id = await f.me.mutation(api.teaviso_setup.create, {
    ...f.base,
    kind: "building",
    method: "calls",
    licenseId: f.licenseId,
  });
  const space = await f.me.query(api.teaviso_spaces.get, { spaceId: id });
  const units = await f.me.query(api.timbre.listUnits, {
    siteId: space.timbreSiteId!,
  });
  expect(units).toHaveLength(1);
  expect(units[0].name).toBe("Recepción");
  expect(units[0].recipientIds).toEqual([f.owner]);
  expect(
    (
      await f.me.query(api.teaviso_setup.options, {
        kind: "building",
        spaceId: id,
      })
    ).calls.enabled,
  ).toBe(true);
});

it("never disables paid reservations or visitor messages when activating a different call plan", async () => {
  const f = await fixture();
  const id = await f.me.mutation(api.teaviso_setup.create, {
    ...f.base,
    method: "whatsapp",
  });
  await f.t.run(async (ctx) => {
    await ctx.db.patch("teavisoSpaces", id, {
      bookingsEnabled: true,
      portalEnabled: true,
      licenseId: f.licenseId,
    });
    const row = (await ctx.db.get("timbreLicenses", f.licenseId))!;
    await ctx.db.patch("timbreLicenses", f.licenseId, {
      features: { ...row.features, bookings: false, templates: false },
    });
  });
  const s = await f.me.query(api.teaviso_spaces.get, { spaceId: id });
  await expect(
    f.me.mutation(api.teaviso_setup.activateCalls, {
      spaceId: id,
      revision: s.revision,
      licenseId: f.licenseId,
    }),
  ).rejects.toThrow(/ya tenés activos/);
  expect(
    (await f.me.query(api.teaviso_setup.options, { kind: "home", spaceId: id }))
      .plans,
  ).toHaveLength(0);
  expect(
    await f.t.run((ctx) => ctx.db.query("timbreSites").collect()),
  ).toHaveLength(0);
  expect(
    (await f.me.query(api.teaviso_spaces.get, { spaceId: id })).bookingsEnabled,
  ).toBe(true);
});
