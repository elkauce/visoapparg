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
import {
  PresenceController,
  type PresenceMode,
  type PresenceRecovery,
} from "@/lib/presence-controller";
import {
  PRESENCE_SETTINGS_EVENT,
  presenceNative,
  readPresencePreferences,
} from "@/lib/presence-native";
import { findVisoStatus, VISO_STATES } from "@/pages/deck/_lib/viso-states";

export default function AutomaticPresence() {
  const { pathname } = useLocation();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const enabled = isAndroidNative() && isAuthenticated && !isLoading;
  const user = useQuery(api.users.getCurrentUser, enabled ? {} : "skip");
  return enabled && user ? (
    <Worker key={user._id} accountId={user._id} deck={pathname === "/deck"} />
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
    const handles: PluginListenerHandle[] = [];
    const storageKey = `viso:presence-recovery:${accountId}`;
    let recovery: PresenceRecovery | null = null;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (
        saved &&
        (saved.previous === null || typeof saved.previous === "string") &&
        (saved.statusId === null || typeof saved.statusId === "string") &&
        Number.isSafeInteger(saved.revision) &&
        saved.revision >= 0 &&
        ["call", "meeting"].includes(saved.mode)
      )
        recovery = saved;
    } catch {
      /* No trusted recovery. */
    }
    const controller = new PresenceController(
      async (mode, previous, revision, requestId) => {
        if (!connected.current)
          throw new Error(
            "Sin conexión: la detección automática espera para no enviar señales antiguas.",
          );
        const receipt = await convex.query(
          api.deck_actions.getAutomaticReceipt,
          { accountId, requestId },
        );
        if (!alive) throw new Error("La sesión VISO cambió.");
        if (receipt) return receipt;
        const valid = () =>
          mode === lastMode && (mode === null || active.current);
        if (!valid())
          return {
            applied: false,
            statusId: previous,
            revision,
            cancelled: true,
          };
        let statusId = previous as Id<"statuses"> | null;
        if (mode) {
          const definition = VISO_STATES.find(
            (s) => s.key === (mode === "call" ? "llamada" : "reunion"),
          )!;
          const latest = await convex.query(api.statuses.list, {});
          if (!alive) throw new Error("La sesión VISO cambió.");
          statusId = latest
            ? ((findVisoStatus(definition, latest.statuses)
                ?._id as Id<"statuses">) ?? null)
            : null;
          if (!statusId)
            statusId = await convex.mutation(api.statuses.create, {
              name: definition.name,
              color: definition.defaultColor,
              icon: definition.icon,
            });
        }
        if (!alive) throw new Error("La sesión VISO cambió.");
        const deviceId = await nativeDeck.getDeviceId();
        if (!alive) throw new Error("La sesión VISO cambió.");
        if (!connected.current)
          throw new Error("Sin conexión: no se envió el cambio automático.");
        if (!valid())
          return {
            applied: false,
            statusId: previous,
            revision,
            cancelled: true,
          };
        const result = await convex.mutation(
          api.deck_actions.activateAutomaticStatus,
          {
            accountId,
            statusId,
            expectedRevision: revision,
            requestId,
            deviceId,
          },
        );
        return { ...result, statusId };
      },
      (state) => {
        if (state) localStorage.setItem(storageKey, JSON.stringify(state));
        else localStorage.removeItem(storageKey);
      },
      (error) => {
        if (alive)
          toast.error(
            error instanceof Error
              ? error.message
              : "No se pudo actualizar el estado automático.",
            { id: "viso-auto-presence" },
          );
      },
      recovery,
    );
    const feed = (mode: PresenceMode) => {
      lastMode = mode;
      const snapshot = current.current;
      if (snapshot)
        controller.update({
          statusId: snapshot.activeStatusId,
          revision: snapshot.activeStatusRevision ?? 0,
          mode,
        });
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
          feed(null);
          return;
        }
        const signals = await presenceNative.getSignals(preferences);
        if (!alive) return;
        if (!active.current) {
          feed(null);
          return;
        }
        if (
          JSON.stringify(preferences) !==
          JSON.stringify(readPresencePreferences(accountId))
        ) {
          again = true;
          return;
        }
        feed(signals.calling ? "call" : signals.meeting ? "meeting" : null);
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
      if (!active.current || (!prefs.calls && prefs.calendarIds.length === 0))
        feed(null);
      if (active.current && prefs.calls)
        void presenceNative.startPhoneObservation().catch(() => undefined);
      else void presenceNative.stopPhoneObservation().catch(() => undefined);
      void refresh();
    };
    refreshRef.current = () => {
      if (lastMode !== undefined && current.current)
        controller.update({
          statusId: current.current.activeStatusId,
          revision: current.current.activeStatusRevision ?? 0,
          mode: lastMode,
        });
      changed();
    };
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
      controller.dispose();
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
