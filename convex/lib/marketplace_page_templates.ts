import { ConvexError } from "convex/values";
import {
  DEFAULT_STANDBY_SETTINGS,
  normalizeStandbySettings,
  type StandbySettings,
} from "./clock_settings";
import {
  normalizeScreenSettings,
  validateScreenSettingsPatch,
  type ScreenSettings,
} from "./screen_settings";
import type { MarketplacePageTemplate } from "./marketplace_catalog";

export type MarketplacePageSettings = {
  screenSettings?: ScreenSettings;
  standbySettings?: StandbySettings;
};

export const MARKETPLACE_PAGE_KINDS = {
  football: "sports",
  clock: "standby",
  weather: "weather",
  spotify: "spotify",
  visualizer: "visualizer",
} as const;

/** A creator configures a native VISO page. Uploaded scripts never run. */
export function normalizeMarketplacePageSettings(
  template: MarketplacePageTemplate,
  value: unknown,
): MarketplacePageSettings | undefined {
  if (value === undefined) return undefined;
  const bad = (): never => {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "La configuración de la página no es compatible con VISO.",
    });
  };
  if (!value || typeof value !== "object" || Array.isArray(value)) bad();
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).some(
      (key) => key !== "screenSettings" && key !== "standbySettings",
    )
  )
    bad();
  const output: MarketplacePageSettings = {};
  if (input.screenSettings !== undefined) {
    if (!["weather", "football", "visualizer"].includes(template)) bad();
    const screenPatch = validateScreenSettingsPatch(input.screenSettings);
    if (
      template === "visualizer" &&
      Object.keys(screenPatch).some(
        (key) =>
          !["audioSource", "visualizerStyle", "color", "sensitivity"].includes(
            key,
          ),
      )
    )
      bad();
    output.screenSettings = normalizeScreenSettings(screenPatch);
  }
  if (input.standbySettings !== undefined) {
    if (template !== "clock") bad();
    if (
      !input.standbySettings ||
      typeof input.standbySettings !== "object" ||
      Array.isArray(input.standbySettings)
    )
      bad();
    const clockInput = input.standbySettings as Record<string, unknown>;
    if (
      Object.keys(clockInput).some(
        (key) =>
          !Object.prototype.hasOwnProperty.call(DEFAULT_STANDBY_SETTINGS, key),
      )
    )
      bad();
    output.standbySettings = normalizeStandbySettings(clockInput);
  }
  return output;
}
