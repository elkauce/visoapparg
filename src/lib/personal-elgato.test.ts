// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate/browser";
import { personalizeElgato, type ElgatoConfiguration } from "./personal-elgato";
const fixture: ElgatoConfiguration = {
  format: "viso-streamdeck-v1",
  actions: [
    {
      name: "Pepe",
      color: "#ffff00",
      url: `https://example.convex.site/deck/set?token=${"a".repeat(48)}&status=owned-id`,
    },
    {
      name: "Apagar",
      url: `https://example.convex.site/deck/set?token=${"a".repeat(48)}&status=off`,
    },
  ],
};
const installer = () =>
  new Uint8Array(
    readFileSync("public/downloads/VISO-Elgato-1.2.streamDeckPlugin"),
  );
describe("Personal Elgato installer", () => {
  it("includes the owned states and account without changing public installer", () => {
    const original = installer();
    const before = original.slice();
    const files = unzipSync(personalizeElgato(original, fixture));
    const path = Object.keys(files).find((p) => p.endsWith("/manifest.json"))!;
    const root = path.slice(0, -"manifest.json".length);
    const manifest = JSON.parse(strFromU8(files[path]));
    expect(
      manifest.Actions.slice(0, 2).map((a: { Name: string }) => a.Name),
    ).toEqual(["Pepe", "Apagar"]);
    expect(JSON.parse(strFromU8(files[root + "account.json"]))).toEqual(
      fixture,
    );
    expect(files[root + "bin/plugin.mjs"]).toBeDefined();
    expect(original).toEqual(before);
    expect(unzipSync(original)[root + "account.json"]).toBeUndefined();
  });
  it("public template is readable by the browser ZIP parser", () => {
    const files = unzipSync(installer());
    expect(Object.keys(files).length).toBeGreaterThan(10);
    expect(
      Object.keys(files).some((path) => path.endsWith("/manifest.json")),
    ).toBe(true);
  });
  it("rejects a mixed account or insecure endpoint", () => {
    for (const url of [
      fixture.actions[0].url.replace("a".repeat(48), "b".repeat(48)),
      fixture.actions[0].url.replace("https:", "http:"),
      "https://example.com/deck/set",
    ]) {
      expect(() =>
        personalizeElgato(installer(), {
          ...fixture,
          actions: [fixture.actions[0], { ...fixture.actions[1], url }],
        }),
      ).toThrow();
    }
  });
});
