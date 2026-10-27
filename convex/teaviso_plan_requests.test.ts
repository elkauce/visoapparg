import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import schema from "./schema";
import { modules } from "./test.setup";
import { api } from "./_generated/api";
afterEach(() => vi.unstubAllEnvs());
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => ({
    owner: await ctx.db.insert("users", { email: "owner@fixture.example" }),
    other: await ctx.db.insert("users", { email: "other@fixture.example" }),
    admin: await ctx.db.insert("users", { email: "admin@fixture.example" }),
  }));
  vi.stubEnv("MARKETPLACE_ADMIN_USER_IDS", ids.admin);
  return {
    t,
    ids,
    owner: t.withIdentity({ subject: `${ids.owner}|s` }),
    other: t.withIdentity({ subject: `${ids.other}|s` }),
    admin: t.withIdentity({ subject: `${ids.admin}|s` }),
  };
}
const base = {
  interest: "familia",
  message: "Quiero conocer las condiciones.",
  requestKey: "a".repeat(64),
};
it("requires a real session, keeps requests private and does not grant or bill a plan", async () => {
  const f = await fixture();
  await expect(
    f.t.mutation(api.teaviso_plan_requests.request, base),
  ).rejects.toThrow(/sesión/);
  await expect(f.t.query(api.teaviso_plan_requests.mine, {})).rejects.toThrow(
    /sesión/,
  );
  await f.owner.mutation(api.teaviso_plan_requests.request, base);
  expect(await f.other.query(api.teaviso_plan_requests.mine, {})).toEqual([]);
  expect(await f.owner.query(api.teaviso_plan_requests.mine, {})).toHaveLength(
    1,
  );
  await expect(
    f.other.query(api.teaviso_plan_requests.directory, {
      paginationOpts: { cursor: null, numItems: 20 },
    }),
  ).rejects.toThrow(/permiso/);
  expect(
    await f.t.run(async (ctx) => ({
      licenses: await ctx.db.query("timbreLicenses").collect(),
      orders: await ctx.db.query("marketplaceOrders").collect(),
      subscriptions: await ctx.db.query("timbreSubscriptions").collect(),
    })),
  ).toEqual({ licenses: [], orders: [], subscriptions: [] });
});
it("deduplicates exact retries and refuses tampered reuse or invalid requests", async () => {
  const f = await fixture();
  const id = await f.owner.mutation(api.teaviso_plan_requests.request, base);
  expect(await f.owner.mutation(api.teaviso_plan_requests.request, base)).toBe(
    id,
  );
  await expect(
    f.owner.mutation(api.teaviso_plan_requests.request, {
      ...base,
      message: "Otro mensaje",
    }),
  ).rejects.toThrow(/otros datos/);
  await expect(
    f.owner.mutation(api.teaviso_plan_requests.request, {
      ...base,
      requestKey: "b".repeat(64),
    }),
  ).rejects.toThrow(/pendiente/);
  await expect(
    f.owner.mutation(api.teaviso_plan_requests.request, {
      ...base,
      interest: "arbitrary",
    }),
  ).rejects.toThrow(/válida/);
  await expect(
    f.owner.mutation(api.teaviso_plan_requests.request, {
      ...base,
      message: "x".repeat(1501),
    }),
  ).rejects.toThrow(/datos/);
});
it("restricts responses to admins, rejects stale writes, and exposes the response only to its owner", async () => {
  const f = await fixture();
  const id = await f.owner.mutation(api.teaviso_plan_requests.request, base);
  const row = (await f.owner.query(api.teaviso_plan_requests.mine, {}))[0];
  const reply = {
    id,
    expectedUpdatedAt: row.updatedAt,
    response:
      "Revisamos tu consulta. Confirmaremos la vigencia y el presupuesto.",
    status: "answered" as const,
  };
  await expect(
    f.owner.mutation(api.teaviso_plan_requests.respond, reply),
  ).rejects.toThrow(/permiso/);
  await expect(
    f.admin.mutation(api.teaviso_plan_requests.respond, {
      ...reply,
      response: "",
    }),
  ).rejects.toThrow(/datos/);
  await f.admin.mutation(api.teaviso_plan_requests.respond, reply);
  await expect(
    f.admin.mutation(api.teaviso_plan_requests.respond, reply),
  ).rejects.toThrow(/otra ventana/);
  expect(
    (await f.owner.query(api.teaviso_plan_requests.mine, {}))[0].response,
  ).toBe(reply.response);
  expect(await f.other.query(api.teaviso_plan_requests.mine, {})).toEqual([]);
  const page = await f.admin.query(api.teaviso_plan_requests.directory, {
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(page.page[0].email).toBe("owner@fixture.example");
  expect(
    await f.t.run((ctx) => ctx.db.query("teavisoAdminEvents").collect()),
  ).toHaveLength(1);
});
it("limits new requests per account and day without affecting another account", async () => {
  const f = await fixture();
  const interests = [
    "avisos",
    "videollamada",
    "familia",
    "negocios",
    "edificios",
    "portal",
  ];
  for (const [i, interest] of interests.slice(0, 5).entries())
    await f.owner.mutation(api.teaviso_plan_requests.request, {
      ...base,
      interest,
      requestKey: String(i).repeat(64),
    });
  await expect(
    f.owner.mutation(api.teaviso_plan_requests.request, {
      ...base,
      interest: interests[5],
      requestKey: "f".repeat(64),
    }),
  ).rejects.toThrow(/hoy/);
  await expect(
    f.other.mutation(api.teaviso_plan_requests.request, base),
  ).resolves.toBeTruthy();
});
