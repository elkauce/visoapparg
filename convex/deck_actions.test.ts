import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema.ts";
import { modules } from "./test.setup.ts";

const deviceId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";

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
          homeWebhookUrl: "https://alice.example.test/hook",
        }),
        await ctx.db.insert("users", { name: "Bob" }),
      ] as const,
  );
  const alice = t.withIdentity({ subject: `${aliceId}|alice-session` });
  const bob = t.withIdentity({ subject: `${bobId}|bob-session` });
  const statusId = await alice.mutation(api.statuses.create, {
    name: "Libre",
    color: "#22c55e",
    icon: "check-circle",
  });
  const pageId = await alice.mutation(api.deck_layout.createPage, {
    name: "Principal",
  });
  return { t, alice, bob, statusId, pageId };
}

describe("Deck authenticated actions", () => {
  it("deduplicates concurrent requests in one transaction", async () => {
    const { t, alice, statusId } = await fixture();
    const results = await Promise.all([
      alice.mutation(api.deck_actions.activateStatus, {
        statusId,
        requestId,
        deviceId,
      }),
      alice.mutation(api.deck_actions.activateStatus, {
        statusId,
        requestId,
        deviceId,
      }),
    ]);
    expect(results.map((result) => result.duplicate).sort()).toEqual([
      false,
      true,
    ]);
    expect(
      await t.run((ctx) => ctx.db.query("deckActionRequests").collect()),
    ).toHaveLength(1);
    expect(
      await t.run((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect(),
      ),
    ).toHaveLength(1);
  });

  it("deduplicates the same request and schedules only one webhook", async () => {
    const { t, alice, statusId } = await fixture();
    expect(
      await alice.mutation(api.deck_actions.activateStatus, {
        statusId,
        requestId,
        deviceId,
      }),
    ).toMatchObject({ ok: true, duplicate: false });
    expect(
      await alice.mutation(api.deck_actions.activateStatus, {
        statusId,
        requestId,
        deviceId,
      }),
    ).toMatchObject({ ok: true, duplicate: true });
    expect(await alice.query(api.users.getCurrentUser, {})).toMatchObject({
      activeStatusId: statusId,
    });
    expect(
      await t.run((ctx) => ctx.db.query("deckActionRequests").collect()),
    ).toHaveLength(1);
    expect(
      await t.run((ctx) =>
        ctx.db.system.query("_scheduled_functions").collect(),
      ),
    ).toHaveLength(1);
    await expect(
      alice.mutation(api.deck_actions.activateStatus, {
        statusId: null,
        requestId,
        deviceId,
      }),
    ).rejects.toThrow(/CONFLICT/);
    expect(await alice.query(api.users.getCurrentUser, {})).toMatchObject({
      activeStatusId: statusId,
    });
  });

  it("does not replay a previous status after a later device change", async () => {
    const { alice, statusId } = await fixture();
    await alice.mutation(api.deck_actions.activateStatus, {
      statusId,
      requestId,
      deviceId,
    });
    await alice.mutation(api.statuses.setActive, { statusId: null });
    await alice.mutation(api.deck_actions.activateStatus, {
      statusId,
      requestId,
      deviceId,
    });
    expect(await alice.query(api.users.getCurrentUser, {})).not.toHaveProperty(
      "activeStatusId",
    );
  });

  it("isolates request ids per user and denies another user's status", async () => {
    const { t, alice, bob, statusId } = await fixture();
    await alice.mutation(api.deck_actions.activateStatus, {
      statusId,
      requestId,
      deviceId,
    });
    await expect(
      bob.mutation(api.deck_actions.activateStatus, {
        statusId,
        requestId,
        deviceId,
      }),
    ).rejects.toThrow(/FORBIDDEN/);
    expect(
      await bob.mutation(api.deck_actions.activateStatus, {
        statusId: null,
        requestId,
        deviceId,
      }),
    ).toMatchObject({ duplicate: false });
    await expect(
      t.mutation(api.deck_actions.activateStatus, {
        statusId: null,
        requestId,
        deviceId,
      }),
    ).rejects.toThrow(/UNAUTHENTICATED/);
    await expect(
      alice.mutation(api.deck_actions.activateStatus, {
        statusId: null,
        requestId: "not-an-id",
        deviceId,
      }),
    ).rejects.toThrow(/BAD_REQUEST/);
  });

  it("accepts owned automation references and removes dangling nested references", async () => {
    const { alice, bob, statusId, pageId } = await fixture();
    const otherPage = await alice.mutation(api.deck_layout.createPage, {
      name: "Destino",
    });
    const bobPage = await bob.mutation(api.deck_layout.createPage, {
      name: "Bob",
    });
    await expect(
      alice.mutation(api.deck_layout.setKey, {
        pageId,
        position: 0,
        content: {
          kind: "action",
          label: "Ajena",
          icon: "folder",
          color: "#ffffff",
          action: {
            type: "automation",
            steps: [{ type: "page", pageId: bobPage }],
          },
        },
      }),
    ).rejects.toThrow(/FORBIDDEN/);
    await alice.mutation(api.deck_layout.setKey, {
      pageId,
      position: 0,
      content: {
        kind: "action",
        label: "Rutina",
        icon: "check-circle",
        color: "#22c55e",
        action: {
          type: "automation",
          steps: [
            { type: "status", statusId },
            { type: "url", url: "https://example.test" },
          ],
        },
      },
    });
    await alice.mutation(api.deck_layout.setKey, {
      pageId,
      position: 1,
      content: {
        kind: "action",
        label: "Página",
        icon: "folder",
        color: "#ffffff",
        action: { type: "page", pageId: otherPage },
      },
    });
    await alice.mutation(api.statuses.remove, { statusId });
    expect((await alice.query(api.deck_layout.get, {}))!.keys).toHaveLength(1);
    await alice.mutation(api.deck_layout.removePage, { pageId: otherPage });
    expect((await alice.query(api.deck_layout.get, {}))!.keys).toHaveLength(0);
  });

  it("validates URL, RGB, Android and automation action boundaries", async () => {
    const { alice, pageId } = await fixture();
    const actions = [
      { type: "url", url: "javascript:alert(1)" },
      { type: "android-app", packageName: "../../system" },
      { type: "rgb", deviceId: "lamp", command: "brightness", brightness: 101 },
      { type: "rgb", deviceId: "lamp", command: "color", color: "red" },
      { type: "rgb", deviceId: "lamp", command: "power" },
      { type: "automation", steps: [] },
      {
        type: "automation",
        steps: Array.from({ length: 17 }, () => ({ type: "off" })),
      },
    ] as const;
    for (const action of actions) {
      await expect(
        alice.mutation(api.deck_layout.setKey, {
          pageId,
          position: 0,
          content: {
            kind: "action",
            label: "Acción",
            icon: "play",
            color: "#ffffff",
            action: action as never,
          },
        }),
      ).rejects.toThrow(/BAD_REQUEST/);
    }
    await alice.mutation(api.deck_layout.setKey, {
      pageId,
      position: 0,
      content: {
        kind: "action",
        label: "Android",
        icon: "play",
        color: "#ffffff",
        action: { type: "android-app", packageName: "com.android.settings" },
      },
    });
  });
});

describe("Deck media ownership", () => {
  it("persists, duplicates and clears Canvas without allowing another user's file", async () => {
    const { alice, bob, pageId } = await fixture();
    const uploaded = await alice.fetch("/deck/media", {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: "png",
    });
    const file = await uploaded.json();
    await alice.mutation(api.deck_layout.configurePage, {
      pageId,
      grid: { columns: 5, rows: 3 },
      canvas: { mediaStorageId: file.storageId },
    });
    let layout = (await alice.query(api.deck_layout.get, {}))!;
    expect(layout.pages[0].canvas).toMatchObject({
      mediaStorageId: file.storageId,
      mediaType: "image",
    });
    expect(layout.pages[0].canvas?.mediaUrl).toBeTypeOf("string");
    const copyId = await alice.mutation(api.deck_layout.duplicatePage, {
      pageId,
    });
    layout = (await alice.query(api.deck_layout.get, {}))!;
    expect(layout.pages.find((page) => page._id === copyId)?.canvas).toEqual(
      layout.pages[0].canvas,
    );
    const bobPage = await bob.mutation(api.deck_layout.createPage, {
      name: "Bob",
    });
    await expect(
      bob.mutation(api.deck_layout.configurePage, {
        pageId: bobPage,
        grid: { columns: 5, rows: 3 },
        canvas: { mediaStorageId: file.storageId },
      }),
    ).rejects.toThrow(/FORBIDDEN/);
    await alice.mutation(api.deck_layout.configurePage, {
      pageId,
      grid: { columns: 5, rows: 3 },
      canvas: null,
    });
    expect(
      (await alice.query(api.deck_layout.get, {}))!.pages[0],
    ).not.toHaveProperty("canvas");
  });

  it("protects Deck files through legacy Display media APIs and preserves shared files", async () => {
    const { t, alice, bob, statusId, pageId } = await fixture();
    const uploaded = await alice.fetch("/deck/media", {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: "png",
    });
    const file = await uploaded.json();
    const bobStatus = await bob.mutation(api.statuses.create, {
      name: "Bob",
      icon: "ban",
      color: "#ff0000",
    });
    await expect(
      bob.mutation(api.media.setMedia, {
        statusId: bobStatus,
        storageId: file.storageId,
      }),
    ).rejects.toThrow(/FORBIDDEN/);
    await alice.mutation(api.deck_layout.setKey, {
      pageId,
      position: 0,
      content: { kind: "clock" },
      appearance: { mediaStorageId: file.storageId },
    });
    await alice.mutation(api.media.setMedia, {
      statusId,
      storageId: file.storageId,
    });
    await alice.mutation(api.media.clearMedia, { statusId });
    expect(
      await t.run((ctx) => ctx.db.system.get("_storage", file.storageId)),
    ).not.toBeNull();
    await alice.mutation(api.media.setMedia, {
      statusId,
      storageId: file.storageId,
    });
    await alice.mutation(api.statuses.remove, { statusId });
    expect(
      await t.run((ctx) => ctx.db.system.get("_storage", file.storageId)),
    ).not.toBeNull();
    expect(
      (await alice.query(api.deck_layout.get, {}))!.keys[0].appearance
        ?.mediaUrl,
    ).toBeTypeOf("string");
  });

  it("binds uploaded media to the authenticated owner, preserves and clears appearance", async () => {
    const { alice, bob, pageId } = await fixture();
    const uploaded = await alice.fetch("/deck/media", {
      method: "POST",
      headers: { "Content-Type": "image/gif" },
      body: "GIF89a",
    });
    expect(uploaded.status).toBe(200);
    const file = await uploaded.json();
    expect(file).toMatchObject({ ok: true, mediaType: "image" });
    await alice.mutation(api.deck_layout.setKey, {
      pageId,
      position: 0,
      content: { kind: "clock" },
      appearance: {
        label: "Mi reloj",
        icon: "clock",
        color: "#ffaa00",
        mediaStorageId: file.storageId,
      },
    });
    let key = (await alice.query(api.deck_layout.get, {}))!.keys[0];
    expect(key.appearance).toMatchObject({
      label: "Mi reloj",
      mediaType: "image",
    });
    expect(key.appearance?.mediaUrl).toBeTypeOf("string");
    await alice.mutation(api.deck_layout.setKey, {
      pageId,
      position: 0,
      content: { kind: "off" },
    });
    key = (await alice.query(api.deck_layout.get, {}))!.keys[0];
    expect(key.appearance?.label).toBe("Mi reloj");
    const bobPage = await bob.mutation(api.deck_layout.createPage, {
      name: "Bob",
    });
    await expect(
      bob.mutation(api.deck_layout.setKey, {
        pageId: bobPage,
        position: 0,
        content: { kind: "clock" },
        appearance: { mediaStorageId: file.storageId },
      }),
    ).rejects.toThrow(/FORBIDDEN/);
    await alice.mutation(api.deck_layout.setKey, {
      pageId,
      position: 0,
      content: { kind: "off" },
      appearance: null,
    });
    expect(
      (await alice.query(api.deck_layout.get, {}))!.keys[0],
    ).not.toHaveProperty("appearance");
  });

  it("rejects anonymous, empty, unsupported and oversized uploads", async () => {
    const { t, alice } = await fixture();
    expect(
      (
        await t.fetch("/deck/media", {
          method: "POST",
          headers: { "Content-Type": "image/png" },
          body: "png",
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await alice.fetch("/deck/media", {
          method: "POST",
          headers: { "Content-Type": "image/svg+xml" },
          body: "<svg/>",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await alice.fetch("/deck/media", {
          method: "POST",
          headers: { "Content-Type": "image/png" },
          body: "",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await alice.fetch("/deck/media", {
          method: "POST",
          headers: {
            "Content-Type": "image/png",
            "Content-Length": "62914561",
          },
          body: "png",
        })
      ).status,
    ).toBe(413);
    const preflight = await t.fetch("/deck/media", { method: "OPTIONS" });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Headers")).toContain(
      "Authorization",
    );
  });
});
