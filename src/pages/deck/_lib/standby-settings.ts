export * from "../../../../convex/lib/clock_settings";
import {
  DEFAULT_STANDBY_SETTINGS,
  normalizeStandbySettings,
  type StandbySettings,
} from "../../../../convex/lib/clock_settings";
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
