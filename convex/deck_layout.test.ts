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

  it("enforces the eight-page cap when creating or duplicating", async () => {
    const { alice } = await fixture();
    const first = await alice.mutation(api.deck_layout.createPage, {
      name: "Uno",
    });
    for (let index = 1; index < 8; index++)
      await alice.mutation(api.deck_layout.createPage, {
        name: `Página ${index}`,
      });
    await expect(
      alice.mutation(api.deck_layout.createPage, { name: "Nueve" }),
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
