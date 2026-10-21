import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { MAX_PAGES } from "./lib/deck_keys";
import { normalizeMarketplacePageSettings } from "./lib/marketplace_page_templates";

async function fixture() {
  const t = convexTest(schema, modules);
  const [ownerId, otherId] = await t.run(
    async (ctx) =>
      [
        await ctx.db.insert("users", { name: "Propietario" }),
        await ctx.db.insert("users", { name: "Otro usuario" }),
      ] as const,
  );
  const owner = t.withIdentity({ subject: `${ownerId}|desktop` });
  const other = t.withIdentity({ subject: `${otherId}|other` });
  const mobile = t.withIdentity({ subject: `${ownerId}|mobile` });
  return { t, ownerId, otherId, owner, other, mobile };
}

describe("Marketplace native pages", () => {
  it("requires the current user's acquisition and never accepts another account's library", async () => {
    const f = await fixture();
    await f.owner.mutation(api.marketplace.acquire, {
      productId: "viso-page-clock",
    });
    await expect(
      f.t.mutation(api.marketplace_pages.installPage, {
        productId: "viso-page-clock",
      }),
    ).rejects.toThrow(/iniciar sesión/);
    await expect(
      f.other.mutation(api.marketplace_pages.installPage, {
        productId: "viso-page-clock",
      }),
    ).rejects.toThrow(/biblioteca/);
    await f.owner.mutation(api.marketplace.acquire, {
      productId: "viso-original-icons",
    });
    await expect(
      f.owner.mutation(api.marketplace_pages.installPage, {
        productId: "viso-original-icons",
      }),
    ).rejects.toThrow(/biblioteca/);
    expect(
      (await f.other.query(api.deck_layout.get, { unified: true }))!.pages,
    ).toEqual([]);
  });

  it("installs all five real native pages and shares their IDs across web and mobile sessions", async () => {
    const f = await fixture();
    for (const suffix of [
      "football",
      "clock",
      "weather",
      "spotify",
      "visualizer",
    ]) {
      const productId = `viso-page-${suffix}`;
      await f.owner.mutation(api.marketplace.acquire, { productId });
      await f.owner.mutation(api.marketplace_pages.installPage, { productId });
    }
    const desktop = (await f.owner.query(api.deck_layout.get, {
      unified: true,
    }))!;
    const mobile = (await f.mobile.query(api.deck_layout.get, {
      unified: true,
    }))!;
    expect(desktop.pages.map((page) => page.kind)).toEqual([
      "grid",
      "weather",
      "sports",
      "standby",
      "spotify",
      "visualizer",
    ]);
    expect(mobile).toEqual(desktop);
    expect(desktop.keys).toHaveLength(6);
    expect(
      desktop.pages.filter(
        (page) => page.marketplaceProductId === "viso-page-weather",
      ),
    ).toHaveLength(1);
  });

  it("does not duplicate an installed page, overwrite edits or re-add removed starter pages", async () => {
    const f = await fixture();
    const productId = "viso-page-weather";
    await f.owner.mutation(api.marketplace.acquire, { productId });
    const first = await f.owner.mutation(api.marketplace_pages.installPage, {
      productId,
    });
    expect(first.existing).toBe(true);
    await f.owner.mutation(api.deck_layout.configureScreen, {
      pageId: first.pageId,
      screenSettings: { city: "Rosario", latitude: -32.95, longitude: -60.65 },
    });
    const second = await f.mobile.mutation(api.marketplace_pages.installPage, {
      productId,
    });
    expect(second).toEqual({ ...first, existing: true });
    expect(
      (await f.owner.query(api.deck_layout.get, { unified: true }))!.pages[1]
        .screenSettings.city,
    ).toBe("Rosario");
    await f.owner.mutation(api.deck_layout.removePage, {
      pageId: first.pageId,
    });
    await f.owner.mutation(api.deck_layout.ensureCatalogue, {});
    expect(
      (await f.owner.query(api.deck_layout.get, { unified: true }))!.pages,
    ).toHaveLength(1);
    const reinstalled = await f.owner.mutation(
      api.marketplace_pages.installPage,
      { productId },
    );
    expect(reinstalled.existing).toBe(false);
    expect(reinstalled.pageId).not.toBe(first.pageId);
  });

  it("reuses earlier VISO pages without changing their settings, keys or other pages", async () => {
    const f = await fixture();
    const oldPageId = await f.owner.mutation(api.deck_layout.createPage, {
      name: "Mi reloj azul",
    });
    await f.owner.mutation(api.deck_layout.configureScreen, {
      pageId: oldPageId,
      kind: "standby",
      settings: { accent: "#0000ff", showDate: false },
    });
    const before = (await f.owner.query(api.deck_layout.get, {
      unified: true,
    }))!.pages[0];
    await f.owner.mutation(api.marketplace.acquire, {
      productId: "viso-page-clock",
    });
    expect(
      await f.owner.mutation(api.marketplace_pages.installPage, {
        productId: "viso-page-clock",
      }),
    ).toEqual({ pageId: oldPageId, existing: true });
    const after = (await f.mobile.query(api.deck_layout.get, {
      unified: true,
    }))!.pages;
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({
      name: before.name,
      order: before.order,
      standbySettings: before.standbySettings,
    });
  });

  it("installs a creator's acquired configured revision without reading later product edits", async () => {
    const f = await fixture();
    const productId = "creator-weather-page";
    await f.t.run(async (ctx) => {
      await ctx.db.insert("marketplaceLibrary", {
        userId: f.ownerId,
        productId,
        title: "Clima de Córdoba",
        category: "pages",
        creatorName: "Creador",
        delivery: "page",
        assets: [],
        pageTemplate: "weather",
        revision: 2,
        acquiredAt: Date.now(),
        pageSettings: {
          screenSettings: {
            city: "Córdoba",
            latitude: -31.42,
            longitude: -64.19,
            units: "celsius",
          },
        },
      });
    });
    const installed = await f.owner.mutation(
      api.marketplace_pages.installPage,
      { productId },
    );
    const pages = (await f.mobile.query(api.deck_layout.get, {
      unified: true,
    }))!.pages;
    expect(pages).toHaveLength(3);
    expect(pages.find((page) => page._id === installed.pageId)).toMatchObject({
      name: "Clima de Córdoba",
      kind: "weather",
      marketplaceProductId: productId,
      marketplaceVersion: "2",
      screenSettings: { city: "Córdoba", latitude: -31.42, longitude: -64.19 },
    });
    expect(pages[1].marketplaceProductId).toBe("viso-page-weather");
  });

  it("enforces the existing page limit without deleting or modifying the deck", async () => {
    const f = await fixture();
    for (let i = 0; i < MAX_PAGES; i++) {
      await f.owner.mutation(api.deck_layout.createPage, {
        name: `Página ${i}`,
      });
    }
    await f.owner.mutation(api.marketplace.acquire, {
      productId: "viso-page-football",
    });
    const before = await f.owner.query(api.deck_layout.get, { unified: true });
    await expect(
      f.owner.mutation(api.marketplace_pages.installPage, {
        productId: "viso-page-football",
      }),
    ).rejects.toThrow(/hasta 11 páginas/);
    expect(await f.owner.query(api.deck_layout.get, { unified: true })).toEqual(
      before,
    );
  });

  it("applies a newer acquired preset only when the user explicitly chooses to replace settings", async () => {
    const f = await fixture();
    const productId = "creator-clock-page";
    const entryId = await f.t.run((ctx) =>
      ctx.db.insert("marketplaceLibrary", {
        userId: f.ownerId,
        productId,
        title: "Reloj del creador",
        category: "pages",
        creatorName: "Creador",
        delivery: "page",
        assets: [],
        pageTemplate: "clock",
        revision: 1,
        acquiredAt: Date.now(),
        pageSettings: {
          standbySettings: { accent: "#0000ff", clockStyle: "analog" },
        },
      }),
    );
    const first = await f.owner.mutation(api.marketplace_pages.installPage, {
      productId,
    });
    await f.t.run((ctx) =>
      ctx.db.patch("marketplaceLibrary", entryId, {
        revision: 2,
        pageSettings: {
          standbySettings: { accent: "#ff0000", clockStyle: "flip" },
        },
      }),
    );
    await f.owner.mutation(api.marketplace_pages.installPage, { productId });
    let page = (await f.mobile.query(api.deck_layout.get, {
      unified: true,
    }))!.pages.find((p) => p._id === first.pageId)!;
    expect(page.standbySettings).toMatchObject({
      accent: "#0000ff",
      clockStyle: "analog",
    });
    expect(page.marketplaceVersion).toBe("1");
    expect(
      await f.owner.mutation(api.marketplace_pages.installPage, {
        productId,
        updateExisting: true,
      }),
    ).toMatchObject({ existing: true, updated: true });
    page = (await f.mobile.query(api.deck_layout.get, {
      unified: true,
    }))!.pages.find((p) => p._id === first.pageId)!;
    expect(page.standbySettings).toMatchObject({
      accent: "#ff0000",
      clockStyle: "flip",
    });
    expect(page.marketplaceVersion).toBe("2");
  });
});

describe("Creator page preset validation", () => {
  it("accepts bounded native settings and rejects executable or foreign template fields", () => {
    expect(
      normalizeMarketplacePageSettings("weather", {
        screenSettings: { city: "Córdoba" },
      })?.screenSettings?.city,
    ).toBe("Córdoba");
    expect(
      normalizeMarketplacePageSettings("clock", {
        standbySettings: { clockStyle: "analog", accent: "#ff0000" },
      })?.standbySettings,
    ).toMatchObject({ clockStyle: "analog", accent: "#ff0000" });
    for (const value of [
      { script: "alert(1)" },
      { screenSettings: { html: "<script>" } },
      { screenSettings: { latitude: 91 } },
    ])
      expect(() =>
        normalizeMarketplacePageSettings("weather", value),
      ).toThrow();
    expect(
      normalizeMarketplacePageSettings("visualizer", {
        screenSettings: {
          visualizerStyle: "mirror",
          audioSource: "microphone",
          sensitivity: 1.5,
        },
      })?.screenSettings?.sensitivity,
    ).toBe(1.5);
    expect(() =>
      normalizeMarketplacePageSettings("visualizer", {
        screenSettings: { city: "Rosario" },
      }),
    ).toThrow();
    expect(() =>
      normalizeMarketplacePageSettings("spotify", {
        screenSettings: { city: "Rosario" },
      }),
    ).toThrow();
    expect(() =>
      normalizeMarketplacePageSettings("clock", {
        standbySettings: { css: "url(https://evil.test)" },
      }),
    ).toThrow();
  });
});
