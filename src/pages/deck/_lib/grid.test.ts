import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GRID_PREFERENCE,
  getGridPreferenceStorage,
  gridPreferenceStorageKey,
  isGridPreference,
  parseGridPreference,
  readGridPreference,
  resolveDeckGrid,
  writeGridPreference,
} from "./grid";

describe("resolveDeckGrid", () => {
  it("preserves the original 5 by 3 desktop deck and fills its available area", () => {
    const grid = resolveDeckGrid({
      slots: 15,
      preferredColumns: 5,
      viewportWidth: 1240,
      viewportHeight: 720,
    });

    expect(grid.columns).toBe(5);
    expect(grid.rows).toBe(3);
    expect(grid.gap).toBe(12);
    expect(grid.tileWidth * grid.columns + grid.gap * 4).toBe(1240);
    expect(grid.tileHeight * grid.rows + grid.gap * 2).toBe(720);
    expect(grid.overflowX).toBe(false);
    expect(grid.overflowY).toBe(false);
  });

  it.each([
    { slots: 6, columns: 3, portrait: 2 },
    { slots: 15, columns: 5, portrait: 3 },
    { slots: 32, columns: 8, portrait: 4 },
  ])("adapts the $slots-key preset in portrait and landscape", (preset) => {
    const portrait = resolveDeckGrid({
      slots: preset.slots,
      preferredColumns: preset.columns,
      viewportWidth: 480,
      viewportHeight: 900,
    });
    const landscape = resolveDeckGrid({
      slots: preset.slots,
      preferredColumns: preset.columns,
      viewportWidth: 1100,
      viewportHeight: 600,
    });

    expect(portrait.columns).toBe(preset.portrait);
    expect(landscape.columns).toBe(preset.columns);
    expect(portrait.rows * portrait.columns).toBeGreaterThanOrEqual(
      preset.slots,
    );
    expect(landscape.rows * landscape.columns).toBeGreaterThanOrEqual(
      preset.slots,
    );
  });

  it("retains explicit custom columns and includes the last partial row", () => {
    const grid = resolveDeckGrid({
      slots: 17,
      preferredColumns: 4,
      viewportWidth: 480,
      viewportHeight: 860,
    });

    expect(grid.columns).toBe(4);
    expect(grid.rows).toBe(5);
    expect(grid.columns * (grid.rows - 1)).toBeLessThan(17);
    expect(grid.columns * grid.rows).toBeGreaterThanOrEqual(17);
  });

  it("reduces columns in narrow portrait and scrolls instead of shrinking tiles", () => {
    const grid = resolveDeckGrid({
      slots: 32,
      preferredColumns: 8,
      viewportWidth: 280,
      viewportHeight: 600,
    });

    expect(grid.columns).toBe(2);
    expect(grid.rows).toBe(16);
    expect(grid.tileHeight).toBe(96);
    expect(grid.tileWidth).toBeGreaterThanOrEqual(96);
    expect(grid.minHeight).toBe(1716);
    expect(grid.overflowY).toBe(true);
    expect(grid.overflowX).toBe(false);
  });

  it("keeps landscape tiles readable when the header leaves little height", () => {
    const grid = resolveDeckGrid({
      slots: 15,
      preferredColumns: 5,
      viewportWidth: 800,
      viewportHeight: 200,
    });

    expect(grid.columns).toBe(5);
    expect(grid.tileMinHeight).toBe(96);
    expect(grid.minHeight).toBe(312);
    expect(grid.overflowY).toBe(true);
  });

  it("allows overflow for a viewport smaller than a single touch target", () => {
    const grid = resolveDeckGrid({
      slots: 1,
      preferredColumns: 1,
      viewportWidth: 70,
      viewportHeight: 80,
    });

    expect(grid.columns).toBe(1);
    expect(grid.tileWidth).toBe(96);
    expect(grid.tileHeight).toBe(96);
    expect(grid.overflowX).toBe(true);
    expect(grid.overflowY).toBe(true);
  });

  it("does not collapse the desktop arrangement before measurement", () => {
    const grid = resolveDeckGrid({
      slots: 15,
      preferredColumns: 5,
      viewportWidth: 0,
      viewportHeight: 0,
    });

    expect(grid.columns).toBe(5);
    expect(grid.rows).toBe(3);
    expect(grid.overflowX).toBe(false);
    expect(grid.overflowY).toBe(false);
  });

  it("handles all supported slot counts without omitting a remainder", () => {
    for (let slots = 1; slots <= 64; slots++) {
      for (const width of [240, 375, 1280]) {
        const grid = resolveDeckGrid({
          slots,
          preferredColumns: Math.min(slots, 7),
          viewportWidth: width,
          viewportHeight: 720,
        });
        expect(grid.columns * grid.rows).toBeGreaterThanOrEqual(slots);
        expect(grid.columns * (grid.rows - 1)).toBeLessThan(slots);
        expect(grid.tileWidth).toBeGreaterThanOrEqual(96);
        expect(grid.tileHeight).toBeGreaterThanOrEqual(96);
      }
    }
  });
});

describe("grid preferences", () => {
  it.each([
    null,
    "not JSON",
    "null",
    "[]",
    "{}",
    '{"slots":0,"columns":1}',
    '{"slots":65,"columns":8}',
    '{"slots":15,"columns":0}',
    '{"slots":15,"columns":16}',
    '{"slots":15.5,"columns":5}',
    '{"slots":"15","columns":5}',
  ])("falls back safely for missing or corrupt preferences: %s", (raw) => {
    expect(parseGridPreference(raw)).toEqual(DEFAULT_GRID_PREFERENCE);
  });

  it("accepts a valid custom arrangement without returning unrelated values", () => {
    expect(
      parseGridPreference('{"slots":17,"columns":4,"unrelated":"value"}'),
    ).toEqual({ slots: 17, columns: 4 });
    expect(isGridPreference({ slots: 64, columns: 8 })).toBe(true);
  });

  it("isolates preferences by both account and page, including separators", () => {
    expect(gridPreferenceStorageKey("account:a", "page")).not.toBe(
      gridPreferenceStorageKey("account", "a:page"),
    );
    expect(gridPreferenceStorageKey("first", "page")).not.toBe(
      gridPreferenceStorageKey("second", "page"),
    );
    expect(gridPreferenceStorageKey("account", "first")).not.toBe(
      gridPreferenceStorageKey("account", "second"),
    );
    expect(gridPreferenceStorageKey(null, "page")).toBeNull();
  });

  it("does not write defaults when storage has no preference", () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };

    expect(readGridPreference(storage, "account", "page")).toEqual(
      DEFAULT_GRID_PREFERENCE,
    );
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("round-trips only the selected layout under the account and page", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(
      writeGridPreference(storage, "account", "page", {
        slots: 17,
        columns: 4,
      }),
    ).toBe(true);
    expect(readGridPreference(storage, "account", "page")).toEqual({
      slots: 17,
      columns: 4,
    });
    expect(readGridPreference(storage, "another", "page")).toEqual(
      DEFAULT_GRID_PREFERENCE,
    );
  });

  it("continues operating when browser storage access fails", () => {
    const storage = {
      getItem: () => {
        throw new Error("Storage disabled");
      },
      setItem: () => {
        throw new Error("Quota exceeded");
      },
    };

    expect(readGridPreference(storage, "account", "page")).toEqual(
      DEFAULT_GRID_PREFERENCE,
    );
    expect(
      writeGridPreference(storage, "account", "page", {
        slots: 6,
        columns: 3,
      }),
    ).toBe(false);
    expect(readGridPreference(null, "account", "page")).toEqual(
      DEFAULT_GRID_PREFERENCE,
    );
  });

  it("handles a blocked localStorage getter", () => {
    const getter = vi
      .spyOn(window, "localStorage", "get")
      .mockImplementation(() => {
        throw new Error("SecurityError");
      });

    expect(getGridPreferenceStorage()).toBeNull();
    getter.mockRestore();
  });

  it("never writes an invalid layout or an unscoped preference", () => {
    const storage = { setItem: vi.fn() };

    expect(
      writeGridPreference(storage, "account", "page", {
        slots: 65,
        columns: 8,
      }),
    ).toBe(false);
    expect(
      writeGridPreference(storage, null, "page", { slots: 15, columns: 5 }),
    ).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
