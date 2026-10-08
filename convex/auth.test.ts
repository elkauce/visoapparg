import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema.ts";
import { modules } from "./test.setup.ts";

async function usersFixture() {
  const t = convexTest(schema, modules);
  const [aliceId, bobId] = await t.run(async (ctx) => {
    const aliceId = await ctx.db.insert("users", {
      name: "Alice",
      email: "alice@example.test",
      tokenIdentifier: "legacy-alice",
      displayVolume: 35,
    });
    const bobId = await ctx.db.insert("users", {
      name: "Bob",
      email: "bob@example.test",
      tokenIdentifier: "legacy-bob",
      displayVolume: 60,
    });
    return [aliceId, bobId] as const;
  });
  const alice = t.withIdentity({
    subject: `${aliceId}|alice-session`,
    tokenIdentifier: "alice-session-token",
  });
  const bob = t.withIdentity({
    subject: `${bobId}|bob-session`,
    tokenIdentifier: "bob-session-token",
  });
  return { t, alice, bob, aliceId, bobId };
}

const aliceStatus = {
  name: "Trabajando",
  color: "#ef4444",
  icon: "ban",
};
const bobStatus = {
  name: "Disponible",
  color: "#22c55e",
  icon: "check-circle",
};

describe("Convex Auth user identity", () => {
  it("supports an Auth-created profile without a legacy token identifier", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "new@example.test" }),
    );
    const authenticated = t.withIdentity({ subject: `${userId}|new-session` });

    expect(await authenticated.mutation(api.users.updateCurrentUser, {})).toBe(
      userId,
    );
    const user = await authenticated.query(api.users.getCurrentUser, {});
    expect(user).toMatchObject({
      _id: userId,
      email: "new@example.test",
    });
    expect(user).not.toHaveProperty("tokenIdentifier");
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(
      1,
    );
  });

  it("returns empty private queries and rejects writes without a session", async () => {
    const { t } = await usersFixture();

    expect(await t.query(api.users.getCurrentUser, {})).toBeNull();
    expect(await t.query(api.statuses.list, {})).toBeNull();
    expect(await t.query(api.lights.getSettings, {})).toBeNull();
    expect(await t.query(api.public_status.getMine, {})).toBeNull();
    expect(await t.query(api.deck_api.getMine, {})).toBeNull();
    expect(await t.query(api.deck_layout.get, {})).toBeNull();

    await expect(t.mutation(api.users.updateCurrentUser, {})).rejects.toThrow(
      /UNAUTHENTICATED/,
    );
    await expect(t.mutation(api.statuses.create, aliceStatus)).rejects.toThrow(
      /UNAUTHENTICATED/,
    );
    await expect(
      t.mutation(api.lights.setKeyLightIp, { ip: "192.168.1.50" }),
    ).rejects.toThrow(/UNAUTHENTICATED/);
    await expect(t.mutation(api.public_status.ensureMine, {})).rejects.toThrow(
      /UNAUTHENTICATED/,
    );
    await expect(t.mutation(api.deck_api.ensureMine, {})).rejects.toThrow(
      /UNAUTHENTICATED/,
    );
    await expect(t.mutation(api.deck_layout.ensureDefault, {})).rejects.toThrow(
      /UNAUTHENTICATED/,
    );

    expect(
      await t.run(async (ctx) => ({
        users: (await ctx.db.query("users").collect()).length,
        statuses: (await ctx.db.query("statuses").collect()).length,
        publicLinks: (await ctx.db.query("publicLinks").collect()).length,
        deckTokens: (await ctx.db.query("deckTokens").collect()).length,
      })),
    ).toEqual({ users: 2, statuses: 0, publicLinks: 0, deckTokens: 0 });
  });

  it("resolves the Auth subject to the existing user without trusting profile or legacy token claims", async () => {
    const { t, aliceId, bobId } = await usersFixture();
    const original = await t.run((ctx) => ctx.db.get("users", aliceId));
    const identity = t.withIdentity({
      subject: `${aliceId}|new-session`,
      // This used to select Bob through the legacy by_token index.
      tokenIdentifier: "legacy-bob",
      name: "Untrusted token name",
      email: "bob@example.test",
    });

    expect(await identity.query(api.users.getCurrentUser, {})).toEqual(
      original,
    );
    expect(await identity.mutation(api.users.updateCurrentUser, {})).toBe(
      aliceId,
    );
    expect(await identity.mutation(api.users.updateCurrentUser, {})).toBe(
      aliceId,
    );
    expect(await t.run((ctx) => ctx.db.get("users", aliceId))).toEqual(
      original,
    );
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users.map((user) => user._id).sort()).toEqual(
      [aliceId, bobId].sort(),
    );
  });

  it("does not create a replacement profile when the authenticated user no longer exists", async () => {
    const { t, alice, aliceId, bobId } = await usersFixture();
    await t.run((ctx) => ctx.db.delete("users", aliceId));

    expect(await alice.query(api.users.getCurrentUser, {})).toBeNull();
    expect(await alice.query(api.statuses.list, {})).toBeNull();
    await expect(
      alice.mutation(api.users.updateCurrentUser, {}),
    ).rejects.toThrow(/NOT_FOUND/);
    await expect(
      alice.mutation(api.statuses.create, aliceStatus),
    ).rejects.toThrow(/NOT_FOUND/);
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users.map((user) => user._id)).toEqual([bobId]);
  });

  it("keeps the same user and owned resources when the session changes", async () => {
    const { t, alice, aliceId } = await usersFixture();
    const statusId = await alice.mutation(api.statuses.create, aliceStatus);
    await alice.mutation(api.statuses.setActive, { statusId });
    await alice.mutation(api.lights.setKeyLightIp, { ip: "192.168.1.50" });
    await alice.mutation(api.lights.setHomeWebhook, {
      url: "https://alice.example.test/lights",
    });
    const slug = await alice.mutation(api.public_status.ensureMine, {});
    const deckToken = await alice.mutation(api.deck_api.ensureMine, {});
    await alice.mutation(api.deck_layout.ensureDefault, {});
    const deckLayout = await alice.query(api.deck_layout.get, {});
    expect(deckLayout).toMatchObject({
      pages: [{ userId: aliceId, name: "Principal", order: 0 }],
      keys: [
        { userId: aliceId, content: { kind: "status", statusId } },
        { userId: aliceId, content: { kind: "off" } },
      ],
      volume: 35,
    });
    const before = await t.run(async (ctx) => ({
      user: await ctx.db.get("users", aliceId),
      status: await ctx.db.get("statuses", statusId),
      links: await ctx.db.query("publicLinks").collect(),
      tokens: await ctx.db.query("deckTokens").collect(),
      deckPages: await ctx.db.query("deckPages").collect(),
      deckKeys: await ctx.db.query("deckKeys").collect(),
    }));
    const newSession = t.withIdentity({
      subject: `${aliceId}|different-session`,
      tokenIdentifier: "different-session-token",
    });

    expect(await newSession.mutation(api.users.updateCurrentUser, {})).toBe(
      aliceId,
    );
    expect(await newSession.query(api.users.getCurrentUser, {})).toEqual(
      before.user,
    );
    expect(await newSession.query(api.statuses.list, {})).toMatchObject({
      statuses: [{ _id: statusId, userId: aliceId, ...aliceStatus }],
      activeStatusId: statusId,
    });
    expect(await newSession.query(api.lights.getSettings, {})).toEqual({
      keyLightIp: "192.168.1.50",
      homeWebhookUrl: "https://alice.example.test/lights",
    });
    expect(await newSession.mutation(api.public_status.ensureMine, {})).toBe(
      slug,
    );
    expect(await newSession.mutation(api.deck_api.ensureMine, {})).toBe(
      deckToken,
    );
    await newSession.mutation(api.deck_layout.ensureDefault, {});
    expect(await newSession.query(api.deck_layout.get, {})).toEqual(deckLayout);
    expect(
      await t.run(async (ctx) => ({
        user: await ctx.db.get("users", aliceId),
        status: await ctx.db.get("statuses", statusId),
        links: await ctx.db.query("publicLinks").collect(),
        tokens: await ctx.db.query("deckTokens").collect(),
        deckPages: await ctx.db.query("deckPages").collect(),
        deckKeys: await ctx.db.query("deckKeys").collect(),
      })),
    ).toEqual(before);
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(
      2,
    );
  });
});

describe("User data isolation", () => {
  it("lists only owned statuses and rejects every mutation of another user's status", async () => {
    const { t, alice, bob, aliceId, bobId } = await usersFixture();
    const aliceStatusId = await alice.mutation(
      api.statuses.create,
      aliceStatus,
    );
    const bobStatusId = await bob.mutation(api.statuses.create, bobStatus);
    await alice.mutation(api.statuses.setActive, { statusId: aliceStatusId });
    await bob.mutation(api.statuses.setActive, { statusId: bobStatusId });
    const originalBobStatus = await t.run((ctx) =>
      ctx.db.get("statuses", bobStatusId),
    );

    expect(await alice.query(api.statuses.list, {})).toMatchObject({
      statuses: [{ _id: aliceStatusId, userId: aliceId, ...aliceStatus }],
      activeStatusId: aliceStatusId,
    });
    expect(await bob.query(api.statuses.list, {})).toMatchObject({
      statuses: [{ _id: bobStatusId, userId: bobId, ...bobStatus }],
      activeStatusId: bobStatusId,
    });
    await expect(
      alice.mutation(api.statuses.update, {
        statusId: bobStatusId,
        ...aliceStatus,
      }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(
      alice.mutation(api.statuses.remove, { statusId: bobStatusId }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(
      alice.mutation(api.statuses.move, {
        statusId: bobStatusId,
        direction: -1,
      }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(
      alice.mutation(api.statuses.setActive, { statusId: bobStatusId }),
    ).rejects.toThrow(/FORBIDDEN/);
    expect(await t.run((ctx) => ctx.db.get("statuses", bobStatusId))).toEqual(
      originalBobStatus,
    );
    expect(await alice.query(api.users.getCurrentUser, {})).toMatchObject({
      activeStatusId: aliceStatusId,
    });
    expect(await bob.query(api.users.getCurrentUser, {})).toMatchObject({
      activeStatusId: bobStatusId,
    });
  });

  it("updates only the authenticated user's light settings", async () => {
    const { alice, bob } = await usersFixture();
    await alice.mutation(api.lights.setKeyLightIp, { ip: "192.168.1.50" });
    await alice.mutation(api.lights.setHomeWebhook, {
      url: "https://alice.example.test/lights",
    });
    await bob.mutation(api.lights.setKeyLightIp, { ip: "192.168.1.60" });
    await bob.mutation(api.lights.setHomeWebhook, {
      url: "https://bob.example.test/lights",
    });

    expect(await alice.query(api.lights.getSettings, {})).toEqual({
      keyLightIp: "192.168.1.50",
      homeWebhookUrl: "https://alice.example.test/lights",
    });
    expect(await bob.query(api.lights.getSettings, {})).toEqual({
      keyLightIp: "192.168.1.60",
      homeWebhookUrl: "https://bob.example.test/lights",
    });

    await alice.mutation(api.lights.setKeyLightIp, { ip: "" });
    await alice.mutation(api.lights.setHomeWebhook, { url: "" });
    expect(await alice.query(api.lights.getSettings, {})).toEqual({
      keyLightIp: null,
      homeWebhookUrl: null,
    });
    expect(await bob.query(api.lights.getSettings, {})).toEqual({
      keyLightIp: "192.168.1.60",
      homeWebhookUrl: "https://bob.example.test/lights",
    });
  });

  it("keeps public links separate and invalidates only the owner's regenerated link", async () => {
    const { t, alice, bob } = await usersFixture();
    const aliceStatusId = await alice.mutation(
      api.statuses.create,
      aliceStatus,
    );
    const bobStatusId = await bob.mutation(api.statuses.create, bobStatus);
    await alice.mutation(api.statuses.setActive, { statusId: aliceStatusId });
    await bob.mutation(api.statuses.setActive, { statusId: bobStatusId });
    const aliceSlug = await alice.mutation(api.public_status.ensureMine, {});
    const bobSlug = await bob.mutation(api.public_status.ensureMine, {});

    expect(aliceSlug).not.toBe(bobSlug);
    expect(await alice.query(api.public_status.getMine, {})).toBe(aliceSlug);
    expect(await bob.query(api.public_status.getMine, {})).toBe(bobSlug);
    expect(await alice.mutation(api.public_status.ensureMine, {})).toBe(
      aliceSlug,
    );
    expect(
      await t.query(api.public_status.getPublicStatus, { slug: aliceSlug }),
    ).toEqual({
      found: true,
      ownerName: "Alice",
      volume: 35,
      status: {
        ...aliceStatus,
        id: aliceStatusId,
        mediaUrl: null,
        mediaType: null,
      },
    });
    const bobPublicStatus = await t.query(api.public_status.getPublicStatus, {
      slug: bobSlug,
    });
    expect(bobPublicStatus).toEqual({
      found: true,
      ownerName: "Bob",
      volume: 60,
      status: {
        ...bobStatus,
        id: bobStatusId,
        mediaUrl: null,
        mediaType: null,
      },
    });

    const newAliceSlug = await alice.mutation(api.public_status.regenerate, {});
    expect(newAliceSlug).not.toBe(aliceSlug);
    expect(
      await t.query(api.public_status.getPublicStatus, { slug: aliceSlug }),
    ).toEqual({ found: false });
    expect(await alice.query(api.public_status.getMine, {})).toBe(newAliceSlug);
    expect(await bob.query(api.public_status.getMine, {})).toBe(bobSlug);
    expect(
      await t.query(api.public_status.getPublicStatus, { slug: bobSlug }),
    ).toEqual(bobPublicStatus);
    expect(
      await t.run((ctx) => ctx.db.query("publicLinks").collect()),
    ).toHaveLength(2);
  });

  it("scopes deck tokens to their owner and invalidates a rotated token", async () => {
    const { t, alice, bob } = await usersFixture();
    const aliceStatusId = await alice.mutation(
      api.statuses.create,
      aliceStatus,
    );
    const bobStatusId = await bob.mutation(api.statuses.create, bobStatus);
    const aliceToken = await alice.mutation(api.deck_api.ensureMine, {});
    const bobToken = await bob.mutation(api.deck_api.ensureMine, {});

    expect(aliceToken).toMatch(/^[a-f0-9]{48}$/);
    expect(bobToken).toMatch(/^[a-f0-9]{48}$/);
    expect(aliceToken).not.toBe(bobToken);
    expect(await alice.query(api.deck_api.getMine, {})).toBe(aliceToken);
    expect(await bob.query(api.deck_api.getMine, {})).toBe(bobToken);
    expect(await alice.mutation(api.deck_api.ensureMine, {})).toBe(aliceToken);
    expect(
      await t.mutation(internal.deck_api.activateByToken, {
        token: aliceToken,
        status: bobStatusId,
      }),
    ).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(
      await t.mutation(internal.deck_api.activateByToken, {
        token: aliceToken,
        status: aliceStatusId,
      }),
    ).toEqual({ ok: true, statusName: aliceStatus.name });
    expect(await alice.query(api.users.getCurrentUser, {})).toMatchObject({
      activeStatusId: aliceStatusId,
    });
    expect(await bob.query(api.users.getCurrentUser, {})).not.toHaveProperty(
      "activeStatusId",
    );

    const newAliceToken = await alice.mutation(api.deck_api.regenerate, {});
    expect(newAliceToken).not.toBe(aliceToken);
    expect(await alice.query(api.deck_api.getMine, {})).toBe(newAliceToken);
    expect(await bob.query(api.deck_api.getMine, {})).toBe(bobToken);
    expect(
      await t.mutation(internal.deck_api.activateByToken, {
        token: aliceToken,
        status: "off",
      }),
    ).toEqual({ ok: false, code: "UNAUTHORIZED" });
    expect(
      await t.mutation(internal.deck_api.activateByToken, {
        token: newAliceToken,
        status: "off",
      }),
    ).toEqual({ ok: true, statusName: null });
    expect(await alice.query(api.users.getCurrentUser, {})).not.toHaveProperty(
      "activeStatusId",
    );
    expect(
      await t.mutation(internal.deck_api.activateByToken, {
        token: bobToken,
        status: bobStatusId,
      }),
    ).toEqual({ ok: true, statusName: bobStatus.name });
    expect(await bob.query(api.users.getCurrentUser, {})).toMatchObject({
      activeStatusId: bobStatusId,
    });
    expect(
      await t.run((ctx) => ctx.db.query("deckTokens").collect()),
    ).toHaveLength(2);
  });
});
