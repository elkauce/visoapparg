import { useCallback, useEffect, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import {
  actions,
  isAndroidNative,
  nativeDeck,
  type AndroidMediaState,
  type MediaCommand,
} from "@/lib/android-native.ts";

export interface AndroidMediaHookResult {
  media: AndroidMediaState | null;
  loading: boolean;
  error: string | null;
  pending: boolean;
  refresh(): Promise<void>;
  command(command: MediaCommand): Promise<void>;
  requestAccess(): Promise<void>;
}

interface MediaSnapshot {
  source: string;
  media: AndroidMediaState | null;
  loading: boolean;
  error: string | null;
}

const failureMessage = (failure: unknown, fallback: string): string =>
  failure instanceof Error ? failure.message : fallback;

/** Reads device-local media only while its screen and Android app are visible. */
export function useAndroidMedia(
  active: boolean,
  packageName?: string,
): AndroidMediaHookResult {
  const android = isAndroidNative();
  const source = packageName ?? "*";
  const [snapshot, setSnapshot] = useState<MediaSnapshot>(() => ({
    source,
    media: null,
    loading: android && active,
    error: null,
  }));
  const [pending, setPending] = useState(false);
  const mounted = useRef(false);
  const foreground = useRef(true);
  const generation = useRef(0);
  const sequence = useRef(0);
  const inFlight = useRef<number | null>(null);
  const operating = useRef(false);

  const refresh = useCallback(async (): Promise<void> => {
    if (
      !android ||
      !active ||
      !mounted.current ||
      !foreground.current ||
      document.hidden ||
      inFlight.current !== null
    )
      return;
    const currentGeneration = generation.current;
    const id = ++sequence.current;
    inFlight.current = id;
    const current = () =>
      mounted.current &&
      generation.current === currentGeneration &&
      sequence.current === id;
    // Effect-triggered reads update state after an asynchronous boundary.
    await Promise.resolve();
    if (!current() || document.hidden || !foreground.current) return;
    setSnapshot((previous) => ({
      source,
      media: previous.source === source ? previous.media : null,
      loading: previous.source !== source || previous.media === null,
      error: previous.source === source ? previous.error : null,
    }));
    try {
      const media = await nativeDeck.getMediaState(
        packageName ? { packageName } : undefined,
      );
      if (current() && !document.hidden && foreground.current) {
        setSnapshot({ source, media, loading: false, error: null });
      }
    } catch (failure) {
      if (current() && !document.hidden && foreground.current) {
        // A stale successful snapshot does not prove permission or session availability.
        setSnapshot({
          source,
          media: null,
          loading: false,
          error: failureMessage(
            failure,
            "No se pudo consultar la reproducción de Android.",
          ),
        });
      }
    } finally {
      if (inFlight.current === id) inFlight.current = null;
    }
  }, [active, android, packageName, source]);

  useEffect(() => {
    mounted.current = true;
    foreground.current = true;
    generation.current += 1;
    operating.current = false;
    inFlight.current = null;
    const currentGeneration = generation.current;
    void Promise.resolve().then(() => {
      if (mounted.current && generation.current === currentGeneration)
        setPending(false);
    });
    let interval: number | undefined;
    const stop = () => {
      if (interval !== undefined) window.clearInterval(interval);
      interval = undefined;
    };
    const resume = () => {
      stop();
      if (!android || !active || !mounted.current) return;
      if (document.hidden || !foreground.current) {
        sequence.current += 1;
        inFlight.current = null;
        return;
      }
      void refresh();
      interval = window.setInterval(() => void refresh(), 1000);
    };
    resume();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    let appListener: PluginListenerHandle | undefined;
    if (android && active) {
      void CapacitorApp.addListener("appStateChange", ({ isActive }) => {
        if (!mounted.current || generation.current !== currentGeneration)
          return;
        foreground.current = isActive;
        resume();
      })
        .then((handle) => {
          if (mounted.current && generation.current === currentGeneration)
            appListener = handle;
          else void handle.remove();
        })
        .catch(() => undefined);
    }
    return () => {
      mounted.current = false;
      generation.current += 1;
      sequence.current += 1;
      inFlight.current = null;
      stop();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      void appListener?.remove();
    };
  }, [active, android, refresh]);

  const perform = useCallback(
    async (operation: () => Promise<void>): Promise<void> => {
      if (!android || !active || !mounted.current || operating.current) return;
      const currentGeneration = generation.current;
      operating.current = true;
      setPending(true);
      let operationError: string | null = null;
      try {
        await operation();
      } catch (failure) {
        operationError = failureMessage(
          failure,
          "Android no pudo completar el control multimedia.",
        );
      } finally {
        if (mounted.current && generation.current === currentGeneration) {
          operating.current = false;
          setPending(false);
          // Invalidate a read started before the command rather than accepting its old state.
          sequence.current += 1;
          inFlight.current = null;
          await refresh();
          if (
            operationError &&
            mounted.current &&
            generation.current === currentGeneration
          ) {
            setSnapshot((previous) => ({ ...previous, error: operationError }));
          }
        }
      }
    },
    [active, android, refresh],
  );

  const command = useCallback(
    async (command: MediaCommand): Promise<void> => {
      const media = snapshot.source === source ? snapshot.media : null;
      await perform(async () => {
        if (
          !media?.available ||
          !media.permissionGranted ||
          !media.packageName ||
          (packageName && media.packageName !== packageName)
        ) {
          throw new Error(
            "No hay una sesión de reproducción disponible. Abrí Spotify y volvé a intentarlo.",
          );
        }
        const supported =
          command === "next"
            ? media.canNext
            : command === "previous"
              ? media.canPrevious
              : command === "play-pause"
                ? media.canPlayPause
                : true;
        if (!supported)
          throw new Error("La sesión de reproducción no permite este control.");
        await actions.media(command, media.packageName);
      });
    },
    [packageName, perform, snapshot.media, snapshot.source, source],
  );

  const requestAccess = useCallback(
    (): Promise<void> => perform(() => nativeDeck.requestMediaAccess()),
    [perform],
  );

  return {
    media: android && snapshot.source === source ? snapshot.media : null,
    loading:
      android && active && (snapshot.source !== source || snapshot.loading),
    error: android && snapshot.source === source ? snapshot.error : null,
    pending,
    refresh,
    command,
    requestAccess,
  };
}
