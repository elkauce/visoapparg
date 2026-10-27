import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import schema from "./schema";
import { modules } from "./test.setup";
import { api } from "./_generated/api";
afterEach(() => vi.unstubAllEnvs());
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => ({
    owner: await ctx.db.insert("users", { email: "owner@fixture.example" }),
    other: await ctx.db.insert("users", { email: "other@fixture.example" }),
    admin: await ctx.db.insert("users", { email: "admin@fixture.example" }),
  }));
  vi.stubEnv("MARKETPLACE_ADMIN_USER_IDS", ids.admin);
  const me = t.withIdentity({ subject: `${ids.owner}|s` }),
    other = t.withIdentity({ subject: `${ids.other}|s` }),
    boss = t.withIdentity({ subject: `${ids.admin}|s` });
  const spaceId = await me.mutation(api.teaviso_spaces.create, {
    name: "Casa",
    kind: "home",
    timezone: "America/Argentina/Buenos_Aires",
    consent: true,
    phone: "5491112345678",
  });
  const fields = {
    street: "San Martín",
    number: "1234",
    name: "",
    profession: "",
    registration: "",
    details: "",
  };
  return {
    t,
    me,
    other,
    boss,
    spaceId,
    args: {
      spaceId,
      model: "address" as const,
      material: "aluminum" as const,
      fields,
      requestKey: "a".repeat(64),
      reviewed: true,
    },
  };
}
it("requires ownership, actual preview review and complete model data", async () => {
  const f = await setup();
  await expect(f.t.mutation(api.teaviso_signs.request, f.args)).rejects.toThrow(
    /sesión/,
  );
  await expect(
    f.other.mutation(api.teaviso_signs.request, f.args),
  ).rejects.toThrow(/tu cuenta/);
  await expect(
    f.me.mutation(api.teaviso_signs.request, { ...f.args, reviewed: false }),
  ).rejects.toThrow(/Revisá/);
  await expect(
    f.me.mutation(api.teaviso_signs.request, {
      ...f.args,
      fields: { ...f.args.fields, number: "" },
    }),
  ).rejects.toThrow(/calle y número/);
  expect(await f.other.query(api.teaviso_signs.mine, {})).toEqual([]);
});
it("stores the owner's real QR snapshot and retries idempotently without charging or granting licenses", async () => {
  const f = await setup();
  const id = await f.me.mutation(api.teaviso_signs.request, f.args);
  expect(await f.me.mutation(api.teaviso_signs.request, f.args)).toBe(id);
  const space = await f.me.query(api.teaviso_spaces.get, {
    spaceId: f.spaceId,
  });
  const row = await f.t.run((ctx) => ctx.db.get("teavisoSignRequests", id));
  expect(row?.qrToken).toBe(space.token);
  expect(row?.status).toBe("requested");
  expect(await f.me.query(api.teaviso_signs.mine, {})).toHaveLength(1);
  await expect(
    f.me.mutation(api.teaviso_signs.request, {
      ...f.args,
      material: "acrylic",
    }),
  ).rejects.toThrow(/otros datos/);
  expect(
    await f.t.run((ctx) => ctx.db.query("marketplaceOrders").collect()),
  ).toEqual([]);
  expect(
    await f.t.run((ctx) => ctx.db.query("timbreLicenses").collect()),
  ).toEqual([]);
});
it("keeps review notes private and only lets administrators update a current request", async () => {
  const f = await setup();
  const id = await f.me.mutation(api.teaviso_signs.request, f.args);
  const row = await f.t.run((ctx) => ctx.db.get("teavisoSignRequests", id));
  const edit = {
    id,
    status: "reviewing" as const,
    notes: "Coordinar fabricación",
    expectedUpdatedAt: row!.updatedAt,
  };
  await expect(
    f.other.query(api.teaviso_signs.adminList, {
      paginationOpts: { numItems: 20, cursor: null },
    }),
  ).rejects.toThrow(/administración/);
  await expect(
    f.me.mutation(api.teaviso_signs.adminUpdate, edit),
  ).rejects.toThrow(/administración/);
  await f.boss.mutation(api.teaviso_signs.adminUpdate, edit);
  await expect(
    f.boss.mutation(api.teaviso_signs.adminUpdate, edit),
  ).rejects.toThrow(/cambió/);
  const mine = await f.me.query(api.teaviso_signs.mine, {});
  expect(mine[0].status).toBe("reviewing");
  expect(JSON.stringify(mine)).not.toMatch(/adminNotes|Coordinar fabricación/);
  const admin = await f.boss.query(api.teaviso_signs.adminList, {
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(admin.page[0].adminNotes).toBe("Coordinar fabricación");
});
it("bounds request volume and refuses an archived QR before quoting", async () => {
  const f = await setup();
  for (let n = 0; n < 10; n++)
    await f.me.mutation(api.teaviso_signs.request, {
      ...f.args,
      requestKey: n.toString(16).padStart(64, "0"),
    });
  await expect(
    f.me.mutation(api.teaviso_signs.request, f.args),
  ).rejects.toThrow(/hoy/);
  const g = await setup();
  const qr = (await g.me.query(api.teaviso.myWhatsappQrs, {}))[0];
  await g.me.mutation(api.teaviso.archiveWhatsappQr, { id: qr._id });
  await expect(
    g.me.mutation(api.teaviso_signs.request, g.args),
  ).rejects.toThrow(/disponible/);
});
