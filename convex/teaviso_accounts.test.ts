import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import schema from "./schema";
import { modules } from "./test.setup";
import { api, internal } from "./_generated/api";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => ({
    owner: await ctx.db.insert("users", {
      name: "VISO original",
      email: "owner@fixture.example",
    }),
    other: await ctx.db.insert("users", { email: "other@fixture.example" }),
    onlyViso: await ctx.db.insert("users", {
      email: "viso-only@fixture.example",
    }),
    admin: await ctx.db.insert("users", { email: "admin@fixture.example" }),
  }));
  vi.stubEnv("MARKETPLACE_ADMIN_USER_IDS", ids.admin);
  return {
    t,
    ...ids,
    me: t.withIdentity({ subject: `${ids.owner}|session` }),
    stranger: t.withIdentity({ subject: `${ids.other}|session` }),
    boss: t.withIdentity({ subject: `${ids.admin}|session` }),
  };
}
it("enrolls only the authenticated Te Aviso customer, idempotently and without paid privileges", async () => {
  const f = await fixture();
  expect(await f.t.query(api.teaviso_accounts.profile, {})).toBeNull();
  await expect(f.t.mutation(api.teaviso_accounts.register, {})).rejects.toThrow(
    /sesión/,
  );
  const first = await f.me.mutation(api.teaviso_accounts.register, {});
  expect(await f.me.mutation(api.teaviso_accounts.register, {})).toBe(first);
  const accounts = await f.t.run((ctx) =>
    ctx.db.query("teavisoAccounts").collect(),
  );
  expect(accounts.map((a) => a.userId)).toEqual([f.owner]);
  expect((await f.me.query(api.teaviso_accounts.profile, {}))?.deckLinked).toBe(
    false,
  );
  expect(
    await f.t.run((ctx) => ctx.db.query("timbreLicenses").collect()),
  ).toEqual([]);
});
it("edits the local product profile without changing the shared VISO identity", async () => {
  const f = await fixture();
  let now = 100;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  await f.me.mutation(api.teaviso_accounts.register, {});
  const profile = await f.me.query(api.teaviso_accounts.profile, {});
  now = 200;
  await f.me.mutation(api.teaviso_accounts.saveProfile, {
    name: "Nombre en Te Aviso",
    contactPhone: "+54 9 11 1234 5678",
    expectedUpdatedAt: profile!.updatedAt,
  });
  expect((await f.me.query(api.teaviso_accounts.profile, {}))?.name).toBe(
    "Nombre en Te Aviso",
  );
  expect((await f.t.run((ctx) => ctx.db.get("users", f.owner)))?.name).toBe(
    "VISO original",
  );
  await expect(
    f.me.mutation(api.teaviso_accounts.saveProfile, {
      name: "Editor anterior",
      contactPhone: "",
      expectedUpdatedAt: profile!.updatedAt,
    }),
  ).rejects.toThrow(/otra ventana/);
});
it("shows the Deck connection only for actual Deck users and allows disconnecting it locally", async () => {
  const f = await fixture();
  await f.me.mutation(api.teaviso_accounts.register, {});
  const profile = await f.me.query(api.teaviso_accounts.profile, {});
  await expect(
    f.me.mutation(api.teaviso_accounts.saveProfile, {
      name: "Ana",
      contactPhone: "",
      expectedUpdatedAt: profile!.updatedAt,
      deckLinked: true,
    }),
  ).rejects.toThrow(/todavía no tiene/);
  await f.t.run((ctx) =>
    ctx.db.insert("deckPages", { userId: f.owner, name: "Mi Deck", order: 0 }),
  );
  expect((await f.me.query(api.teaviso_accounts.profile, {}))?.deckLinked).toBe(
    true,
  );
  await f.me.mutation(api.teaviso_accounts.saveProfile, {
    name: "Ana",
    contactPhone: "",
    expectedUpdatedAt: profile!.updatedAt,
    deckLinked: false,
  });
  expect((await f.me.query(api.teaviso_accounts.profile, {}))?.deckLinked).toBe(
    false,
  );
  expect(
    await f.t.run((ctx) => ctx.db.query("deckPages").collect()),
  ).toHaveLength(1);
  expect(
    (await f.stranger.query(api.teaviso_accounts.profile, {}))?.canLinkDeck,
  ).toBe(false);
});
it("keeps the admin directory scoped to Te Aviso and rejects unrelated VISO lookups", async () => {
  const f = await fixture();
  await f.me.mutation(api.teaviso_accounts.register, {});
  const args = { paginationOpts: { numItems: 20, cursor: null } };
  await expect(
    f.me.query(api.teaviso_accounts.directory, args),
  ).rejects.toThrow(/administración/);
  await expect(
    f.t.query(api.teaviso_accounts.customer, { userId: f.owner }),
  ).rejects.toThrow(/sesión/);
  const directory = await f.boss.query(api.teaviso_accounts.directory, args);
  expect(directory.page.map((r) => r.id)).toEqual([f.owner]);
  await expect(
    f.boss.query(api.teaviso_accounts.customer, { userId: f.onlyViso }),
  ).rejects.toThrow(/no es un cliente/);
  await expect(
    f.stranger.query(api.teaviso_accounts.customer, { userId: f.owner }),
  ).rejects.toThrow(/administración/);
});
it("migrates legacy QR customers without enrolling every VISO account", async () => {
  const f = await fixture();
  await f.t.run((ctx) =>
    ctx.db.insert("teavisoWhatsappQrs", {
      ownerId: f.owner,
      label: "Casa",
      phone: "5491112345678",
      message: "Hola",
      token: "a".repeat(64),
      enabled: true,
      archived: false,
      consentAt: 1,
      createdAt: 1,
      updatedAt: 1,
    }),
  );
  const result = await f.t.mutation(
    internal.teaviso_accounts.migrateLegacyAccounts,
    { source: "whatsapp", cursor: null },
  );
  expect(result.done).toBe(true);
  expect(result.count).toBe(1);
  await f.t.mutation(internal.teaviso_accounts.migrateLegacyAccounts, {
    source: "whatsapp",
    cursor: null,
  });
  expect(
    (
      await f.boss.query(api.teaviso_accounts.directory, {
        paginationOpts: { numItems: 20, cursor: null },
      })
    ).page.map((r) => r.id),
  ).toEqual([f.owner]);
});
it("lets admins edit the local customer record with an audit reason and searchable profile", async () => {
  const f = await fixture();
  await f.me.mutation(api.teaviso_accounts.register, {});
  const profile = await f.me.query(api.teaviso_accounts.profile, {});
  await f.boss.mutation(api.teaviso_accounts.adminSaveProfile, {
    userId: f.owner,
    name: "Ana González",
    contactPhone: "5491112345678",
    expectedUpdatedAt: profile!.updatedAt,
    reason: "Corrección solicitada por el cliente",
  });
  const customer = await f.boss.query(api.teaviso_accounts.customer, {
    userId: f.owner,
  });
  expect(customer.name).toBe("Ana González");
  expect(customer.events).toHaveLength(1);
  expect(customer.events[0].reason).toContain("solicitada");
  const results = await f.boss.query(api.teaviso_accounts.directory, {
    search: "Ana",
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(results.page.map((r) => r.id)).toEqual([f.owner]);
  expect((await f.t.run((ctx) => ctx.db.get("users", f.owner)))?.name).toBe(
    "VISO original",
  );
});
it("pauses a customer doorbell and its existing printed QR atomically without granting a license", async () => {
  const f = await fixture();
  let now = 100;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  const qrId = await f.me.mutation(api.teaviso.saveWhatsappQr, {
    label: "Casa",
    phone: "5491112345678",
    message: "Hola",
    enabled: true,
    consent: true,
  });
  const qr = (await f.me.query(api.teaviso.myWhatsappQrs, {}))[0];
  const spaceId = await f.me.mutation(api.teaviso_spaces.create, {
    name: "Casa",
    kind: "home",
    timezone: "America/Argentina/Buenos_Aires",
    consent: false,
    existingQrId: qrId,
  });
  const space = await f.me.query(api.teaviso_spaces.get, { spaceId });
  now = 200;
  const args = {
    userId: f.owner,
    target: "space" as const,
    id: spaceId,
    name: "Entrada principal",
    enabled: false,
    expectedUpdatedAt: space.updatedAt,
    reason: "Pausa solicitada",
  };
  await expect(
    f.stranger.mutation(api.teaviso_accounts.adminSaveDoorbell, args),
  ).rejects.toThrow(/administración/);
  await expect(
    f.boss.mutation(api.teaviso_accounts.adminSaveDoorbell, {
      ...args,
      userId: f.other,
    }),
  ).rejects.toThrow(/no es un cliente/);
  await f.boss.mutation(api.teaviso_accounts.adminSaveDoorbell, args);
  expect(
    await f.t.query(api.teaviso.publicWhatsapp, { token: qr.token }),
  ).toBeNull();
  expect(
    await f.t.query(api.teaviso_spaces.publicEntry, { token: qr.token }),
  ).toBeNull();
  await expect(
    f.boss.mutation(api.teaviso_accounts.adminSaveDoorbell, args),
  ).rejects.toThrow(/otra ventana/);
  await f.boss.mutation(api.teaviso_accounts.adminSaveDoorbell, {
    ...args,
    enabled: true,
    expectedUpdatedAt: 200,
    reason: "Reactivación solicitada",
  });
  expect((await f.me.query(api.teaviso.myWhatsappQrs, {}))[0].token).toBe(
    qr.token,
  );
  expect(
    (await f.t.query(api.teaviso_spaces.publicEntry, { token: qr.token }))
      ?.bookings,
  ).toBe(false);
  expect(
    await f.t.run((ctx) => ctx.db.query("timbreLicenses").collect()),
  ).toEqual([]);
  expect(
    (await f.boss.query(api.teaviso_accounts.customer, { userId: f.owner }))
      .events,
  ).toHaveLength(2);
});
it("rejects cross-customer changes, empty audit reasons and resurrection of deleted QRs", async () => {
  const f = await fixture();
  await f.stranger.mutation(api.teaviso_accounts.register, {});
  const id = await f.me.mutation(api.teaviso.saveWhatsappQr, {
    label: "Casa",
    phone: "5491112345678",
    message: "Hola",
    enabled: true,
    consent: true,
  });
  const row = (await f.me.query(api.teaviso.myWhatsappQrs, {}))[0];
  const args = {
    userId: f.other,
    target: "whatsapp" as const,
    id,
    name: "Otra",
    enabled: true,
    expectedUpdatedAt: row.updatedAt,
    reason: "Cambio de prueba",
  };
  await expect(
    f.boss.mutation(api.teaviso_accounts.adminSaveDoorbell, args),
  ).rejects.toThrow(/no pertenece/);
  await expect(
    f.boss.mutation(api.teaviso_accounts.adminSaveDoorbell, {
      ...args,
      userId: f.owner,
      reason: "",
    }),
  ).rejects.toThrow(/datos/);
  await f.me.mutation(api.teaviso.archiveWhatsappQr, { id });
  const deleted = await f.t.run((ctx) => ctx.db.get("teavisoWhatsappQrs", id));
  await expect(
    f.boss.mutation(api.teaviso_accounts.adminSaveDoorbell, {
      ...args,
      userId: f.owner,
      expectedUpdatedAt: deleted!.updatedAt,
    }),
  ).rejects.toThrow(/eliminado/);
});
