import { v, ConvexError } from "convex/values";
import { isSportsLeague } from "./sports_leagues";
export const screenKind = v.union(
  v.literal("grid"),
  v.literal("spotify"),
  v.literal("standby"),
  v.literal("weather"),
  v.literal("visualizer"),
  v.literal("sports"),
);
export type ScreenSettings = {
  city: string;
  latitude: number;
  longitude: number;
  units: "celsius" | "fahrenheit";
  audioSource: "microphone" | "music";
  visualizerStyle: "bars" | "mirror" | "radial" | "wave" | "levels";
  color: string;
  sensitivity: number;
  leagues: string[];
  favorite: string;
};
export const defaultScreenSettings: ScreenSettings = {
  city: "Buenos Aires",
  latitude: -34.6037,
  longitude: -58.3816,
  units: "celsius",
  audioSource: "microphone",
  visualizerStyle: "bars",
  color: "#a3ff12",
  sensitivity: 1,
  leagues: [
    "ligaarg",
    "libertadores",
    "premier",
    "laliga",
    "champions",
    "nba",
    "f1",
  ],
  favorite: "",
};
export function normalizeScreenSettings(value: unknown): ScreenSettings {
  const s =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const number = (key: string, low: number, high: number) =>
    typeof s[key] === "number" &&
    Number.isFinite(s[key]) &&
    (s[key] as number) >= low &&
    (s[key] as number) <= high
      ? (s[key] as number)
      : defaultScreenSettings[key as "latitude" | "longitude" | "sensitivity"];
  return {
    city:
      typeof s.city === "string" && s.city.trim()
        ? s.city.trim().slice(0, 100)
        : defaultScreenSettings.city,
    latitude: number("latitude", -90, 90),
    longitude: number("longitude", -180, 180),
    units: s.units === "fahrenheit" ? "fahrenheit" : "celsius",
    audioSource: s.audioSource === "music" ? "music" : "microphone",
    visualizerStyle: ["bars", "mirror", "radial", "wave", "levels"].includes(
      String(s.visualizerStyle),
    )
      ? (s.visualizerStyle as ScreenSettings["visualizerStyle"])
      : "bars",
    color:
      typeof s.color === "string" && /^#[0-9a-f]{6}$/i.test(s.color)
        ? s.color
        : defaultScreenSettings.color,
    sensitivity: number("sensitivity", 0.25, 4),
    leagues: Array.isArray(s.leagues)
      ? [
          ...new Set(
            s.leagues.filter(
              (x): x is string => typeof x === "string" && isSportsLeague(x),
            ),
          ),
        ].slice(0, 16)
      : defaultScreenSettings.leagues,
    favorite:
      typeof s.favorite === "string" ? s.favorite.trim().slice(0, 60) : "",
  };
}
export function validateScreenSettingsPatch(
  value: unknown,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Ajustes de página inválidos",
    });
  const keys = Object.keys(defaultScreenSettings);
  if (Object.keys(value).some((key) => !keys.includes(key)))
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Ajuste de página desconocido",
    });
  const patch = value as Record<string, unknown>;
  const invalid = () => {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Valor de ajuste inválido",
    });
  };
  for (const [key, item] of Object.entries(patch)) {
    if (
      key === "city" &&
      (typeof item !== "string" || !item.trim() || item.length > 100)
    )
      invalid();
    if (key === "favorite" && (typeof item !== "string" || item.length > 60))
      invalid();
    if (["latitude", "longitude", "sensitivity"].includes(key)) {
      const [lo, hi] =
        key === "latitude"
          ? [-90, 90]
          : key === "longitude"
            ? [-180, 180]
            : [0.25, 4];
      if (
        typeof item !== "number" ||
        !Number.isFinite(item) ||
        item < lo ||
        item > hi
      )
        invalid();
    }
    if (key === "units" && !["celsius", "fahrenheit"].includes(String(item)))
      invalid();
    if (
      key === "audioSource" &&
      !["microphone", "music"].includes(String(item))
    )
      invalid();
    if (
      key === "visualizerStyle" &&
      !["bars", "mirror", "radial", "wave", "levels"].includes(String(item))
    )
      invalid();
    if (
      key === "color" &&
      (typeof item !== "string" || !/^#[0-9a-f]{6}$/i.test(item))
    )
      invalid();
    if (
      key === "leagues" &&
      (!Array.isArray(item) ||
        item.length > 16 ||
        item.some((x) => typeof x !== "string" || !isSportsLeague(x)))
    )
      invalid();
  }
  return patch;
}
