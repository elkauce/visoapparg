import BackgroundPresence from "./background-presence";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  useConvex,
  useConvexAuth,
  useQuery,
  useConvexConnectionState,
} from "convex/react";
import { App } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { isAndroidNative, nativeDeck } from "@/lib/android-native";
import type { PresenceMode } from "@/lib/presence-controller";
import {
  PRESENCE_SETTINGS_EVENT,
  presenceNative,
  readPresencePreferences,
} from "@/lib/presence-native";

export default function AutomaticPresence() {
  const { pathname } = useLocation();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const enabled = isAndroidNative() && isAuthenticated && !isLoading;
  const user = useQuery(api.users.getCurrentUser, enabled ? {} : "skip");
  return enabled && user ? (
    <>
      <BackgroundPresence key={`background:${user._id}`} accountId={user._id} />
      <Worker key={user._id} accountId={user._id} deck={pathname === "/deck"} />
    </>
  ) : null;
}
function Worker({
  accountId,
  deck,
}: {
  accountId: Id<"users">;
  deck: boolean;
}) {
  const data = useQuery(api.statuses.list, {});
  const convex = useConvex();
  const connection = useConvexConnectionState();
  const refreshRef = useRef<() => void>(() => undefined);
  const connected = useRef(connection.isWebSocketConnected);
  useEffect(() => {
    connected.current = connection.isWebSocketConnected;
    refreshRef.current();
  }, [connection.isWebSocketConnected]);
  const current = useRef(data);
  const active = useRef(deck);
  useEffect(() => {
    current.current = data;
    active.current = deck;
    refreshRef.current();
  }, [data, deck]);
  useEffect(() => {
    let alive = true;
    let reading = false;
    let again = false;
    let lastMode: PresenceMode | undefined;
    let lastSentAt = 0;
    const handles: PluginListenerHandle[] = [];
    const device = nativeDeck.getDeviceId();
    // The server now owns one shared baseline for telephone, calendar and Timbre.
    // A local recovery stack would mistake another automatic source for a manual
    // change and could restore a stale call after an overlapping episode ends.
    localStorage.removeItem(`viso:presence-recovery:${accountId}`);
    const feed = async (mode: PresenceMode) => {
      if (!alive || !connected.current) return;
      if (
        lastMode === mode &&
        (mode === null || Date.now() - lastSentAt < 30_000)
      )
        return;
      const deviceId = await device;
      if (!alive || !connected.current) return;
      await convex.mutation(api.deck_actions.activateAutomaticStatus, {
        accountId,
        statusId: null,
        expectedRevision: current.current?.activeStatusRevision ?? 0,
        requestId: crypto.randomUUID(),
        deviceId,
        presenceMode: mode,
      });
      lastMode = mode;
      lastSentAt = Date.now();
    };
    const refresh = async () => {
      if (!alive) return;
      if (reading) {
        again = true;
        return;
      }
      if (!current.current) return;
      reading = true;
      try {
        const preferences = readPresencePreferences(accountId);
        if (
          !active.current ||
          (!preferences.calls && preferences.calendarIds.length === 0)
        ) {
          await feed(null);
          return;
        }
        const signals = await presenceNative.getSignals(preferences);
        if (!alive) return;
        if (!active.current) {
          await feed(null);
          return;
        }
        if (
          JSON.stringify(preferences) !==
          JSON.stringify(readPresencePreferences(accountId))
        ) {
          again = true;
          return;
        }
        // The native service is the single writer for calls when background mode is on.
        await feed(
          signals.calling && preferences.backgroundCalls
            ? null
            : signals.calling
              ? "call"
              : signals.meeting
                ? "meeting"
                : null,
        );
      } catch (error) {
        if (alive)
          toast.error(
            error instanceof Error
              ? error.message
              : "No se pudo verificar la agenda o la llamada.",
            { id: "viso-auto-presence" },
          );
      } finally {
        reading = false;
        if (again) {
          again = false;
          void refresh();
        }
      }
    };
    const changed = () => {
      const prefs = readPresencePreferences(accountId);
      if (active.current && prefs.calls)
        void presenceNative.startPhoneObservation().catch(() => undefined);
      else void presenceNative.stopPhoneObservation().catch(() => undefined);
      void refresh();
    };
    refreshRef.current = changed;
    const settings = (event: Event) => {
      if ((event as CustomEvent).detail === accountId) changed();
    };
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    window.addEventListener(PRESENCE_SETTINGS_EVENT, settings);
    document.addEventListener("visibilitychange", visible);
    void presenceNative
      .addListener("signalsChanged", () => {
        if (readPresencePreferences(accountId).calls) void refresh();
      })
      .then((handle) => {
        if (alive) handles.push(handle);
        else void handle.remove();
      })
      .catch(() => undefined);
    void App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void refresh();
    })
      .then((handle) => {
        if (alive) handles.push(handle);
        else void handle.remove();
      })
      .catch(() => undefined);
    const interval = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 15_000);
    changed();
    return () => {
      alive = false;
      // Best effort only: account switches are checked by the mutation and a
      // short lease cleans up if the app/process disappeared before this call.
      if (lastMode !== null && lastMode !== undefined && connected.current) {
        void device
          .then((deviceId) =>
            convex.mutation(api.deck_actions.activateAutomaticStatus, {
              accountId,
              statusId: null,
              expectedRevision: current.current?.activeStatusRevision ?? 0,
              requestId: crypto.randomUUID(),
              deviceId,
              presenceMode: null,
            }),
          )
          .catch(() => undefined);
      }
      refreshRef.current = () => undefined;
      window.clearInterval(interval);
      handles.forEach((handle) => void handle.remove());
      window.removeEventListener(PRESENCE_SETTINGS_EVENT, settings);
      document.removeEventListener("visibilitychange", visible);
      void presenceNative.stopPhoneObservation().catch(() => undefined);
    };
  }, [accountId, convex]);
  return null;
}
