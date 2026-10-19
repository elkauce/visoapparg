import { useEffect } from "react";
import { useConvex } from "convex/react";
import { App } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { nativeDeck } from "@/lib/android-native";
import {
  presenceNative,
  readPresencePreferences,
  savePresencePreferences,
  PRESENCE_SETTINGS_EVENT,
} from "@/lib/presence-native";
import { toast } from "sonner";
export const BACKGROUND_STATUS_EVENT = "viso:background-status";
export default function BackgroundPresence({
  accountId,
}: {
  accountId: Id<"users">;
}) {
  const convex = useConvex();
  useEffect(() => {
    let alive = true,
      running = false,
      busy = false,
      again = false;
    let handle: PluginListenerHandle | undefined;
    const notify = (message: string) =>
      window.dispatchEvent(
        new CustomEvent(BACKGROUND_STATUS_EVENT, {
          detail: { accountId, message },
        }),
      );
    const refresh = async () => {
      if (!alive) return;
      if (busy) {
        again = true;
        return;
      }
      busy = true;
      try {
        const status = await presenceNative.getBackgroundStatus({ accountId });
        if (!alive) return;
        if (status.accountId && status.accountId !== accountId)
          await presenceNative.stopBackground({ accountId: status.accountId });
        const prefs = readPresencePreferences(accountId);
        if (!prefs.calls || !prefs.backgroundCalls) {
          await presenceNative.stopBackground({ accountId });
          running = false;
          notify("Desactivado");
          return;
        }
        const active = await App.getState();
        if (!active.isActive) return;
        if (status.stopped) {
          savePresencePreferences(accountId, {
            ...prefs,
            backgroundCalls: false,
          });
          running = false;
          notify("Desactivado desde la notificación");
          return;
        }
        if (status.running && (status.expires ?? 0) > Date.now() + 86400000) {
          running = true;
          notify("Activo: funciona aunque cierres el Deck");
          return;
        }
        const deviceId = await nativeDeck.getDeviceId();
        const capability = await convex.mutation(
          api.background_presence.enroll,
          { deviceId },
        );
        if (!alive) return;
        if (!readPresencePreferences(accountId).backgroundCalls) {
          again = true;
          return;
        }
        if (capability.accountId !== accountId)
          throw Error("La cuenta cambió. Volvé a activar la detección.");
        await presenceNative.configureBackground(capability);
        if (!alive) {
          await presenceNative.stopBackground({ accountId });
          return;
        }
        running = true;
        notify("Activo: funciona aunque cierres el Deck");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo activar la detección en segundo plano.";
        notify(message);
        if (alive) toast.error(message, { id: "viso-background-presence" });
      } finally {
        busy = false;
        if (again) {
          again = false;
          void refresh();
        }
      }
    };
    const changed = (e: Event) => {
      if ((e as CustomEvent).detail === accountId) void refresh();
    };
    window.addEventListener(PRESENCE_SETTINGS_EVENT, changed);
    void App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void refresh();
    }).then((h) => {
      if (alive) handle = h;
      else void h.remove();
    });
    void refresh();
    return () => {
      alive = false;
      window.removeEventListener(PRESENCE_SETTINGS_EVENT, changed);
      void handle?.remove();
      if (running || busy)
        void presenceNative
          .stopBackground({ accountId })
          .catch(() => undefined);
    };
  }, [accountId, convex]);
  return null;
}
