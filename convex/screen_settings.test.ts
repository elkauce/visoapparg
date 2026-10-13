import { it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { modules } from "./test.setup";
import { api } from "./_generated/api";
import {
  normalizeScreenSettings,
  validateScreenSettingsPatch,
} from "./lib/screen_settings";
it("keeps only supported settings and rejects invalid coordinates, colors and arbitrary providers", () => {
  expect(
    normalizeScreenSettings({
      leagues: ["nba", "nba", "invalid", "constructor"],
      color: "bad",
    }),
  ).toMatchObject({ leagues: ["nba"], color: "#a3ff12" });
  for (const patch of [
    { latitude: 91 },
    { longitude: NaN },
    { color: "url(x)" },
    { audioSource: "fake" },
    { leagues: ["invalid"] },
    { providerUrl: "https://example.test" },
  ])
    expect(() => validateScreenSettingsPatch(patch)).toThrow();
});
it("shares full-page settings, merges partial changes, duplicates them and rejects another owner", async () => {
  const t = convexTest(schema, modules);
  const [a, b] = await t.run(async (ctx) => [
    await ctx.db.insert("users", { name: "A" }),
    await ctx.db.insert("users", { name: "B" }),
  ]);
  const alice = t.withIdentity({ subject: `${a}|s` });
  const bob = t.withIdentity({ subject: `${b}|s` });
  const pageId = await alice.mutation(api.deck_layout.createPage, {
    name: "Clima",
  });
  await alice.mutation(api.deck_layout.configureScreen, {
    pageId,
    kind: "weather",
    screenSettings: { city: "Madrid", latitude: 40.4, longitude: -3.7 },
  });
  await alice.mutation(api.deck_layout.configureScreen, {
    pageId,
    screenSettings: { units: "fahrenheit" },
  });
  const layout = await alice.query(api.deck_layout.get, { unified: true });
  expect(layout!.pages[0].screenSettings).toMatchObject({
    city: "Madrid",
    latitude: 40.4,
    units: "fahrenheit",
  });
  const copy = await alice.mutation(api.deck_layout.duplicatePage, { pageId });
  expect(
    (await alice.query(api.deck_layout.get, { unified: true }))!.pages.find(
      (p) => p._id === copy,
    )!.screenSettings,
  ).toEqual(layout!.pages[0].screenSettings);
  await expect(
    bob.mutation(api.deck_layout.configureScreen, {
      pageId,
      kind: "visualizer",
      screenSettings: { color: "#abcdef" },
    }),
  ).rejects.toThrow();
  expect(
    (await alice.query(api.deck_layout.get, { unified: true }))!.pages[0].kind,
  ).toBe("weather");
});
