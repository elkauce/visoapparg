import { Capacitor, registerPlugin } from "@capacitor/core";
import type { TokenStorage } from "@convex-dev/auth/react";

export type MediaCommand =
  | "play-pause"
  | "next"
  | "previous"
  | "volume-up"
  | "volume-down"
  | "mute";

export interface IntegrationStatus {
  status: "connected" | "disconnected" | "pending" | "unavailable";
  configured?: boolean;
  message: string;
}

export interface NativeCapabilities {
  platform: "android" | "web";
  immersive: boolean;
  secureStorage: boolean;
  openApps: boolean;
  mediaVolume: boolean;
  mediaSession: boolean;
  mediaPermissionGranted: boolean;
  activeMediaSessions: number;
  homeAssistant: IntegrationStatus;
  googleHome: IntegrationStatus;
}

export interface HomeAssistantLight {
  id: string;
  name: string;
  on: boolean;
  available: boolean;
  brightness?: number;
  supportsColor: boolean;
}

export interface LightControl {
  on?: boolean;
  /** Percentage from 0 to 100. */
  brightness?: number;
  /** RGB color expressed as #RRGGBB. */
  color?: string;
}

/** Launchable apps visible to Android, with icons held only in device memory. */
export interface InstalledAndroidApp {
  packageName: string;
  name: string;
  /** A bounded PNG data URI, or null when Android cannot load the icon. */
  icon: string | null;
  allowed: boolean;
}

interface VisoNativePlugin {
  enterImmersive(): Promise<void>;
  exitImmersive(): Promise<void>;
  openUrl(options: { url: string }): Promise<void>;
  openApp(options: { packageName: string }): Promise<void>;
  media(options: { command: MediaCommand }): Promise<void>;
  getToken(options: { key: string }): Promise<{ value: string | null }>;
  setToken(options: { key: string; value: string }): Promise<void>;
  removeToken(options: { key: string }): Promise<void>;
  capabilities(): Promise<NativeCapabilities>;
  getDeviceId(): Promise<{ id: string }>;
  requestMediaAccess(): Promise<void>;
  configureAllowedApps(): Promise<{ packages: string[] }>;
  getAllowedApps(): Promise<{ packages: string[] }>;
  listInstalledApps(): Promise<{ apps: InstalledAndroidApp[] }>;
  getAppIcon(options: { packageName: string }): Promise<{ icon: string | null }>;
  configureHomeAssistant(): Promise<IntegrationStatus>;
  homeAssistantStatus(): Promise<IntegrationStatus>;
  discoverLights(): Promise<{ lights: HomeAssistantLight[] }>;
  controlLight(options: LightControl & { entityId: string }): Promise<{ success: boolean }>;
  disconnectHomeAssistant(): Promise<void>;
}

const plugin = registerPlugin<VisoNativePlugin>("VisoNative");

export const isAndroidNative = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

function requireAndroid(): void {
  if (!isAndroidNative()) {
    throw new Error("Esta acción requiere VISO Deck instalado en Android.");
  }
}

export const immersive = {
  async enter(): Promise<void> {
    requireAndroid();
    await plugin.enterImmersive();
  },
  async exit(): Promise<void> {
    requireAndroid();
    await plugin.exitImmersive();
  },
};

export const actions = {
  async openUrl(url: string): Promise<void> {
    requireAndroid();
    await plugin.openUrl({ url });
  },
  async openApp(packageName: string): Promise<void> {
    requireAndroid();
    await plugin.openApp({ packageName });
  },
  async media(command: MediaCommand): Promise<void> {
    requireAndroid();
    await plugin.media({ command });
  },
};

/** Auth-only bridge. Integration credentials are never returned to JavaScript. */
export const secureTokenStorage: TokenStorage = {
  async getItem(key) {
    requireAndroid();
    return (await plugin.getToken({ key })).value;
  },
  async setItem(key, value) {
    requireAndroid();
    await plugin.setToken({ key, value });
  },
  async removeItem(key) {
    requireAndroid();
    await plugin.removeToken({ key });
  },
};

const webCapabilities: NativeCapabilities = {
  platform: "web",
  immersive: false,
  secureStorage: false,
  openApps: false,
  mediaVolume: false,
  mediaSession: false,
  mediaPermissionGranted: false,
  activeMediaSessions: 0,
  homeAssistant: { status: "unavailable", configured: false, message: "Configuración segura disponible en la APK Android." },
  googleHome: { status: "pending", message: "Pendiente: SDK oficial Home APIs y consentimiento Google en Android." },
};

async function capabilities(): Promise<NativeCapabilities> {
  return isAndroidNative() ? plugin.capabilities() : webCapabilities;
}

async function requestMediaAccess(): Promise<void> {
  requireAndroid();
  await plugin.requestMediaAccess();
}

async function configureAllowedApps(): Promise<string[]> {
  requireAndroid();
  return (await plugin.configureAllowedApps()).packages;
}

async function discoverLights(): Promise<HomeAssistantLight[]> {
  requireAndroid();
  return (await plugin.discoverLights()).lights;
}

export const nativeDeck = {
  capabilities,
  getCapabilities: capabilities,
  requestMediaAccess,
  openMediaPermissionSettings: requestMediaAccess,
  configureAllowedApps,
  manageAllowedApps: configureAllowedApps,
  async getAllowedApps(): Promise<string[]> {
    requireAndroid();
    return (await plugin.getAllowedApps()).packages;
  },
  async getInstalledApps(): Promise<InstalledAndroidApp[]> {
    requireAndroid();
    return (await plugin.listInstalledApps()).apps;
  },
  async getAppIcon(packageName: string): Promise<string | null> {
    requireAndroid();
    return (await plugin.getAppIcon({ packageName })).icon;
  },
  async getDeviceId(): Promise<string> {
    requireAndroid();
    return (await plugin.getDeviceId()).id;
  },
  async configureHomeAssistant(): Promise<IntegrationStatus> {
    requireAndroid();
    return plugin.configureHomeAssistant();
  },
  async homeAssistantStatus(): Promise<IntegrationStatus> {
    return isAndroidNative() ? plugin.homeAssistantStatus() : webCapabilities.homeAssistant;
  },
  discoverLights,
  getHomeAssistantLights: discoverLights,
  async controlLight(entityId: string, options: LightControl): Promise<{ success: boolean }> {
    requireAndroid();
    return plugin.controlLight({ ...options, entityId });
  },
  async disconnectHomeAssistant(): Promise<void> {
    requireAndroid();
    await plugin.disconnectHomeAssistant();
  },
  async googleHomeStatus(): Promise<IntegrationStatus> {
    return (await capabilities()).googleHome;
  },
};
