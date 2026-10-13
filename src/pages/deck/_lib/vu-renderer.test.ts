import { it, expect } from "vitest";
import { drawReferenceMeter, levelToPosition } from "./vu-renderer";
import {
  normalizeScreenSettings,
  validateScreenSettingsPatch,
} from "@/convex/lib/screen_settings";
import { VU_STYLES } from "@/convex/lib/vu_styles";
it("uses silent, finite, bounded levels without invented motion", () => {
  expect(levelToPosition(0)).toBe(0);
  expect(levelToPosition(Number.NaN)).toBe(0);
  expect(levelToPosition(1)).toBe(1);
  expect(levelToPosition(0.001)).toBe(0);
  expect(levelToPosition(0.1)).toBeCloseTo(2 / 3);
  expect(levelToPosition(100)).toBe(1);
});
it("accepts every reference skin while preserving older saved styles", () => {
  for (const visualizerStyle of VU_STYLES) {
    expect(() =>
      validateScreenSettingsPatch({ visualizerStyle }),
    ).not.toThrow();
    expect(normalizeScreenSettings({ visualizerStyle }).visualizerStyle).toBe(
      visualizerStyle,
    );
  }
  expect(() =>
    validateScreenSettingsPatch({ visualizerStyle: "fake" }),
  ).toThrow();
});

it("keeps both drawing axes equal for every analogue skin in both orientations", () => {
  const scales: number[][] = [];
  const gradient = { addColorStop: () => {} };
  const context = new Proxy(
    {
      scale: (x: number, y: number) => scales.push([x, y]),
      createLinearGradient: () => gradient,
      createRadialGradient: () => gradient,
    },
    {
      get: (target, key) =>
        key in target ? target[key as keyof typeof target] : () => {},
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  for (const [width, height] of [
    [1280, 600],
    [390, 844],
  ])
    for (const style of VU_STYLES.filter((s) => s.startsWith("analog-")))
      drawReferenceMeter(
        context,
        width,
        height,
        style,
        { level: 0.1, peak: 0.2 },
        1,
        "#fff",
        [],
        [],
      );
  expect(scales.length).toBeGreaterThan(0);
  expect(scales.every(([x, y]) => x === y && Number.isFinite(x) && x > 0)).toBe(
    true,
  );
});

it("uses the same needle response at 30 and 60 frames per second", () => {
  const gradient = { addColorStop: () => {} };
  const context = new Proxy(
    {
      createLinearGradient: () => gradient,
      createRadialGradient: () => gradient,
    },
    {
      get: (t, k) => (k in t ? t[k as keyof typeof t] : () => {}),
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  const fast: number[] = [],
    slow: number[] = [];
  for (let i = 0; i < 60; i++)
    drawReferenceMeter(
      context,
      800,
      400,
      "dual-led",
      { level: 0.1, peak: 0.2 },
      1,
      "#fff",
      [],
      fast,
      1000 / 60,
    );
  for (let i = 0; i < 30; i++)
    drawReferenceMeter(
      context,
      800,
      400,
      "dual-led",
      { level: 0.1, peak: 0.2 },
      1,
      "#fff",
      [],
      slow,
      1000 / 30,
    );
  expect(fast[0]).toBeCloseTo(slow[0], 8);
  expect(fast[1]).toBeCloseTo(slow[1], 8);
});
