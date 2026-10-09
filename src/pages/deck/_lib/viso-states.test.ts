import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  findVisoStatus,
  normalizeVisoStatusName,
  VISO_STATES,
  type VisoStatusRecord,
} from "./viso-states.ts";

function status(name: string, id = name): VisoStatusRecord {
  return {
    _id: id as Id<"statuses">,
    name,
    color: "#123456",
    icon: "coffee",
  };
}

describe("VISO state matching", () => {
  it.each([
    ["  LIBRE ", "libre"],
    [" REUNIÓN ", "reunion"],
    [" en   llamada ", "en llamada"],
    [" NO\u00a0MOLESTAR ", "no molestar"],
  ])("normalizes %s without changing its meaning", (name, expected) => {
    expect(normalizeVisoStatusName(name)).toBe(expected);
  });

  it.each([
    ["reunion", "  EN REUNIÓN  "],
    ["llamada", " En llamada "],
  ] as const)("reuses the existing %s alias %s", (key, name) => {
    const existing = status(name);
    const definition = VISO_STATES.find((item) => item.key === key)!;
    expect(findVisoStatus(definition, [existing])).toBe(existing);
    expect(existing.name).toBe(name);
  });

  it("prefers a canonical saved state over an earlier legacy alias", () => {
    const alias = status("En reunión", "legacy");
    const canonical = status("Reunión", "canonical");
    const definition = VISO_STATES.find((item) => item.key === "reunion")!;
    expect(findVisoStatus(definition, [alias, canonical])).toBe(canonical);
  });

  it("does not rename Almuerzo or another custom state to No molestar", () => {
    const lunch = status("Almuerzo");
    const custom = status("Descanso");
    const definition = VISO_STATES.find((item) => item.key === "no-molestar")!;
    expect(findVisoStatus(definition, [lunch, custom])).toBeNull();
    const actual = status("NO MOLESTAR");
    expect(findVisoStatus(definition, [lunch, actual])).toBe(actual);
    expect(lunch.name).toBe("Almuerzo");
  });
});
