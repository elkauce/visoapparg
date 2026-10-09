import { VISO_STATES, type VisoStateDefinition } from "./viso-states.ts";

export type GoogleHomeColors = Record<VisoStateDefinition["key"], string>;

export function readGoogleHomeColors(userId: string): GoogleHomeColors {
  const defaults = Object.fromEntries(VISO_STATES.map((state) => [state.key, state.defaultColor])) as GoogleHomeColors;
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(`viso-google-home-colors:${userId}`) ?? "null");
    if (saved && typeof saved === "object") {
      for (const state of VISO_STATES) {
        const value = (saved as Record<string, unknown>)[state.key];
        if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) defaults[state.key] = value;
      }
    }
  } catch { /* Invalid or inaccessible storage keeps the existing defaults. */ }
  return defaults;
}

export function saveGoogleHomeColors(userId: string, colors: GoogleHomeColors): void {
  const clean = Object.fromEntries(VISO_STATES.map((state) => {
    const color = colors[state.key];
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error("El color debe usar el formato #RRGGBB.");
    return [state.key, color];
  }));
  localStorage.setItem(`viso-google-home-colors:${userId}`, JSON.stringify(clean));
}
