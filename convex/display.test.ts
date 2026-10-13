import { it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { modules } from "./test.setup";
import { api } from "./_generated/api";
it("shares owned branding without changing the active status and restores status media on clear", async () => {
  const t = convexTest(schema, modules);
  const { user, foreign, image, video } = await t.run(async (ctx) => {
    const user = await ctx.db.insert("users", { name: "Owner" });
    const foreign = await ctx.db.insert("users", { name: "Other" });
    const image = await ctx.storage.store(
      new Blob(["image"], { type: "image/png" }),
    );
    const video = await ctx.storage.store(
      new Blob(["video"], { type: "video/mp4" }),
    );
    await ctx.db.insert("deckMedia", {
      userId: user,
      storageId: image,
      mediaType: "image",
    });
    await ctx.db.insert("deckMedia", {
      userId: user,
      storageId: video,
      mediaType: "video",
    });
    const status = await ctx.db.insert("statuses", {
      userId: user,
      name: "Libre",
      color: "#00ff00",
      icon: "check",
      order: 0,
    });
    await ctx.db.patch("users", user, { activeStatusId: status });
    return { user, foreign, image, video };
  });
  const owner = t.withIdentity({ subject: `${user}|s` });
  const other = t.withIdentity({ subject: `${foreign}|s` });
  await expect(
    t.mutation(api.display.setBackground, {
      storageId: image,
      fit: "contain",
      showStatus: false,
    }),
  ).rejects.toThrow(/UNAUTHENTICATED/);
  await expect(
    other.mutation(api.display.setBackground, {
      storageId: image,
      fit: "contain",
      showStatus: false,
    }),
  ).rejects.toThrow(/FORBIDDEN/);
  const slug = await owner.mutation(api.public_status.ensureMine, {});
  for (const [storageId, mediaType] of [
    [image, "image"],
    [video, "video"],
  ] as const) {
    await owner.mutation(api.display.setBackground, {
      storageId,
      fit: "contain",
      showStatus: false,
    });
    const data = await t.query(api.public_status.getPublicStatus, { slug });
    expect(data.found).toBe(true);
    if (data.found) {
      expect(data.background?.mediaType).toBe(mediaType);
      expect(data.background?.mediaUrl).toBeTruthy();
      expect(data.background?.showStatus).toBe(false);
      expect(data.status?.name).toBe("Libre");
    }
  }
  await owner.mutation(api.display.clearBackground, {});
  const data = await t.query(api.public_status.getPublicStatus, { slug });
  if (data.found) {
    expect(data.background).toBeNull();
    expect(data.status?.name).toBe("Libre");
  }
  expect(await owner.query(api.display.getBackground, {})).toBeNull();
});
