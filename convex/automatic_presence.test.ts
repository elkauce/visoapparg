import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const deviceId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const nextRequestId = "33333333-3333-4333-8333-333333333333";
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
async function fixture() {
  const t = convexTest(schema, modules);
  const [aliceId, bobId] = await t.run(
    async (ctx) =>
      [
        await ctx.db.insert("users", {
          name: "Alice",
          homeWebhookUrl: "https://example.test/hook",
        }),
        await ctx.db.insert("users", { name: "Bob" }),
      ] as const,
  );
  const alice = t.withIdentity({ subject: `${aliceId}|session` });
  const bob = t.withIdentity({ subject: `${bobId}|session` });
  const statusId = await alice.mutation(api.statuses.create, {
    name: "Llamada",
    color: "#123456",
    icon: "phone",
  });
  const args = {
    accountId: aliceId,
    statusId,
    deviceId,
    requestId,
    expectedRevision: 0,
  };
  return { t, alice, bob, aliceId, bobId, statusId, args };
}
describe("automatic shared status transactions", () => {
  it("atomically activates, deduplicates and returns a read-only recovery receipt", async () => {
    const { t, alice, args } = await fixture();
    expect(
      await alice.mutation(api.deck_actions.activateAutomaticStatus, args),
    ).toEqual({ applied: true, revision: 1 });
    expect(
      await alice.mutation(api.deck_actions.activateAutomaticStatus, args),
    ).toEqual({ applied: true, revision: 1 });
    expect(
      await alice.query(api.deck_actions.getAutomaticReceipt, {
        accountId: args.accountId,
        requestId,
      }),
    ).toEqual({ applied: true, statusId: args.statusId, revision: 1 });
    expect(
      await t.run((ctx) => ctx.db.query("deckActionRequests").collect()),
    ).toHaveLength(1);
    expect(
      await t.run((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect(),
      ),
    ).toHaveLength(1);
  });
  it("refuses to restore after a manual selection of the same state", async () => {
    const { alice, args, statusId } = await fixture();
    await alice.mutation(api.deck_actions.activateAutomaticStatus, args);
    await alice.mutation(api.statuses.setActive, { statusId });
    expect(
      await alice.mutation(api.deck_actions.activateAutomaticStatus, {
        ...args,
        statusId: null,
        expectedRevision: 1,
        requestId: nextRequestId,
      }),
    ).toEqual({ applied: false, revision: 2 });
    expect(await alice.query(api.statuses.list, {})).toMatchObject({
      activeStatusId: statusId,
      activeStatusRevision: 2,
    });
  });
  it("restores null only when the automatic change still owns the revision", async () => {
    const { alice, args } = await fixture();
    await alice.mutation(api.deck_actions.activateAutomaticStatus, args);
    expect(
      await alice.mutation(api.deck_actions.activateAutomaticStatus, {
        ...args,
        statusId: null,
        expectedRevision: 1,
        requestId: nextRequestId,
      }),
    ).toEqual({ applied: true, revision: 2 });
    expect(await alice.query(api.statuses.list, {})).toMatchObject({
      activeStatusId: null,
      activeStatusRevision: 2,
    });
  });
  it("does not replay an old action over a later manual state", async () => {
    const { alice, args } = await fixture();
    await alice.mutation(api.deck_actions.activateAutomaticStatus, args);
    await alice.mutation(api.statuses.setActive, { statusId: null });
    await alice.mutation(api.deck_actions.activateAutomaticStatus, args);
    expect(await alice.query(api.statuses.list, {})).toMatchObject({
      activeStatusId: null,
      activeStatusRevision: 2,
    });
    await expect(
      alice.mutation(api.deck_actions.activateAutomaticStatus, {
        ...args,
        statusId: null,
      }),
    ).rejects.toThrow(/CONFLICT/);
  });
  it("denies anonymous, switched-account and foreign status access, including null restoration", async () => {
    const { t, bob, bobId, args } = await fixture();
    await expect(
      t.mutation(api.deck_actions.activateAutomaticStatus, args),
    ).rejects.toThrow(/UNAUTHENTICATED/);
    await expect(
      bob.mutation(api.deck_actions.activateAutomaticStatus, {
        ...args,
        statusId: null,
      }),
    ).rejects.toThrow(/BAD_REQUEST/);
    await expect(
      bob.mutation(api.deck_actions.activateAutomaticStatus, {
        ...args,
        accountId: bobId,
      }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(
      bob.query(api.deck_actions.getAutomaticReceipt, {
        accountId: args.accountId,
        requestId,
      }),
    ).rejects.toThrow(/BAD_REQUEST/);
    expect(
      await bob.query(api.deck_actions.getAutomaticReceipt, {
        accountId: bobId,
        requestId,
      }),
    ).toBeNull();
  });
  it("rejects obsolete or malformed revisions without writes", async () => {
    const { t, alice, args } = await fixture();
    await expect(
      alice.mutation(api.deck_actions.activateAutomaticStatus, {
        ...args,
        expectedRevision: -1,
      }),
    ).rejects.toThrow(/BAD_REQUEST/);
    expect(
      await alice.mutation(api.deck_actions.activateAutomaticStatus, {
        ...args,
        expectedRevision: 5,
      }),
    ).toEqual({ applied: false, revision: 0 });
    expect(
      await t.run((ctx) => ctx.db.query("deckActionRequests").collect()),
    ).toHaveLength(0);
  });
});
