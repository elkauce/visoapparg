import { beforeEach, describe, expect, it } from "vitest";
import {
  clockParts,
  DEFAULT_STANDBY_SETTINGS,
  loadStandbySettings,
  normalizeStandbySettings,
  saveStandbySettings,
  standbySettingsKey,
} from "./standby-settings.ts";
import {
  MAX_PHOTO_BYTES,
  validateStandbyPhoto,
  validateStandbyPhotoBatch,
} from "./standby-photos.ts";

describe("Private Standby preferences", () => {
  beforeEach(() => localStorage.clear());

  it("keeps settings isolated by signed-in account", () => {
    saveStandbySettings("account/one", {
      ...DEFAULT_STANDBY_SETTINGS,
      style: "duo",
      accent: "#123abc",
      hour12: true,
    });
    expect(loadStandbySettings("account/one")).toMatchObject({
      style: "duo",
      accent: "#123abc",
      hour12: true,
    });
    expect(loadStandbySettings("account/two")).toEqual(
      DEFAULT_STANDBY_SETTINGS,
    );
    expect(standbySettingsKey("a:b")).not.toBe(standbySettingsKey("a%3Ab"));
  });

  it("discards unsafe CSS and invalid settings while retaining valid preferences", () => {
    expect(
      normalizeStandbySettings({
        style: "widgets",
        accent: "url(https://evil.invalid)",
        background: "#abcdef",
        photoInterval: "10",
        hour12: "true",
        photoFit: "contain",
        clockFont: "serif",
        showMusic: false,
        photoUrl: "https://evil.invalid",
      }),
    ).toEqual({
      ...DEFAULT_STANDBY_SETTINGS,
      style: "widgets",
      background: "#abcdef",
      clockFont: "serif",
      showMusic: false,
    });
  });

  it("recovers safely from corrupted or old local settings", () => {
    localStorage.setItem(standbySettingsKey("account"), "{broken");
    expect(loadStandbySettings("account")).toEqual(DEFAULT_STANDBY_SETTINGS);
    expect(normalizeStandbySettings(null)).toEqual(DEFAULT_STANDBY_SETTINGS);
    expect(normalizeStandbySettings({ style: "old-layout" })).toEqual(
      DEFAULT_STANDBY_SETTINGS,
    );
  });

  it.each([
    [0, false, "00", ""],
    [0, true, "12", "AM"],
    [12, true, "12", "PM"],
    [23, true, "11", "PM"],
  ])(
    "shows actual local time at hour %s in 12-hour=%s",
    (hour, hour12, expected, period) => {
      expect(clockParts(new Date(2026, 9, 9, hour, 7, 3), hour12)).toEqual({
        hours: expected,
        minutes: "07",
        seconds: "03",
        period,
      });
    },
  );
});

describe("Standby photo limits", () => {
  it("rejects remote/active formats, empty files and oversized photographs", () => {
    expect(
      validateStandbyPhoto({ type: "image/svg+xml", size: 100 }),
    ).toContain("JPG");
    expect(validateStandbyPhoto({ type: "image/png", size: 0 })).toContain(
      "vacía",
    );
    expect(
      validateStandbyPhoto({ type: "image/jpeg", size: MAX_PHOTO_BYTES + 1 }),
    ).toContain("8 MB");
    expect(
      validateStandbyPhoto({ type: "image/webp", size: MAX_PHOTO_BYTES }),
    ).toBeNull();
  });

  it("applies account photo-count and total-byte quotas before storing a batch", () => {
    const photo = new Blob([new Uint8Array(8 * 1024 * 1024)], {
      type: "image/jpeg",
    });
    expect(
      validateStandbyPhotoBatch(
        Array.from({ length: 8 }, () => ({
          blob: new Blob(["photo"], { type: "image/png" }),
        })),
        [photo],
      ),
    ).toContain("8 fotografías");
    expect(
      validateStandbyPhotoBatch([{ blob: photo }, { blob: photo }], [photo]),
    ).toBeNull();
    expect(
      validateStandbyPhotoBatch(
        [{ blob: photo }, { blob: photo }],
        [photo, photo],
      ),
    ).toContain("24 MB");
  });
});
