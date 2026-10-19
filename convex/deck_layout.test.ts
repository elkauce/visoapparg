import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema.ts";
import { modules } from "./test.setup.ts";

async function fixture() {
  const t = convexTest(schema, modules);
  const [aliceId, bobId] = await t.run(
    async (ctx) =>
      [
        await ctx.db.insert("users", { name: "Alice" }),
        await ctx.db.insert("users", { name: "Bob" }),
      ] as const,
  );
  const alice = t.withIdentity({ subject: `${aliceId}|session-a` });
  const bob = t.withIdentity({ subject: `${bobId}|session-b` });
  return { t, alice, bob, aliceId, bobId };
}

describe("Deck layout compatibility and ownership", () => {
  it("saves content and appearance in the same move transaction and rolls back a rejected move", async () => {
    const { alice } = await fixture();
    const pageId = await alice.mutation(api.deck_layout.createPage, {
      name: "Edición",
    });
    await alice.mutation(api.deck_layout.setKey, {
      pageId,
      position: 0,
      content: { kind: "off" },
    });
    await alice.mutation(api.deck_layout.setKey, {
      pageId,
      position: 1,
      content: { kind: "clock" },
    });
    const key = (await alice.query(api.deck_layout.get, {}))!.keys[0];
    await expect(
      alice.mutation(api.deck_layout.moveKey, {
        keyId: key._id,
        pageId,
        position: 1,
        content: { kind: "clock" },
        appearance: { label: "Cambio" },
      }),
    ).rejects.toThrow(/CONFLICT/);
    expect((await alice.query(api.deck_layout.get, {}))!.keys[0]).toMatchObject(
      { content: { kind: "off" }, position: 0 },
    );
    expect(
      (await alice.query(api.deck_layout.get, {}))!.keys[0],
    ).not.toHaveProperty("appearance");
    await alice.mutation(api.deck_layout.moveKey, {
      keyId: key._id,
      pageId,
      position: 2,
      from: { pageId, position: 0 },
      content: { kind: "clock" },
      appearance: { label: "Cambio" },
    });
    const moved = (await alice.query(api.deck_layout.get, {}))!.keys.find(
      (item) => item._id === key._id,
    );
    expect(moved).toMatchObject({
      content: { kind: "clock" },
      position: 2,
      appearance: { label: "Cambio" },
    });
  });

  it("preserves the original six states, order, off key and default 15 slots", async () => {
    const { alice } = await fixture();
    await alice.mutation(api.statuses.createDefaults, {});
    await alice.mutation(api.deck_layout.ensureDefault, {});
    await alice.mutation(api.deck_layout.ensureDefault, {});
    const statuses = (await alice.query(api.statuses.list, {}))!;
    const layout = (await alice.query(api.deck_layout.get, {}))!;
    expect(statuses.statuses.map((status) => status.name)).toEqual([
      "Libre",
      "Ocupado",
      "En reunión",
      "En llamada",
      "Almuerzo",
      "Ausente",
    ]);
    expect(layout.pages).toHaveLength(1);
    expect(layout.pages[0]).not.toHaveProperty("grid");
    expect(layout.keys).toHaveLength(7);
    expect(layout.keys.map((key) => key.position)).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ]);
    expect(layout.keys.map((key) => key.content)).toEqual([
      ...statuses.statuses.map((status) => ({
        kind: "status",
        statusId: status._id,
      })),
      { kind: "off" },
    ]);
    await alice.mutation(api.deck_layout.setKey, {
      pageId: layout.pages[0]._id,
      position: 14,
      content: { kind: "clock" },
    });
    await expect(
      alice.mutation(api.deck_layout.setKey, {
        pageId: layout.pages[0]._id,
        position: 15,
        content: { kind: "clock" },
      }),
    ).rejects.toThrow(/BAD_REQUEST/);
  });

  it("supports 6, 32 and custom grids up to 64 and rejects invalid positions", async () => {
    const { alice } = await fixture();
    const six = await alice.mutation(api.deck_layout.createPage, {
      name: "Seis",
      grid: { columns: 3, rows: 2 },
    });
    const thirtyTwo = await alice.mutation(api.deck_layout.createPage, {
      name: "Treinta y dos",
      grid: { columns: 8, rows: 4 },
    });
    const custom = await alice.mutation(api.deck_layout.createPage, {
      name: "Personalizada",
      grid: { columns: 8, rows: 8 },
    });
    for (const [pageId, position] of [
      [six, 5],
      [thirtyTwo, 31],
      [custom, 63],
    ] as const) {
      await alice.mutation(api.deck_layout.setKey, {
        pageId,
        position,
        content: { kind: "clock" },
      });
      await expect(
        alice.mutation(api.deck_layout.setKey, {
          pageId,
          position: position + 1,
          content: { kind: "clock" },
        }),
      ).rejects.toThrow(/BAD_REQUEST/);
    }
    for (const grid of [
      { columns: 0, rows: 2 },
      { columns: 2.5, rows: 2 },
      { columns: 9, rows: 8 },
      { columns: 17, rows: 1 },
    ]) {
      await expect(
        alice.mutation(api.deck_layout.createPage, { name: "Inválida", grid }),
      ).rejects.toThrow(/BAD_REQUEST/);
    }
    for (const position of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(
        alice.mutation(api.deck_layout.setKey, {
          pageId: custom,
          position,
          content: { kind: "off" },
        }),
      ).rejects.toThrow();
    }
  });

  it("refuses grid shrink until outlying keys are moved or removed", async () => {
    const { alice } = await fixture();
    const pageId = await alice.mutation(api.deck_layout.createPage, {
      name: "Grande",
      grid: { columns: 8, rows: 4 },
    });
    await alice.mutation(api.deck_layout.setKey, {
      pageId,
      position: 31,
      content: { kind: "off" },
    });
    await expect(
      alice.mutation(api.deck_layout.configurePage, {
        pageId,
        grid: { columns: 3, rows: 2 },
      }),
    ).rejects.toThrow(/BAD_REQUEST/);
    const key = (await alice.query(api.deck_layout.get, {}))!.keys[0];
    await alice.mutation(api.deck_layout.moveKey, {
      keyId: key._id,
      pageId,
      position: 5,
    });
    await alice.mutation(api.deck_layout.configurePage, {
      pageId,
      grid: { columns: 3, rows: 2 },
    });
    expect((await alice.query(api.deck_layout.get, {}))!.pages[0].grid).toEqual(
      { columns: 3, rows: 2 },
    );
  });

  it("duplicates complete pages and reorders only a complete owned set", async () => {
    const { alice, bob } = await fixture();
    const pageId = await alice.mutation(api.deck_layout.createPage, {
      name: "Original",
      grid: { columns: 8, rows: 4 },
    });
    await alice.mutation(api.deck_layout.setKey, {
      pageId,
      position: 31,
      content: { kind: "clock" },
      appearance: { label: "Reloj", color: "#ff8800" },
    });
    const copied = await alice.mutation(api.deck_layout.duplicatePage, {
      pageId,
    });
    const layout = (await alice.query(api.deck_layout.get, {}))!;
    expect(layout.pages[1]).toMatchObject({
      name: "Original copia",
      grid: { columns: 8, rows: 4 },
    });
    expect(layout.keys.find((key) => key.pageId === copied)).toMatchObject({
      position: 31,
      content: { kind: "clock" },
      appearance: { label: "Reloj", color: "#ff8800" },
    });
    await alice.mutation(api.deck_layout.reorderPages, {
      pageIds: [copied, pageId],
    });
    expect(
      (await alice.query(api.deck_layout.get, {}))!.pages.map(
        (page) => page._id,
      ),
    ).toEqual([copied, pageId]);
    const bobPage = await bob.mutation(api.deck_layout.createPage, {
      name: "Bob",
    });
    for (const pageIds of [[pageId], [pageId, pageId], [pageId, bobPage]]) {
      await expect(
        alice.mutation(api.deck_layout.reorderPages, { pageIds }),
      ).rejects.toThrow(/BAD_REQUEST/);
    }
    expect((await bob.query(api.deck_layout.get, {}))!.pages[0].order).toBe(0);
  });

  it("enforces the eleven-page cap (three built-ins plus eight custom pages) when creating or duplicating", async () => {
    const { alice } = await fixture();
    const first = await alice.mutation(api.deck_layout.createPage, {
      name: "Uno",
    });
    for (let index = 1; index < 11; index++)
      await alice.mutation(api.deck_layout.createPage, {
        name: `Página ${index}`,
      });
    await expect(
      alice.mutation(api.deck_layout.createPage, { name: "Doce" }),
    ).rejects.toThrow(/BAD_REQUEST/);
    await expect(
      alice.mutation(api.deck_layout.duplicatePage, { pageId: first }),
    ).rejects.toThrow(/BAD_REQUEST/);
  });

  it("moves and swaps atomically and rejects stale source positions", async () => {
    const { alice } = await fixture();
    const first = await alice.mutation(api.deck_layout.createPage, {
      name: "Uno",
    });
    const second = await alice.mutation(api.deck_layout.createPage, {
      name: "Dos",
    });
    await alice.mutation(api.deck_layout.setKey, {
      pageId: first,
      position: 0,
      content: { kind: "off" },
    });
    await alice.mutation(api.deck_layout.setKey, {
      pageId: second,
      position: 1,
      content: { kind: "clock" },
    });
    const [off, clock] = (await alice.query(api.deck_layout.get, {}))!.keys;
    await expect(
      alice.mutation(api.deck_layout.moveKey, {
        keyId: off._id,
        pageId: second,
        position: 1,
      }),
    ).rejects.toThrow(/CONFLICT/);
    await alice.mutation(api.deck_layout.moveKey, {
      keyId: off._id,
      pageId: second,
      position: 1,
      swap: true,
      from: { pageId: first, position: 0 },
    });
    const swapped = (await alice.query(api.deck_layout.get, {}))!.keys;
    expect(swapped.find((key) => key._id === off._id)).toMatchObject({
      pageId: second,
      position: 1,
    });
    expect(swapped.find((key) => key._id === clock._id)).toMatchObject({
      pageId: first,
      position: 0,
    });
    await expect(
      alice.mutation(api.deck_layout.moveKey, {
        keyId: off._id,
        pageId: first,
        position: 2,
        from: { pageId: first, position: 0 },
      }),
    ).rejects.toThrow(/CONFLICT/);
    expect((await alice.query(api.deck_layout.get, {}))!.keys).toEqual(swapped);
  });

  it("preserves one key per slot for concurrent occupied and empty moves", async () => {
    const { alice } = await fixture();
    const pageId = await alice.mutation(api.deck_layout.createPage, {
      name: "Concurrente",
    });
    await alice.mutation(api.deck_layout.setKey, {
      pageId,
      position: 0,
      content: { kind: "off" },
    });
    await alice.mutation(api.deck_layout.setKey, {
      pageId,
      position: 1,
      content: { kind: "clock" },
    });
    const [first, second] = (await alice.query(api.deck_layout.get, {}))!.keys;
    const results = await Promise.allSettled([
      alice.mutation(api.deck_layout.moveKey, {
        keyId: first._id,
        pageId,
        position: 2,
      }),
      alice.mutation(api.deck_layout.moveKey, {
        keyId: second._id,
        pageId,
        position: 2,
      }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    const layout = (await alice.query(api.deck_layout.get, {}))!;
    expect(layout.keys).toHaveLength(2);
    expect(new Set(layout.keys.map((key) => key.position)).size).toBe(2);
  });

  it("rejects cross-user pages, keys, and folder destinations for every edit", async () => {
    const { t, alice, bob } = await fixture();
    const alicePage = await alice.mutation(api.deck_layout.createPage, {
      name: "Alice",
    });
    const bobPage = await bob.mutation(api.deck_layout.createPage, {
      name: "Bob",
    });
    await bob.mutation(api.deck_layout.setKey, {
      pageId: bobPage,
      position: 0,
      content: { kind: "off" },
    });
    const bobKey = (await bob.query(api.deck_layout.get, {}))!.keys[0];
    const original = await bob.query(api.deck_layout.get, {});
    await expect(
      alice.mutation(api.deck_layout.configurePage, {
        pageId: bobPage,
        grid: { columns: 3, rows: 2 },
      }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(
      alice.mutation(api.deck_layout.renamePage, {
        pageId: bobPage,
        name: "Robada",
      }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(
      alice.mutation(api.deck_layout.duplicatePage, { pageId: bobPage }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(
      alice.mutation(api.deck_layout.removePage, { pageId: bobPage }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(
      alice.mutation(api.deck_layout.setKey, {
        pageId: bobPage,
        position: 0,
        content: { kind: "clock" },
      }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(
      alice.mutation(api.deck_layout.setKey, {
        pageId: alicePage,
        position: 0,
        content: {
          kind: "folder",
          label: "Bob",
          icon: "folder",
          color: "#ffffff",
          targetPageId: bobPage,
        },
      }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(
      alice.mutation(api.deck_layout.removeKey, { keyId: bobKey._id }),
    ).rejects.toThrow(/NOT_FOUND/);
    await expect(
      alice.mutation(api.deck_layout.moveKey, {
        keyId: bobKey._id,
        pageId: alicePage,
        position: 0,
      }),
    ).rejects.toThrow(/NOT_FOUND/);
    expect(await bob.query(api.deck_layout.get, {})).toEqual(original);
    expect(await t.query(api.deck_layout.get, {})).toBeNull();
    await expect(
      t.mutation(api.deck_layout.createPage, { name: "Sin sesión" }),
    ).rejects.toThrow(/UNAUTHENTICATED/);
  });

  it("never permits moving a folder into its own destination page", async () => {
    const { alice } = await fixture();
    const first = await alice.mutation(api.deck_layout.createPage, {
      name: "Uno",
    });
    const second = await alice.mutation(api.deck_layout.createPage, {
      name: "Dos",
    });
    await alice.mutation(api.deck_layout.setKey, {
      pageId: first,
      position: 0,
      content: {
        kind: "folder",
        targetPageId: second,
        label: "Dos",
        icon: "folder",
        color: "#ffffff",
      },
    });
    const folder = (await alice.query(api.deck_layout.get, {}))!.keys[0];
    await expect(
      alice.mutation(api.deck_layout.moveKey, {
        keyId: folder._id,
        pageId: second,
        position: 0,
      }),
    ).rejects.toThrow(/BAD_REQUEST/);
  });

  it("removes all 64-slot keys and dangling folders when removing a page", async () => {
    const { alice } = await fixture();
    const keep = await alice.mutation(api.deck_layout.createPage, {
      name: "Queda",
    });
    const remove = await alice.mutation(api.deck_layout.createPage, {
      name: "Fuera",
      grid: { columns: 8, rows: 8 },
    });
    await alice.mutation(api.deck_layout.setKey, {
      pageId: remove,
      position: 63,
      content: { kind: "clock" },
    });
    await alice.mutation(api.deck_layout.setKey, {
      pageId: keep,
      position: 0,
      content: {
        kind: "folder",
        targetPageId: remove,
        label: "Fuera",
        color: "#ffffff",
        icon: "folder",
      },
    });
    await alice.mutation(api.deck_layout.removePage, { pageId: remove });
    expect((await alice.query(api.deck_layout.get, {}))!.keys).toHaveLength(0);
    await expect(
      alice.mutation(api.deck_layout.removePage, { pageId: keep }),
    ).rejects.toThrow(/BAD_REQUEST/);
  });
});

describe("Shared APK/web page catalogue", () => {
  it("migrates once, retains existing page/key IDs, and never recreates a deleted Reloj", async () => {
    const { alice, bob } = await fixture();
    const oldPage = await alice.mutation(api.deck_layout.createPage, {
      name: "Mi página",
    });
    await alice.mutation(api.deck_layout.setKey, {
      pageId: oldPage,
      position: 0,
      content: { kind: "clock" },
    });
    const oldKey = (await alice.query(api.deck_layout.get, {}))!.keys[0]._id;
    await alice.mutation(api.deck_layout.ensureCatalogue, {});
    const apk = (await alice.query(api.deck_layout.get, { unified: true }))!;
    expect(apk.pages.map((p) => p.name)).toEqual([
      "Estados VISO",
      "Spotify",
      "Reloj",
      "Mi página",
    ]);
    expect(apk.keys.some((k) => k._id === oldKey && k.pageId === oldPage)).toBe(
      true,
    );
    const clock = apk.pages.find((p) => p.kind === "standby")!;
    await expect(
      bob.mutation(api.deck_layout.removePage, { pageId: clock._id }),
    ).rejects.toThrow();
    await alice.mutation(api.deck_layout.removePage, { pageId: clock._id });
    await alice.mutation(api.deck_layout.ensureCatalogue, {});
    expect(
      (await alice.query(api.deck_layout.get, { unified: true }))!.pages.map(
        (p) => p._id,
      ),
    ).not.toContain(clock._id);
    expect(
      (await alice.query(api.deck_layout.get, {}))!.pages.map((p) => p._id),
    ).toEqual([oldPage]);
  });
  it("shares weather, key appearance, page order and Reloj preferences by account", async () => {
    const { t, alice, aliceId, bob } = await fixture();
    await alice.mutation(api.deck_layout.ensureCatalogue, {});
    const layout = (await alice.query(api.deck_layout.get, { unified: true }))!;
    const statePage = layout.pages[0];
    const clock = layout.pages.find((p) => p.kind === "standby")!;
    await alice.mutation(api.deck_layout.setKey, {
      pageId: statePage._id,
      position: 0,
      content: {
        kind: "weather",
        label: "Buenos Aires",
        latitude: -34.6,
        longitude: -58.4,
      },
      appearance: { label: "Buenos Aires", icon: "cloud", color: "#ffff00" },
    });
    await alice.mutation(api.deck_layout.configureScreen, {
      pageId: clock._id,
      settings: { clockStyle: "analog", accent: "#ff00ff" },
    });
    await alice.mutation(api.deck_layout.configureScreen, {
      pageId: clock._id,
      settings: { showDate: false },
    });
    await expect(
      bob.mutation(api.deck_layout.configureScreen, {
        pageId: clock._id,
        settings: { accent: "#000000" },
      }),
    ).rejects.toThrow();
    const order = layout.pages.map((p) => p._id).reverse();
    await alice.mutation(api.deck_layout.reorderPages, { pageIds: order });
    const anotherDevice = t.withIdentity({
      subject: `${aliceId}|another-device`,
    });
    const shared = (await anotherDevice.query(api.deck_layout.get, {
      unified: true,
    }))!;
    expect(shared.pages.map((p) => p._id)).toEqual(order);
    expect(
      shared.keys.find((k) => k.pageId === statePage._id && k.position === 0),
    ).toMatchObject({
      content: {
        kind: "weather",
        label: "Buenos Aires",
        latitude: -34.6,
        longitude: -58.4,
      },
      appearance: { label: "Buenos Aires", color: "#ffff00" },
    });
    expect(
      shared.pages.find((p) => p._id === clock._id)!.standbySettings,
    ).toMatchObject({
      clockStyle: "analog",
      accent: "#ff00ff",
      showDate: false,
    });
    const duplicate = await alice.mutation(api.deck_layout.duplicatePage, {
      pageId: clock._id,
    });
    expect(
      (await alice.query(api.deck_layout.get, { unified: true }))!.pages.find(
        (p) => p._id === duplicate,
      ),
    ).toMatchObject({
      kind: "standby",
      standbySettings: { clockStyle: "analog" },
    });
  });
});

it("protects shared photos by owner and updates append/remove without losing other photos", async () => {
  const { t, alice, bob, aliceId, bobId } = await fixture();
  await alice.mutation(api.deck_layout.ensureCatalogue, {});
  const clock = (await alice.query(api.deck_layout.get, {
    unified: true,
  }))!.pages.find((page) => page.kind === "standby")!;
  const ids = await t.run(async (ctx) => {
    const own = [];
    for (let i = 0; i < 2; i++) {
      const storageId = await ctx.storage.store(
        new Blob([new Uint8Array([i + 1])], { type: "image/png" }),
      );
      await ctx.db.insert("deckMedia", {
        userId: aliceId,
        storageId,
        mediaType: "image",
      });
      own.push(storageId);
    }
    const foreign = await ctx.storage.store(
      new Blob([new Uint8Array([3])], { type: "image/png" }),
    );
    await ctx.db.insert("deckMedia", {
      userId: bobId,
      storageId: foreign,
      mediaType: "image",
    });
    return { own, foreign };
  });
  await alice.mutation(api.deck_layout.configureScreen, {
    pageId: clock._id,
    photos: [ids.own[0]],
    photoOperation: "append",
  });
  await alice.mutation(api.deck_layout.configureScreen, {
    pageId: clock._id,
    photos: [ids.own[1]],
    photoOperation: "append",
  });
  await expect(
    alice.mutation(api.deck_layout.configureScreen, {
      pageId: clock._id,
      photos: [ids.foreign],
      photoOperation: "append",
    }),
  ).rejects.toThrow(/FORBIDDEN/);
  await expect(
    bob.mutation(api.deck_layout.configureScreen, {
      pageId: clock._id,
      photos: [],
      photoOperation: "remove",
    }),
  ).rejects.toThrow();
  expect(
    (await alice.query(api.deck_layout.get, { unified: true }))!.pages.find(
      (page) => page._id === clock._id,
    )!.standbyPhotos,
  ).toEqual(ids.own);
  await alice.mutation(api.deck_layout.configureScreen, {
    pageId: clock._id,
    photos: [ids.own[0]],
    photoOperation: "remove",
  });
  expect(
    (await alice.query(api.deck_layout.get, { unified: true }))!.pages.find(
      (page) => page._id === clock._id,
    )!.standbyPhotos,
  ).toEqual([ids.own[1]]);
});

it("preserves a full existing status library during catalogue migration", async () => {
  const { t, alice, aliceId } = await fixture();
  const ids = await t.run(async (ctx) => {
    const ids = [];
    for (let i = 0; i < 24; i++)
      ids.push(
        await ctx.db.insert("statuses", {
          userId: aliceId,
          name: `Personal ${i}`,
          color: "#00ffff",
          icon: "star",
          order: i + 100,
        }),
      );
    return ids;
  });
  await alice.mutation(api.deck_layout.ensureCatalogue, {});
  expect(
    (await alice.query(api.statuses.list, {}))!.statuses.map(
      (status) => status._id,
    ),
  ).toEqual(ids);
  const page = (await alice.query(api.deck_layout.get, {
    unified: true,
  }))!.pages.find((page) => page.name === "Estados VISO")!;
  expect(page.grid).toEqual({ columns: 3, rows: 2 });
});

it("shares sports content selection between sessions without overwriting teams and rejects foreign changes", async () => {
  const { t, alice, aliceId, bob } = await fixture();
  await alice.mutation(api.deck_layout.ensureCatalogue, {});
  const pageId = await alice.mutation(api.deck_layout.createPage, {
    name: "Deportes",
  });
  await alice.mutation(api.deck_layout.configureScreen, {
    pageId,
    kind: "sports",
    screenSettings: { leagues: ["ligaarg", "nba"], favorite: "River" },
  });
  await alice.mutation(api.deck_layout.configureScreen, {
    pageId,
    screenSettings: {
      sportsLeague: "nba",
      sportsDate: "2025-11-09",
      sportsView: "history",
      sportsFilter: "post",
    },
  });
  const mobile = t.withIdentity({ subject: `${aliceId}|mobile` });
  const layout = await mobile.query(api.deck_layout.get, { unified: true });
  expect(
    layout?.pages.find((p) => p._id === pageId)?.screenSettings,
  ).toMatchObject({
    leagues: ["ligaarg", "nba"],
    favorite: "River",
    sportsLeague: "nba",
    sportsDate: "2025-11-09",
    sportsView: "history",
    sportsFilter: "post",
  });
  await mobile.mutation(api.deck_layout.configureScreen, {
    pageId,
    screenSettings: {
      sportsView: "table",
      sportsTeams: ["River Plate", "Boca Juniors"],
    },
  });
  expect(
    (await alice.query(api.deck_layout.get, { unified: true }))?.pages.find(
      (p) => p._id === pageId,
    )?.screenSettings,
  ).toMatchObject({ sportsView: "table", sportsDate: "2025-11-09" });
  await expect(
    bob.mutation(api.deck_layout.configureScreen, {
      pageId,
      screenSettings: { sportsLeague: "ligaarg" },
    }),
  ).rejects.toThrow();
  await expect(
    alice.mutation(api.deck_layout.configureScreen, {
      pageId,
      screenSettings: { sportsDate: "2025-02-31" },
    }),
  ).rejects.toThrow();
});

it("stores opt-in idle pages by account, rejects foreign pages and can disable after deletion", async () => {
  const { t, alice, aliceId, bob } = await fixture();
  await alice.mutation(api.deck_layout.ensureCatalogue, {});
  await bob.mutation(api.deck_layout.ensureCatalogue, {});
  const pages = (await alice.query(api.deck_layout.get, { unified: true }))!
    .pages;
  const foreign = (await bob.query(api.deck_layout.get, { unified: true }))!
    .pages[0]._id;
  await expect(
    alice.mutation(api.deck_layout.setIdle, {
      enabled: true,
      mainPageId: pages[0]._id,
      restPageId: foreign,
      seconds: 3,
    }),
  ).rejects.toThrow();
  await expect(
    alice.mutation(api.deck_layout.setIdle, {
      enabled: true,
      mainPageId: pages[0]._id,
      restPageId: pages[0]._id,
      seconds: 3,
    }),
  ).rejects.toThrow();
  await alice.mutation(api.deck_layout.setIdle, {
    enabled: true,
    mainPageId: pages[0]._id,
    restPageId: pages[1]._id,
    seconds: 3,
  });
  expect(
    (
      await t
        .withIdentity({ subject: `${aliceId}|mobile` })
        .query(api.users.getCurrentUser, {})
    )?.deckIdle,
  ).toMatchObject({ enabled: true, seconds: 3, restPageId: pages[1]._id });
  await t.run((ctx) => ctx.db.delete("deckPages", pages[1]._id));
  await alice.mutation(api.deck_layout.disableIdle, {});
  expect(
    (await alice.query(api.users.getCurrentUser, {}))?.deckIdle?.enabled,
  ).toBe(false);
});
