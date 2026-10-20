import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { normalizeMarketplacePageSettings } from "@/convex/lib/marketplace_page_templates";
import { CREATOR_GUIDES } from "./creator-guides";

const publicRoot = resolve(import.meta.dirname, "../../../public");
it("ships every downloadable example referenced by the creator documentation", () => {
  for (const guide of CREATOR_GUIDES) {
    for (const example of guide.examples) {
      const file = resolve(publicRoot, example.path.slice(1));
      expect(existsSync(file), example.path).toBe(true);
      expect(readFileSync(file).byteLength, example.path).toBeGreaterThan(0);
    }
  }
  expect(existsSync(resolve(publicRoot, "marketplace/creator-templates/LEEME.md"))).toBe(true);
});

it.each([
  ["weather", "pagina-ejemplo.json"],
  ["clock", "pagina-reloj-ejemplo.json"],
  ["football", "pagina-futbol-ejemplo.json"],
] as const)("provides a %s example accepted by the real native page validator", (template, filename) => {
  const settings = JSON.parse(readFileSync(resolve(publicRoot, "marketplace/creator-templates", filename), "utf8"));
  const normalized = normalizeMarketplacePageSettings(template, settings);
  expect(normalized).toMatchObject(settings);
});
