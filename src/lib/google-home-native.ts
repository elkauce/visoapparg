import { registerPlugin } from "@capacitor/core";
import { isAndroidNative } from "./android-native.ts";
import { readGoogleHomeColors, saveGoogleHomeColors, type GoogleHomeColors } from "@/pages/deck/_lib/google-home-colors.ts";
import type { VisoStateDefinition } from "@/pages/deck/_lib/viso-states.ts";

export type GoogleHomeStateKey = VisoStateDefinition["key"];
export interface GoogleHomeStatus {
  sdkPresent: boolean;
  available: boolean;
  status: "connected" | "pending" | "unavailable" | "disconnected";
  authorized: boolean;
  configured: boolean;
  selectedCount: number;
  message: string;
}
export interface GoogleHomeLight {
  id: string;
  name: string;
  online: boolean;
  colorCapable: true;
  structureId: string;
}
export interface GoogleHomeConfiguration {
  selectedIds: string[];
  colorsByState: GoogleHomeColors;
  enabled: boolean;
  revision: string;
}
export interface GoogleHomeApplyResult {
  applied: boolean;
  skipped: boolean;
  reason?: string;
  results: { id: string; success: boolean; confirmed: boolean; error?: string }[];
}
export interface GoogleHomeBridge {
  setActiveAccount(options: { accountId: string | null }): Promise<void>;
  getStatus(options: { accountId: string }): Promise<GoogleHomeStatus>;
  authorize(options: { accountId: string }): Promise<GoogleHomeStatus>;
  discoverLights(options: { accountId: string }): Promise<GoogleHomeStatus & { lights: GoogleHomeLight[] }>;
  getConfiguration(options: { accountId: string }): Promise<GoogleHomeConfiguration>;
  saveConfiguration(options: { accountId: string; selectedIds: string[]; colorsByState: GoogleHomeColors }): Promise<GoogleHomeConfiguration>;
  applyState(options: { accountId: string; stateKey: GoogleHomeStateKey | null; revision: string }): Promise<GoogleHomeApplyResult>;
  disconnect(options: { accountId: string }): Promise<void>;
}

const plugin = registerPlugin<GoogleHomeBridge>("VisoGoogleHome");
const webStatus: GoogleHomeStatus = {
  sdkPresent: false,
  available: false,
  status: "unavailable",
  authorized: false,
  configured: false,
  selectedCount: 0,
  message: "La autorización y las luces Google Home están disponibles en la APK Android. Los colores se guardan solo en este navegador.",
};

function requireAndroid(): void {
  if (!isAndroidNative()) throw new Error("Para autorizar Google Home, abrí VISO Deck en Android.");
}

/** Devices and permissions come exclusively from the official Android SDK. */
export const googleHomeNative: GoogleHomeBridge = {
  async setActiveAccount(options) {
    if (isAndroidNative()) await plugin.setActiveAccount(options);
  },
  async getStatus(options) {
    return isAndroidNative() ? plugin.getStatus(options) : { ...webStatus };
  },
  async authorize(options) {
    requireAndroid();
    return plugin.authorize(options);
  },
  async discoverLights(options) {
    if (!isAndroidNative()) return { ...webStatus, lights: [] };
    return plugin.discoverLights(options);
  },
  async getConfiguration(options) {
    if (isAndroidNative()) return plugin.getConfiguration(options);
    const colorsByState = readGoogleHomeColors(options.accountId);
    return { selectedIds: [], colorsByState, enabled: false, revision: JSON.stringify(colorsByState) };
  },
  async saveConfiguration(options) {
    if (isAndroidNative()) return plugin.saveConfiguration(options);
    if (options.selectedIds.length) throw new Error("Las luces se seleccionan desde la APK Android.");
    saveGoogleHomeColors(options.accountId, options.colorsByState);
    return { selectedIds: [], colorsByState: options.colorsByState, enabled: false, revision: JSON.stringify(options.colorsByState) };
  },
  async applyState(options) {
    requireAndroid();
    return plugin.applyState(options);
  },
  async disconnect(options) {
    requireAndroid();
    await plugin.disconnect(options);
  },
};

export const GOOGLE_HOME_CONFIGURATION_EVENT = "viso:google-home-configuration";
export function notifyGoogleHomeConfigurationChanged(accountId: string): void {
  window.dispatchEvent(new CustomEvent(GOOGLE_HOME_CONFIGURATION_EVENT, { detail: { accountId } }));
}
