export type StandbyStyle = "clock" | "duo" | "music" | "photos" | "widgets";
export type StandbyClockStyle = "digital" | "analog" | "flip";

export interface StandbySettings {
  style: StandbyStyle;
  clockStyle: StandbyClockStyle;
  accent: string;
  flipColor: string;
  background: string;
  clockFont: "mono" | "sans" | "serif";
  clockPalette: "single" | "multicolor" | "pastel";
  minuteColor: string;
  secondColor: string;
  duoContent: "music" | "photo";
  hour12: boolean;
  showSeconds: boolean;
  showDate: boolean;
  showStatus: boolean;
  showConnection: boolean;
  showMusic: boolean;
  showBattery: boolean;
  photoFit: "contain" | "cover";
  photoInterval: 10 | 20 | 30 | 60;
  photoClock: boolean;
}

export const DEFAULT_STANDBY_SETTINGS: StandbySettings = {
  style: "clock",
  clockStyle: "digital",
  accent: "#a3e635",
  flipColor: "#101010",
  background: "#101010",
  clockFont: "mono",
  clockPalette: "single",
  minuteColor: "#93c5fd",
  secondColor: "#f9a8d4",
  duoContent: "music",
  hour12: false,
  showSeconds: false,
  showDate: true,
  showStatus: true,
  showConnection: true,
  showMusic: true,
  showBattery: true,
  photoFit: "contain",
  photoInterval: 20,
  photoClock: true,
};

/** Stored preferences cannot introduce markup, remote media or arbitrary CSS. */
export function normalizeStandbySettings(value: unknown): StandbySettings {
  const result = { ...DEFAULT_STANDBY_SETTINGS };
  if (!value || typeof value !== "object" || Array.isArray(value))
    return result;
  const data = value as Record<string, unknown>;
  if (
    ["clock", "duo", "music", "photos", "widgets"].includes(String(data.style))
  ) {
    result.style = data.style as StandbyStyle;
  }
  if (["digital", "analog", "flip"].includes(String(data.clockStyle))) {
    result.clockStyle = data.clockStyle as StandbyClockStyle;
  }
  for (const key of [
    "accent",
    "flipColor",
    "background",
    "minuteColor",
    "secondColor",
  ] as const) {
    if (typeof data[key] === "string" && /^#[\da-f]{6}$/i.test(data[key]))
      result[key] = data[key];
  }
  if (["mono", "sans", "serif"].includes(String(data.clockFont)))
    result.clockFont = data.clockFont as StandbySettings["clockFont"];
  if (["single", "multicolor", "pastel"].includes(String(data.clockPalette)))
    result.clockPalette = data.clockPalette as StandbySettings["clockPalette"];
  if (data.duoContent === "music" || data.duoContent === "photo")
    result.duoContent = data.duoContent;
  for (const key of [
    "hour12",
    "showSeconds",
    "showDate",
    "showStatus",
    "showConnection",
    "showMusic",
    "showBattery",
    "photoClock",
  ] as const) {
    if (typeof data[key] === "boolean") result[key] = data[key];
  }
  if (data.photoFit === "contain" || data.photoFit === "cover")
    result.photoFit = data.photoFit;
  if (
    [10, 20, 30, 60].includes(Number(data.photoInterval)) &&
    typeof data.photoInterval === "number"
  ) {
    result.photoInterval =
      data.photoInterval as StandbySettings["photoInterval"];
  }
  return result;
}

export function standbySettingsKey(userId: string): string {
  return `viso:standby:v1:${encodeURIComponent(userId)}`;
}

export function loadStandbySettings(userId: string): StandbySettings {
  try {
    const raw = localStorage.getItem(standbySettingsKey(userId));
    return raw
      ? normalizeStandbySettings(JSON.parse(raw))
      : { ...DEFAULT_STANDBY_SETTINGS };
  } catch {
    return { ...DEFAULT_STANDBY_SETTINGS };
  }
}

export function saveStandbySettings(
  userId: string,
  settings: StandbySettings,
): void {
  localStorage.setItem(
    standbySettingsKey(userId),
    JSON.stringify(normalizeStandbySettings(settings)),
  );
}

export function clockParts(
  date: Date,
  hour12: boolean,
): {
  hours: string;
  minutes: string;
  seconds: string;
  period: string;
} {
  const hours = date.getHours();
  return {
    hours: String(hour12 ? hours % 12 || 12 : hours).padStart(2, "0"),
    minutes: String(date.getMinutes()).padStart(2, "0"),
    seconds: String(date.getSeconds()).padStart(2, "0"),
    period: hour12 ? (hours < 12 ? "AM" : "PM") : "",
  };
}
