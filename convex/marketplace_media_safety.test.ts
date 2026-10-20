import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const creatorId = await ctx.db.insert("users", { name: "Creator" });
    const buyerId = await ctx.db.insert("users", { name: "Buyer" });
    const outsiderId = await ctx.db.insert("users", { name: "Other" });
    const original = await ctx.storage.store(
      new Blob(["creator original"], { type: "image/png" }),
    );
    await ctx.db.insert("marketplaceUploads", {
      userId: creatorId,
      storageId: original,
      mediaType: "image",
      contentType: "image/png",
      size: 16,
      createdAt: Date.now(),
    });
    const productId = await ctx.db.insert("marketplaceProducts", {
      userId: creatorId,
      creatorName: "Creator",
      title: "Original pack",
      description: "One shared original, one private copy per user.",
      category: "icons",
      priceMode: "free",
      delivery: "assets",
      affiliate: false,
      assets: [
        {
          id: original,
          name: "Original",
          mediaType: "image",
          storageId: original,
        },
      ],
      status: "published",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const statusId = await ctx.db.insert("statuses", {
      userId: buyerId,
      name: "Private state",
      color: "#22c55e",
      icon: "check-circle",
      order: 0,
    });
    const otherStatusId = await ctx.db.insert("statuses", {
      userId: outsiderId,
      name: "Other state",
      color: "#ef4444",
      icon: "ban",
      order: 0,
    });
    return {
      creatorId,
      buyerId,
      outsiderId,
      original,
      productId,
      statusId,
      otherStatusId,
    };
  });
  return {
    t,
    ...ids,
    buyer: t.withIdentity({ subject: `${ids.buyerId}|session` }),
    outsider: t.withIdentity({ subject: `${ids.outsiderId}|session` }),
  };
}

it("an acquired original cannot be attached to and deleted through a buyer's status; an owned copy works", async () => {
  const f = await fixture();
  await f.buyer.mutation(api.marketplace.acquire, { productId: f.productId });
  const library = await f.buyer.query(api.marketplace.library, {});
  expect(library[0].assets[0].storageId).toBe(f.original);
  await expect(
    f.buyer.mutation(api.media.setMedia, {
      statusId: f.statusId,
      storageId: f.original,
    }),
  ).rejects.toThrow(/FORBIDDEN/);
  expect(
    await f.t.run((ctx) => ctx.db.get("statuses", f.statusId)),
  ).not.toHaveProperty("mediaStorageId");

  const copied = await f.buyer.action(api.marketplace.copyAssetToDeck, {
    productId: f.productId,
    assetId: f.original,
  });
  expect(copied.storageId).not.toBe(f.original);
  expect(copied.mediaType).toBe("image");
  await f.buyer.mutation(api.media.setMedia, {
    statusId: f.statusId,
    storageId: copied.storageId,
  });
  await expect(
    f.outsider.mutation(api.media.setMedia, {
      statusId: f.otherStatusId,
      storageId: copied.storageId,
    }),
  ).rejects.toThrow(/FORBIDDEN/);
  await f.buyer.mutation(api.media.clearMedia, { statusId: f.statusId });
  expect(
    await f.t.run((ctx) => ctx.db.system.get("_storage", f.original)),
  ).not.toBeNull();
  expect(
    await f.t.run((ctx) => ctx.db.system.get("_storage", copied.storageId)),
  ).not.toBeNull();
});

it.each(["clear", "replace", "remove"] as const)(
  "%s preserves a marketplace original even if an older status referenced it directly",
  async (operation) => {
    const f = await fixture();
    await f.t.run((ctx) =>
      ctx.db.patch("statuses", f.statusId, {
        mediaStorageId: f.original,
        mediaType: "image",
      }),
    );
    if (operation === "clear") {
      await f.buyer.mutation(api.media.clearMedia, { statusId: f.statusId });
    } else if (operation === "remove") {
      await f.buyer.mutation(api.statuses.remove, { statusId: f.statusId });
      expect(
        await f.t.run((ctx) => ctx.db.get("statuses", f.statusId)),
      ).toBeNull();
    } else {
      const replacement = await f.t.run(async (ctx) => {
        const storageId = await ctx.storage.store(
          new Blob(["replacement"], { type: "image/png" }),
        );
        await ctx.db.insert("deckMedia", {
          userId: f.buyerId,
          storageId,
          mediaType: "image",
        });
        return storageId;
      });
      await f.buyer.mutation(api.media.setMedia, {
        statusId: f.statusId,
        storageId: replacement,
      });
      expect(
        await f.t.run((ctx) => ctx.db.get("statuses", f.statusId)),
      ).toMatchObject({
        mediaStorageId: replacement,
      });
    }
    expect(
      await f.t.run((ctx) => ctx.db.system.get("_storage", f.original)),
    ).not.toBeNull();
  },
);

it("retains cleanup of legacy private status uploads that are not shared marketplace or deck media", async () => {
  const f = await fixture();
  const privateFile = await f.t.run((ctx) =>
    ctx.storage.store(new Blob(["legacy private"], { type: "image/png" })),
  );
  // convex-test omits contentType from storage metadata. Represent an
  // existing legacy private attachment directly, then exercise real cleanup.
  await f.t.run((ctx) =>
    ctx.db.patch("statuses", f.statusId, {
      mediaStorageId: privateFile,
      mediaType: "image",
    }),
  );
  await f.buyer.mutation(api.media.clearMedia, { statusId: f.statusId });
  expect(
    await f.t.run((ctx) => ctx.db.system.get("_storage", privateFile)),
  ).toBeNull();
  expect(
    await f.t.run((ctx) => ctx.db.system.get("_storage", f.original)),
  ).not.toBeNull();
});
