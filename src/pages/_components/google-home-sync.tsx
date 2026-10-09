import { useEffect, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { App as CapacitorApp } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import { isAndroidNative } from "@/lib/android-native.ts";
import { GOOGLE_HOME_CONFIGURATION_EVENT, googleHomeNative } from "@/lib/google-home-native.ts";
import { googleHomeStateForStatusName, GoogleHomeSyncController } from "@/lib/google-home-sync-controller.ts";

/** Observes the existing shared state throughout Android, including remote changes. */
export default function GoogleHomeSync() {
  const android = isAndroidNative();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const authenticated = android && isAuthenticated && !isLoading;
  const user = useQuery(api.users.getCurrentUser, authenticated ? {} : "skip");
  const data = useQuery(api.statuses.list, authenticated ? {} : "skip");
  const accountId = authenticated ? user?._id ?? null : null;
  const activeStatus = data?.statuses.find((status) => status._id === data.activeStatusId && status.userId === accountId) ?? null;
  const stateKey = googleHomeStateForStatusName(activeStatus?.name ?? null);
  const stateRevision = activeStatus ? `${activeStatus._id}:${stateKey ?? "custom"}` : "none";
  const [controller] = useState(() => new GoogleHomeSyncController(googleHomeNative, (message) => {
    toast.error(message, { id: "viso-google-home-sync" });
  }));

  useEffect(() => {
    if (!android) return;
    controller.setAccount(accountId);
    return () => controller.setAccount(null);
  }, [accountId, android, controller]);

  useEffect(() => {
    if (!android || !accountId || data === undefined) return;
    controller.updateState(stateKey, stateRevision);
  }, [accountId, android, controller, data, stateKey, stateRevision]);

  useEffect(() => {
    if (!android) return;
    let alive = true;
    let foreground = false;
    let stateEvents = 0;
    let appListener: PluginListenerHandle | undefined;
    const visibility = () => controller.setForeground(foreground && !document.hidden);
    visibility();
    document.addEventListener("visibilitychange", visibility);
    const configurationChanged = (event: Event) => {
      const detail: unknown = (event as CustomEvent<unknown>).detail;
      if (detail && typeof detail === "object" && "accountId" in detail && typeof detail.accountId === "string") {
        void controller.refreshConfiguration(detail.accountId);
      }
    };
    window.addEventListener(GOOGLE_HOME_CONFIGURATION_EVENT, configurationChanged);
    void CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (!alive) return;
      stateEvents += 1;
      foreground = isActive;
      visibility();
    }).then((handle) => {
      if (alive) appListener = handle;
      else void handle.remove();
    }).catch(() => undefined);
    void CapacitorApp.getState().then(({ isActive }) => {
      if (!alive || stateEvents > 0) return;
      foreground = isActive;
      visibility();
    }).catch(() => undefined);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener(GOOGLE_HOME_CONFIGURATION_EVENT, configurationChanged);
      void appListener?.remove();
    };
  }, [android, controller]);

  return null;
}
