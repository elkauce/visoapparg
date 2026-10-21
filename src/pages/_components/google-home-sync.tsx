import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import { App as CapacitorApp } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import { isAndroidNative } from "@/lib/android-native.ts";
import {
  GOOGLE_HOME_CONFIGURATION_EVENT,
  googleHomeNative,
} from "@/lib/google-home-native.ts";
import {
  PRESENCE_SETTINGS_EVENT,
  readPresencePreferences,
} from "@/lib/presence-native";
import {
  googleHomeStateForStatusName,
  GoogleHomeSyncController,
} from "@/lib/google-home-sync-controller.ts";

/** Observes the existing shared state throughout Android, including remote changes. */
export default function GoogleHomeSync() {
  const { pathname } = useLocation();
  const android = isAndroidNative();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const authenticated = android && isAuthenticated && !isLoading;
  const user = useQuery(api.users.getCurrentUser, authenticated ? {} : "skip");
  const data = useQuery(api.statuses.list, authenticated ? {} : "skip");
  const accountId = authenticated ? (user?._id ?? null) : null;
  const activeStatus =
    data?.statuses.find(
      (status) =>
        status._id === data.activeStatusId && status.userId === accountId,
    ) ?? null;
  const stateKey = googleHomeStateForStatusName(activeStatus?.name ?? null);
  const baseRevision = activeStatus
    ? `${activeStatus._id}:${stateKey ?? `custom:${activeStatus.color}`}`
    : "none";
  const stateRevision =
    baseRevision +
    (typeof data?.activeStatusRevision === "number"
      ? `:${data.activeStatusRevision}`
      : "");
  const [controller] = useState(
    () =>
      new GoogleHomeSyncController(googleHomeNative, (message) => {
        toast.error(message, { id: "viso-google-home-sync" });
      }),
  );

  useEffect(() => {
    if (!android) return;
    controller.setAccount(accountId);
    return () => controller.setAccount(null);
  }, [accountId, android, controller]);

  useEffect(() => {
    if (!android || !accountId) return;
    const update = () => {
      const preferences = readPresencePreferences(accountId);
      controller.setBackgroundEnabled(
        pathname === "/deck" &&
          (preferences.calls || preferences.calendarIds.length > 0),
      );
    };
    const changed = (event: Event) => {
      if ((event as CustomEvent).detail === accountId) update();
    };
    update();
    window.addEventListener(PRESENCE_SETTINGS_EVENT, changed);
    return () => {
      window.removeEventListener(PRESENCE_SETTINGS_EVENT, changed);
      controller.setBackgroundEnabled(false);
    };
  }, [android, accountId, controller, pathname]);

  useEffect(() => {
    if (!android || !accountId || data === undefined) return;
    controller.updateState(
      stateKey,
      stateRevision,
      !stateKey ? activeStatus?.color : undefined,
    );
  }, [
    accountId,
    android,
    controller,
    data,
    stateKey,
    stateRevision,
    activeStatus?.color,
  ]);

  useEffect(() => {
    if (!android) return;
    let alive = true;
    let foreground = false;
    let stateEvents = 0;
    const appListeners: PluginListenerHandle[] = [];
    const visibility = (reconcile = false) =>
      controller.setForeground(foreground && !document.hidden, reconcile);
    const visibilityChanged = () => visibility();
    const networkRestored = () => {
      if (alive) controller.reconnect();
    };
    visibility();
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("online", networkRestored);
    const configurationChanged = (event: Event) => {
      const detail: unknown = (event as CustomEvent<unknown>).detail;
      if (
        detail &&
        typeof detail === "object" &&
        "accountId" in detail &&
        typeof detail.accountId === "string"
      ) {
        void controller.refreshConfiguration(detail.accountId);
      }
    };
    window.addEventListener(
      GOOGLE_HOME_CONFIGURATION_EVENT,
      configurationChanged,
    );
    const listen = (promise: Promise<PluginListenerHandle>) => {
      void promise
        .then((handle) => {
          if (alive) appListeners.push(handle);
          else void handle.remove();
        })
        .catch(() => undefined);
    };
    const appState = (isActive: boolean) => {
      if (!alive) return;
      stateEvents += 1;
      foreground = isActive;
      visibility(isActive);
    };
    listen(
      CapacitorApp.addListener("appStateChange", ({ isActive }) =>
        appState(isActive),
      ),
    );
    // Pause/resume also cover phone/Google overlays which never stop the activity.
    listen(CapacitorApp.addListener("pause", () => appState(false)));
    listen(CapacitorApp.addListener("resume", () => appState(true)));
    void CapacitorApp.getState()
      .then(({ isActive }) => {
        if (!alive || stateEvents > 0) return;
        foreground = isActive;
        visibility();
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("online", networkRestored);
      window.removeEventListener(
        GOOGLE_HOME_CONFIGURATION_EVENT,
        configurationChanged,
      );
      appListeners.forEach((handle) => void handle.remove());
    };
  }, [android, controller]);

  return null;
}
