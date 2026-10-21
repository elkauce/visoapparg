import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

async function fixture() {
  const t = convexTest(schema, modules);
  const data = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Buyer" });
    const otherId = await ctx.db.insert("users", { name: "Other" });
    const pageId = await ctx.db.insert("deckPages", {
      userId,
      name: "Main",
      order: 0,
    });
    const keyId = await ctx.db.insert("deckKeys", {
      userId,
      pageId,
      position: 0,
      content: {
        kind: "link",
        label: "My action",
        url: "https://example.com",
        color: "#123456",
        icon: "link",
      },
      appearance: { label: "Custom label", icon: "check", color: "#abcdef" },
    });
    const storageId = await ctx.storage.store(
      new Blob(["image"], { type: "image/png" }),
    );
    await ctx.db.insert("deckMedia", { userId, storageId, mediaType: "image" });
    await ctx.db.insert("marketplaceLibrary", {
      userId,
      productId: "creator-icons",
      title: "Creator pack",
      creatorName: "Creator",
      category: "icons",
      delivery: "assets",
      acquiredAt: 1,
      assets: [{ id: "art", name: "Artwork", mediaType: "image", storageId }],
    });
    return { userId, otherId, keyId, pageId, storageId };
  });
  const owner = t.withIdentity({ subject: `${data.userId}|mobile` });
  const other = t.withIdentity({ subject: `${data.otherId}|web` });
  const args = {
    productId: "creator-icons",
    assetId: "art",
    keyId: data.keyId,
    storageId: data.storageId,
    expectedMediaStorageId: null,
  };
  return { t, owner, other, args, ...data };
}

describe("Marketplace artwork application", () => {
  it("applies acquired artwork while preserving the current key action and appearance settings", async () => {
    const f = await fixture();
    const original = await f.t.run((ctx) => ctx.db.get("deckKeys", f.keyId));
    await f.owner.mutation(api.marketplace_apply.applyKeyMedia, f.args);
    const updated = await f.t.run((ctx) => ctx.db.get("deckKeys", f.keyId));
    expect(updated?.content).toEqual(original?.content);
    expect(updated?.appearance).toMatchObject({
      ...original?.appearance,
      mediaStorageId: f.storageId,
      mediaType: "image",
    });
  });

  it("blocks another account, unacquired assets and original files that are not owned media", async () => {
    const f = await fixture();
    await expect(
      f.other.mutation(api.marketplace_apply.applyKeyMedia, f.args),
    ).rejects.toThrow(/biblioteca/);
    await expect(
      f.owner.mutation(api.marketplace_apply.applyKeyMedia, {
        ...f.args,
        assetId: "not-acquired",
      }),
    ).rejects.toThrow(/biblioteca/);
    const foreign = await f.t.run(async (ctx) => {
      const storageId = await ctx.storage.store(
        new Blob(["other"], { type: "image/png" }),
      );
      await ctx.db.insert("deckMedia", {
        userId: f.otherId,
        storageId,
        mediaType: "image",
      });
      return storageId;
    });
    await expect(
      f.owner.mutation(api.marketplace_apply.applyKeyMedia, {
        ...f.args,
        storageId: foreign,
      }),
    ).rejects.toThrow(/autorizado/);
    const otherKey = await f.t.run(async (ctx) => {
      const pageId = await ctx.db.insert("deckPages", {
        userId: f.otherId,
        name: "Other page",
        order: 0,
      });
      return ctx.db.insert("deckKeys", {
        userId: f.otherId,
        pageId,
        position: 0,
        content: { kind: "off" },
      });
    });
    await expect(
      f.owner.mutation(api.marketplace_apply.applyKeyMedia, {
        ...f.args,
        keyId: otherKey,
      }),
    ).rejects.toThrow(/cuenta/);
    expect(
      (await f.t.run((ctx) => ctx.db.get("deckKeys", f.keyId)))?.appearance,
    ).not.toHaveProperty("mediaStorageId");
  });

  it("refuses to replace artwork changed after the preview and never rolls back a newer action", async () => {
    const f = await fixture();
    await f.owner.mutation(api.marketplace_apply.applyKeyMedia, f.args);
    await f.t.run(async (ctx) => {
      await ctx.db.patch("deckKeys", f.keyId, { content: { kind: "off" } });
    });
    await expect(
      f.owner.mutation(api.marketplace_apply.applyKeyMedia, f.args),
    ).rejects.toThrow(/otro dispositivo/);
    expect(
      (await f.t.run((ctx) => ctx.db.get("deckKeys", f.keyId)))?.content,
    ).toEqual({ kind: "off" });
  });
});
