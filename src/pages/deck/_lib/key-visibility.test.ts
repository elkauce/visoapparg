import { describe, expect, it } from "vitest";
import { decodeKeyVisibility, encodeKeyVisibility } from "./key-visibility.ts";

describe("backwards-compatible per-key visibility", () => {
  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])(
    "round-trips label=%s and icon=%s without changing the icon",
    (showLabel, showIcon) => {
      const encoded = encodeKeyVisibility("check-circle", showLabel, showIcon);
      expect(decodeKeyVisibility(encoded)).toEqual({
        icon: "check-circle",
        showLabel,
        showIcon,
      });
      expect(encoded.length).toBeLessThanOrEqual(60);
      if (showLabel && showIcon) expect(encoded).toBe("check-circle");
    },
  );

  it.each([
    undefined,
    "power",
    "custom-legacy-icon",
    "viso2:power:00",
    "viso1:power:02",
    "viso1:power:0",
    "viso1:power:000",
    "viso1::00",
    "viso1:../power:00",
    `viso1:${"a".repeat(52)}:00`,
  ])("keeps legacy, unknown or malformed value %s visible", (icon) =>
    expect(decodeKeyVisibility(icon)).toEqual({
      icon,
      showLabel: true,
      showIcon: true,
    }),
  );

  it("fits the existing 60-character validator and rejects oversized metadata", () => {
    expect(encodeKeyVisibility("a".repeat(51), false, false)).toHaveLength(60);
    expect(encodeKeyVisibility("a".repeat(60), true, true)).toHaveLength(60);
    expect(() => encodeKeyVisibility("a".repeat(52), false, true)).toThrow();
    expect(() => encodeKeyVisibility("a".repeat(61), true, true)).toThrow();
    expect(() => encodeKeyVisibility("custom:icon", false, false)).toThrow();
  });
});
