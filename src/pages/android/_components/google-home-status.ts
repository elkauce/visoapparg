import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import { isAndroidNative } from "@/lib/android-native.ts";
import {
  GOOGLE_HOME_CONFIGURATION_EVENT,
  googleHomeNative,
  type GoogleHomeStatus,
} from "@/lib/google-home-native.ts";

interface Snapshot {
  accountId: string;
  status: GoogleHomeStatus | null;
  loading: boolean;
}

/** Permission reads never clear the user's saved device selection. */
export function useGoogleHomeStatus(accountId: string | null | undefined) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const generation = useRef(0);
  const active = useRef(false);
  const inFlight = useRef<{
    accountId: string;
    request: number;
    promise: Promise<void>;
  } | null>(null);

  const refresh = useCallback((): Promise<void> => {
    if (!accountId || !active.current) return Promise.resolve();
    const existing = inFlight.current;
    if (
      existing?.accountId === accountId &&
      existing.request === generation.current
    )
      return existing.promise;
    const request = ++generation.current;
    const promise = Promise.resolve().then(async () => {
      if (!active.current || generation.current !== request) return;
      setSnapshot({ accountId, status: null, loading: true });
      let status: GoogleHomeStatus | null = null;
      try {
        status = await googleHomeNative.getStatus({ accountId });
      } catch {
        // A failed read is not evidence that Google revoked permission.
      }
      if (active.current && generation.current === request)
        setSnapshot({ accountId, status, loading: false });
      if (inFlight.current?.request === request) inFlight.current = null;
    });
    inFlight.current = { accountId, request, promise };
    return promise;
  }, [accountId]);

  useEffect(() => {
    let disposed = false;
    active.current = true;
    void refresh();
    const resume = () => {
      if (!document.hidden) void refresh();
    };
    const configurationChanged = (event: Event) => {
      if (
        (event as CustomEvent<{ accountId?: string }>).detail?.accountId ===
        accountId
      )
        void refresh();
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    window.addEventListener(
      GOOGLE_HOME_CONFIGURATION_EVENT,
      configurationChanged,
    );
    let listener: PluginListenerHandle | undefined;
    if (accountId && isAndroidNative()) {
      void App.addListener("appStateChange", ({ isActive }) => {
        if (isActive && !disposed && active.current) void refresh();
      })
        .then((handle) => {
          if (!disposed) listener = handle;
          else void handle.remove();
        })
        .catch(() => undefined);
    }
    return () => {
      disposed = true;
      active.current = false;
      generation.current += 1;
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener(
        GOOGLE_HOME_CONFIGURATION_EVENT,
        configurationChanged,
      );
      void listener?.remove();
    };
  }, [accountId, refresh]);

  const current = snapshot?.accountId === accountId ? snapshot : null;
  const loading =
    accountId === undefined || (!!accountId && (!current || current.loading));
  const status = current?.status ?? null;
  const label = loading
    ? "Comprobando…"
    : !accountId
      ? "Iniciá sesión en VISO"
      : !status
        ? "Conexión por comprobar"
        : !status.available
          ? isAndroidNative()
            ? "No disponible en este dispositivo"
            : "Requiere Android"
          : status.authorized
            ? status.configured
              ? `Activa · ${status.selectedCount} ${status.selectedCount === 1 ? "luz" : "luces"}`
              : "Autorizado · elegí tus luces"
            : status.verificationPending
              ? "Conexión por comprobar"
              : "Autorización pendiente";
  return { label, loading, refresh };
}
