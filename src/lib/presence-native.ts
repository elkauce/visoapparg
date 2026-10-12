import { registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
export type PresenceCalendar = { id: string; name: string; account: string };
export type PresencePreferences = {
  calls: boolean;
  calendarIds: string[];
  allBusyEvents: boolean;
};
export const PRESENCE_SETTINGS_EVENT = "viso:presence-settings";
export const presenceNative = registerPlugin<{
  requestCalendarAccess(): Promise<{ granted: boolean }>;
  requestPhoneAccess(): Promise<{ granted: boolean }>;
  listCalendars(): Promise<{ calendars: PresenceCalendar[] }>;
  getSignals(
    options: PresencePreferences,
  ): Promise<{ calling: boolean; meeting: boolean }>;
  startPhoneObservation(): Promise<void>;
  stopPhoneObservation(): Promise<void>;
  addListener(
    name: "signalsChanged",
    listener: () => void,
  ): Promise<PluginListenerHandle>;
}>("VisoPresence");
const key = (account: string) => `viso:presence:${account}`;
export function readPresencePreferences(account: string): PresencePreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(key(account)) || "null");
    return {
      calls: saved?.calls === true,
      allBusyEvents: saved?.allBusyEvents === true,
      calendarIds: Array.isArray(saved?.calendarIds)
        ? saved.calendarIds
            .filter(
              (id: unknown) => typeof id === "string" && /^\d{1,20}$/.test(id),
            )
            .slice(0, 100)
        : [],
    };
  } catch {
    return { calls: false, calendarIds: [], allBusyEvents: false };
  }
}
export function savePresencePreferences(
  account: string,
  preferences: PresencePreferences,
) {
  localStorage.setItem(key(account), JSON.stringify(preferences));
  window.dispatchEvent(
    new CustomEvent(PRESENCE_SETTINGS_EVENT, { detail: account }),
  );
}
