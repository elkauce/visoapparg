import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export type TimbreNativeCapabilities = {
  available: boolean;
  notificationsEnabled: boolean;
  backgroundMedia: false;
};

export interface TimbreNativePlugin {
  getCapabilities(): Promise<TimbreNativeCapabilities>;
  requestNotifications(): Promise<{ granted: boolean }>;
  getPushToken(): Promise<{ token: string }>;
  configure(options: { ownerId?: string; enabled: boolean }): Promise<void>;
  getPendingCall(): Promise<{ callId: string | null }>;
  clearPendingCall(): Promise<void>;
  addListener(
    eventName: "timbreNotificationTapped",
    listener: (event: { callId: string }) => void,
  ): Promise<PluginListenerHandle>;
}

// Call only on Android after an explicit opt-in and an authenticated registration.
// Unconfigured APKs report available:false; web/iOS do not emulate background push.
export const timbreNative = registerPlugin<TimbreNativePlugin>("VisoTimbre");
