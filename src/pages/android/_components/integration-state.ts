import { useCallback, useEffect, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import {
  isAndroidNative,
  nativeDeck,
  type HomeAssistantLight,
  type IntegrationStatus,
  type NativeCapabilities,
} from "@/lib/android-native.ts";

export function integrationStatusLabel(state: IntegrationStatus): string {
  if (state.status === "connected") return "Conectado";
  if (state.status === "pending")
    return state.configured
      ? "Conexión por comprobar"
      : "Pendiente de habilitación";
  if (state.status === "unavailable") return "Requiere Android";
  return "Sin conexión";
}

export function mediaStatusLabel(state: NativeCapabilities): string {
  if (state.platform !== "android") return "Requiere Android";
  if (!state.mediaPermissionGranted) return "Permiso de reproducción pendiente";
  return state.mediaSession && state.activeMediaSessions > 0
    ? "Reproducción disponible"
    : "Sin reproducción activa";
}

async function readIntegrations(
  verifyHomeAssistant: boolean,
  discoverHomeAssistantLights: boolean,
) {
  let capabilities = await nativeDeck.getCapabilities();
  if (
    verifyHomeAssistant &&
    capabilities.platform === "android" &&
    capabilities.homeAssistant.configured
  ) {
    capabilities = {
      ...capabilities,
      homeAssistant: await nativeDeck.homeAssistantStatus(),
    };
  }
  let lights: HomeAssistantLight[] = [];
  let error: string | null = null;
  if (
    discoverHomeAssistantLights &&
    capabilities.homeAssistant.status === "connected"
  ) {
    try {
      lights = await nativeDeck.getHomeAssistantLights();
    } catch (failure) {
      error =
        failure instanceof Error
          ? failure.message
          : "No se pudieron consultar las luces. Volvé a intentarlo.";
    }
  }
  return { capabilities, lights, error };
}

export function useNativeIntegrations({
  verifyHomeAssistant = false,
  discoverHomeAssistantLights = false,
} = {}) {
  const [capabilities, setCapabilities] = useState<NativeCapabilities | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lights, setLights] = useState<HomeAssistantLight[]>([]);
  const active = useRef(false);
  const request = useRef(0);

  const load = useCallback(() => {
    const id = ++request.current;
    return readIntegrations(verifyHomeAssistant, discoverHomeAssistantLights)
      .then(
        (state) => {
          if (active.current && id === request.current) {
            setCapabilities(state.capabilities);
            setLights(state.lights);
            setError(state.error);
          }
          return state.capabilities;
        },
        (failure: unknown) => {
          if (active.current && id === request.current) {
            // A previous successful response is no longer evidence of connectivity.
            setCapabilities(null);
            setLights([]);
            setError(
              failure instanceof Error
                ? failure.message
                : "No se pudieron comprobar las integraciones. Volvé a intentarlo.",
            );
          }
          return null;
        },
      )
      .finally(() => {
        if (active.current && id === request.current) setLoading(false);
      });
  }, [verifyHomeAssistant, discoverHomeAssistantLights]);

  const refresh = useCallback(async () => {
    if (active.current) {
      setLoading(true);
      setError(null);
    }
    return load();
  }, [load]);

  useEffect(() => {
    active.current = true;
    void load();
    const resume = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    let appListener: PluginListenerHandle | undefined;
    if (isAndroidNative()) {
      void CapacitorApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive && active.current) void refresh();
      })
        .then((handle) => {
          if (active.current) appListener = handle;
          else void handle.remove();
        })
        .catch(() => undefined);
    }
    return () => {
      active.current = false;
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      void appListener?.remove();
    };
  }, [load, refresh]);

  return { capabilities, lights, loading, error, refresh };
}
