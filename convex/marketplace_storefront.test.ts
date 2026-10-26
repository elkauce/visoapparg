import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { DEFAULT_STOREFRONT } from "./lib/marketplace_storefront";
afterEach(() => vi.unstubAllEnvs());
async function fixture() {
  const t = convexTest(schema, modules);
  const [adminId, buyerId, otherId] = await t.run(async (ctx) =>
    Promise.all(
      ["admin", "buyer", "other"].map((name) =>
        ctx.db.insert("users", { email: `${name}@example.test` }),
      ),
    ),
  );
  vi.stubEnv("MARKETPLACE_ADMIN_USER_IDS", adminId);
  return {
    t,
    adminId,
    buyerId,
    otherId,
    admin: t.withIdentity({ subject: adminId }),
    buyer: t.withIdentity({ subject: buyerId }),
    other: t.withIdentity({ subject: otherId }),
  };
}
describe("Marketplace shared storefront", () => {
  it("requires authentication and grants editing only to the configured administrator", async () => {
    const { t, buyer } = await fixture();
    await expect(t.query(api.marketplace_storefront.get, {})).rejects.toThrow();
    await expect(
      buyer.mutation(api.marketplace_storefront.save, {
        configuration: DEFAULT_STOREFRONT,
        expectedRevision: 0,
      }),
    ).rejects.toThrow("permiso");
  });
  it("synchronizes optional carousel, category names/video and pulse while rejecting a stale editor", async () => {
    const { admin, buyer } = await fixture();
    const configuration = structuredClone(DEFAULT_STOREFRONT);
    configuration.showSlider = false;
    configuration.categories[0].showName = false;
    configuration.categories[0].media = {
      mediaType: "video",
      builtinPath: "/marketplace/animated/libre.mp4",
    };
    configuration.pulse.colors = ["#22c55e", "#ef4444"];
    expect(
      await admin.mutation(api.marketplace_storefront.save, {
        configuration,
        expectedRevision: 0,
      }),
    ).toBe(1);
    const result = await buyer.query(api.marketplace_storefront.get, {});
    expect(result.configuration.showSlider).toBe(false);
    expect(result.configuration.categories[0].showName).toBe(false);
    expect(result.configuration.categories[0].media?.url).toContain(
      "libre.mp4",
    );
    expect(result.configuration.pulse.colors).toEqual(
      configuration.pulse.colors,
    );
    await expect(
      admin.mutation(api.marketplace_storefront.save, {
        configuration,
        expectedRevision: 0,
      }),
    ).rejects.toThrow("otro dispositivo");
  });
  it("rejects duplicate category identities, invalid targets, media traversal and injected colors", async () => {
    const { admin } = await fixture();
    for (const change of [
      (c: typeof DEFAULT_STOREFRONT) => c.categories.push(c.categories[0]),
      (c: typeof DEFAULT_STOREFRONT) =>
        (c.slides[0].target = { kind: "view", value: "https://other.example" }),
      (c: typeof DEFAULT_STOREFRONT) =>
        (c.slides[0].media = {
          mediaType: "image",
          builtinPath: "/marketplace/../private.png",
        }),
      (c: typeof DEFAULT_STOREFRONT) =>
        (c.pulse.colors = ["#fff", "red; color:green"]),
    ]) {
      const c = structuredClone(DEFAULT_STOREFRONT);
      change(c);
      await expect(
        admin.mutation(api.marketplace_storefront.save, {
          configuration: c,
          expectedRevision: 0,
        }),
      ).rejects.toThrow();
    }
  });
  it("rejects another user's upload and a mismatched video/image type", async () => {
    const { t, admin, adminId, otherId } = await fixture();
    const storageId = await t.run(async (ctx) => {
      const id = await ctx.storage.store(
        new Blob(["image"], { type: "image/png" }),
      );
      await ctx.db.insert("marketplaceUploads", {
        storageId: id,
        userId: otherId,
        mediaType: "image",
        contentType: "image/png",
        size: 5,
        createdAt: Date.now(),
      });
      return id;
    });
    const c = structuredClone(DEFAULT_STOREFRONT);
    c.slides[0].media = { storageId, mediaType: "image" };
    await expect(
      admin.mutation(api.marketplace_storefront.save, {
        configuration: c,
        expectedRevision: 0,
      }),
    ).rejects.toThrow("cuenta");
    await t.run(async (ctx) => {
      const upload = await ctx.db
        .query("marketplaceUploads")
        .withIndex("by_storage", (q) => q.eq("storageId", storageId))
        .unique();
      await ctx.db.patch("marketplaceUploads", upload!._id, {
        userId: adminId,
      });
    });
    c.slides[0].media = { storageId, mediaType: "video" };
    await expect(
      admin.mutation(api.marketplace_storefront.save, {
        configuration: c,
        expectedRevision: 0,
      }),
    ).rejects.toThrow();
    c.slides[0].media = { storageId, mediaType: "image" };
    await admin.mutation(api.marketplace_storefront.save, {
      configuration: c,
      expectedRevision: 0,
    });
    expect(
      (await admin.query(api.marketplace_storefront.get, {})).configuration
        .slides[0].media?.url,
    ).toBeTruthy();
  });
});
describe("Marketplace account shopping", () => {
  it("follows only public creators, keeps each user's selection isolated and preserves the cart", async () => {
    const { t, buyer, other, otherId } = await fixture();
    const creatorId = await t.run((ctx) =>
      ctx.db.insert("creatorProfiles", {
        userId: otherId,
        displayName: "Nueva tienda",
        bio: "Creaciones",
        status: "pending",
        createdAt: 0,
        updatedAt: 0,
      }),
    );
    await expect(
      buyer.mutation(api.marketplace_shopping.follow, {
        creatorId,
        present: true,
      }),
    ).rejects.toThrow("disponible");
    expect(
      (await buyer.query(api.marketplace_shopping.creators, {})).some(
        (c) => c.id === creatorId,
      ),
    ).toBe(false);
    await t.run((ctx) =>
      ctx.db.patch("creatorProfiles", creatorId, { status: "approved" }),
    );
    await buyer.mutation(api.marketplace_shopping.set, {
      productId: "viso-living-icons",
      collection: "cart",
      present: true,
    });
    await buyer.mutation(api.marketplace_shopping.follow, {
      creatorId,
      present: true,
    });
    expect(
      (await buyer.query(api.marketplace_shopping.get, {})).cart,
    ).toHaveLength(1);
    expect(
      (await buyer.query(api.marketplace_shopping.following, {}))[0].creator
        ?.displayName,
    ).toBe("Nueva tienda");
    expect(await other.query(api.marketplace_shopping.following, {})).toEqual(
      [],
    );
    await buyer.mutation(api.marketplace_shopping.follow, {
      creatorId,
      present: false,
    });
    expect(await buyer.query(api.marketplace_shopping.following, {})).toEqual(
      [],
    );
  });

  it("keeps cart and saved products isolated between accounts and de-duplicates concurrent additions", async () => {
    const { buyer, other } = await fixture();
    const args = {
      collection: "cart" as const,
      productId: "viso-living-icons",
      present: true,
    };
    await buyer.mutation(api.marketplace_shopping.set, args);
    await buyer.mutation(api.marketplace_shopping.set, args);
    const mine = await buyer.query(api.marketplace_shopping.get, {});
    expect(mine.cart).toHaveLength(1);
    expect(mine.cart[0].product?.priceMode).toBe("free");
    expect((await other.query(api.marketplace_shopping.get, {})).cart).toEqual(
      [],
    );
    await buyer.mutation(api.marketplace_shopping.set, {
      ...args,
      collection: "saved",
    });
    await buyer.mutation(api.marketplace_shopping.set, {
      ...args,
      present: false,
    });
    expect((await buyer.query(api.marketplace_shopping.get, {})).saved).toEqual(
      [args.productId],
    );
    expect((await buyer.query(api.marketplace_shopping.get, {})).cart).toEqual(
      [],
    );
  });
  it("does not add private/draft/informational products or accept a fabricated price", async () => {
    const { buyer } = await fixture();
    for (const productId of ["made-up-product", "viso-mini"]) {
      await expect(
        buyer.mutation(api.marketplace_shopping.set, {
          collection: "cart",
          productId,
          present: true,
        }),
      ).rejects.toThrow("disponible");
    }
    await expect(
      buyer.mutation(api.marketplace_shopping.set, {
        collection: "cart",
        productId: "viso-living-icons",
        present: true,
        priceAmount: 1,
      } as never),
    ).rejects.toThrow();
  });
  it("can remove unavailable entries and reveals only approved public creator details", async () => {
    const { t, buyer, buyerId, otherId } = await fixture();
    await t.run(async (ctx) => {
      await ctx.db.insert("marketplaceShopping", {
        userId: buyerId,
        cart: ["retired"],
        saved: [],
        updatedAt: 0,
      });
    });
    await buyer.mutation(api.marketplace_shopping.set, {
      collection: "cart",
      productId: "retired",
      present: false,
    });
    expect((await buyer.query(api.marketplace_shopping.get, {})).cart).toEqual(
      [],
    );
    const creatorId = await t.run((ctx) =>
      ctx.db.insert("creatorProfiles", {
        userId: otherId,
        displayName: "Creador",
        bio: "Diseños",
        status: "pending",
        createdAt: 0,
        updatedAt: 0,
      }),
    );
    expect(
      await buyer.query(api.marketplace_shopping.creator, { creatorId }),
    ).toBeNull();
    await t.run((ctx) =>
      ctx.db.patch("creatorProfiles", creatorId, { status: "approved" }),
    );
    expect(
      await buyer.query(api.marketplace_shopping.creator, { creatorId }),
    ).toMatchObject({ displayName: "Creador", official: false });
  });
});
