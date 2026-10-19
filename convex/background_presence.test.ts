import { it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { modules } from "./test.setup";
async function fixture() {
  const t = convexTest(schema, modules);
  const user = await t.run((ctx) => ctx.db.insert("users", { name: "Owner" }));
  const signed = t.withIdentity({ subject: `${user}|s` });
  await signed.mutation(api.deck_layout.ensureCatalogue, {});
  const free = await signed.mutation(api.statuses.create, {
    name: "Libre",
    color: "#00ff00",
    icon: "check",
  });
  await signed.mutation(api.statuses.setActive, { statusId: free });
  const deviceId = crypto.randomUUID();
  const capability = await signed.mutation(api.background_presence.enroll, {
    deviceId,
  });
  return { t, user, signed, free, deviceId, capability };
}
it("scopes capability, does not store plaintext and preserves manual overrides", async () => {
  const { t, user, signed, free, capability } = await fixture();
  const record = await t.run((ctx) => ctx.db.query("presenceDevices").first());
  expect(record?.secretHash).not.toBe(capability.secret);
  expect(record?.secretHash).toHaveLength(64);
  await expect(
    t.mutation(api.background_presence.enroll, {
      deviceId: crypto.randomUUID(),
    }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.background_presence.signal, {
      secret: "a".repeat(72),
      calling: true,
    }),
  ).rejects.toThrow(/UNAUTHORIZED/);
  const call = await t.mutation(api.background_presence.signal, {
    secret: capability.secret,
    calling: true,
  });
  expect(call.status?.name.toUpperCase()).toBe("LLAMADA");
  const manual = await signed.mutation(api.statuses.create, {
    name: "Pepe",
    color: "#ffff00",
    icon: "star",
  });
  await signed.mutation(api.statuses.setActive, { statusId: manual });
  const continued = await t.mutation(api.background_presence.signal, {
    secret: capability.secret,
    calling: true,
  });
  expect(continued.status?.name).toBe("Pepe");
  await t.mutation(api.background_presence.signal, {
    secret: capability.secret,
    calling: false,
  });
  const snapshot = await signed.query(api.statuses.list, {});
  expect(snapshot?.activeStatusId).toBe(manual);
  expect(
    (await t.run((ctx) => ctx.db.get("users", user)))?.activeStatusId,
  ).not.toBe(free);
});
it("restores only its own call and expires missing heartbeats", async () => {
  const { t, signed, free, capability } = await fixture();
  await t.mutation(api.background_presence.signal, {
    secret: capability.secret,
    calling: true,
  });
  await t.mutation(api.background_presence.signal, {
    secret: capability.secret,
    calling: false,
  });
  expect((await signed.query(api.statuses.list, {}))?.activeStatusId).toBe(
    free,
  );
  await t.mutation(api.background_presence.signal, {
    secret: capability.secret,
    calling: true,
  });
  const id = await t.run(async (ctx) => {
    const device = (await ctx.db.query("presenceDevices").first())!;
    await ctx.db.patch("presenceDevices", device._id, {
      lastSeen: Date.now() - 100000,
    });
    return device._id;
  });
  await t.mutation(internal.background_presence.expireCall, { deviceId: id });
  expect((await signed.query(api.statuses.list, {}))?.activeStatusId).toBe(
    free,
  );
  await t.mutation(api.background_presence.signal, {
    secret: capability.secret,
    calling: true,
  });
  await t.mutation(api.background_presence.signal, {
    secret: capability.secret,
    calling: true,
    disable: true,
  });
  expect((await signed.query(api.statuses.list, {}))?.activeStatusId).toBe(
    free,
  );
  await expect(
    t.mutation(api.background_presence.signal, {
      secret: capability.secret,
      calling: true,
    }),
  ).rejects.toThrow(/UNAUTHORIZED/);
});
it("re-enrollment rotates credentials without losing call recovery", async () => {
  const { t, signed, free, deviceId, capability } = await fixture();
  await t.mutation(api.background_presence.signal, {
    secret: capability.secret,
    calling: true,
  });
  const renewed = await signed.mutation(api.background_presence.enroll, {
    deviceId,
  });
  await expect(
    t.mutation(api.background_presence.signal, {
      secret: capability.secret,
      calling: false,
    }),
  ).rejects.toThrow(/UNAUTHORIZED/);
  await t.mutation(api.background_presence.signal, {
    secret: renewed.secret,
    calling: false,
  });
  expect((await signed.query(api.statuses.list, {}))?.activeStatusId).toBe(
    free,
  );
});
