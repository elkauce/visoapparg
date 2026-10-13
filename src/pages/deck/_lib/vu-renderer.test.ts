import { it, expect } from "vitest";
import { levelToPosition } from "./vu-renderer";
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
