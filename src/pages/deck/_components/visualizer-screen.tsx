import { createPortal } from "react-dom";
import { drawReferenceMeter } from "../_lib/vu-renderer";
import { useEffect, useRef, useState } from "react";
import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";
import type { ScreenSettings } from "@/convex/lib/screen_settings";
import { Button } from "@/components/ui/button";
type AudioFrame = {
  bands?: number[];
  wave?: number[];
  level?: number;
  peak?: number;
  db?: number;
  bandFrequencies?: number[];
};
const audio = registerPlugin<{
  start(options: { source: string }): Promise<void>;
  stop(): Promise<void>;
  addListener(
    event: "audioFrame" | "audioStopped",
    callback: (data: AudioFrame & { reason?: string }) => void,
  ): Promise<PluginListenerHandle>;
}>("VisoAudio");
export default function VisualizerScreen({
  settings,
  active,
  controlHost,
}: {
  settings: ScreenSettings;
  active: boolean;
  controlHost?: HTMLElement | null;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<AudioFrame>({});
  const stopRef = useRef<() => void>(() => {});
  const sequence = useRef(0);
  const starting = useRef(false);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [db, setDb] = useState(-120);
  const stop = () => {
    sequence.current++;
    stopRef.current();
    stopRef.current = () => {};
    setRunning(false);
    frame.current = {};
  };
  useEffect(() => {
    stop();
    const onVisibility = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      sequence.current++;
      stopRef.current();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, settings.audioSource]);
  const start = async () => {
    if (starting.current || !active) return;
    stop();
    const generation = sequence.current;
    starting.current = true;
    setBusy(true);
    setError("");
    const current = () => sequence.current === generation && !document.hidden;
    try {
      if (Capacitor.isNativePlatform()) {
        const handle = await audio.addListener("audioFrame", (data) => {
          if (current()) frame.current = { ...frame.current, ...data };
        });
        stopRef.current = () => {
          void handle.remove();
        };
        if (!current()) {
          await handle.remove();
          return;
        }
        const stopped = await audio.addListener("audioStopped", (data) => {
          if (current()) {
            setRunning(false);
            setError(data.reason ?? "Captura detenida");
            frame.current = {};
          }
        });
        stopRef.current = () => {
          void handle.remove();
          void stopped.remove();
          void audio.stop();
        };
        if (!current()) {
          await handle.remove();
          await stopped.remove();
          return;
        }
        await audio.start({ source: settings.audioSource });
        if (!current()) {
          await audio.stop();
          return;
        }
      } else {
        if (!navigator.mediaDevices)
          throw new Error("Este navegador no permite capturar audio");
        const stream =
          settings.audioSource === "music"
            ? await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true,
              })
            : await navigator.mediaDevices.getUserMedia({
                audio: {
                  echoCancellation: false,
                  noiseSuppression: false,
                  autoGainControl: false,
                },
              });
        const release = () => stream.getTracks().forEach((t) => t.stop());
        if (!current()) {
          release();
          return;
        }
        if (!stream.getAudioTracks().length) {
          release();
          throw new Error(
            "No se recibió audio. Elegí una pestaña con música y activá «Compartir audio», o usá el micrófono.",
          );
        }
        stopRef.current = release;
        const context = new AudioContext();
        stopRef.current = () => {
          release();
          void context.close();
        };
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 4096;
        source.connect(analyser);

        const frequency = new Float32Array(analyser.frequencyBinCount);
        const bandFrequencies = Array.from(
          { length: 32 },
          (_, i) =>
            (Math.min(
              analyser.frequencyBinCount - 1,
              Math.max(
                1,
                Math.round(
                  (32 *
                    Math.pow(
                      Math.min(16000, context.sampleRate / 2) / 32,
                      i / 31,
                    ) *
                    analyser.fftSize) /
                    context.sampleRate,
                ),
              ),
            ) *
              context.sampleRate) /
            analyser.fftSize,
        );
        const wave = new Uint8Array(analyser.fftSize);
        let timer = 0;
        const sample = () => {
          if (!current()) return;
          analyser.getFloatFrequencyData(frequency);
          analyser.getByteTimeDomainData(wave);
          const waveform = Array.from(
            { length: 64 },
            (_, i) => (wave[Math.floor((i * wave.length) / 64)] - 128) / 128,
          );
          let sum = 0,
            peak = 0;
          for (const sample of wave) {
            const value = (sample - 128) / 128;
            sum += value * value;
            peak = Math.max(peak, Math.abs(value));
          }
          const level = Math.sqrt(sum / wave.length);
          frame.current = {
            bands: bandFrequencies.map((hz) => {
              const bin = Math.min(
                frequency.length - 1,
                Math.max(
                  1,
                  Math.round((hz * analyser.fftSize) / context.sampleRate),
                ),
              );
              const db = frequency[bin];
              return Number.isFinite(db) ? Math.pow(10, db / 20) : 0;
            }),
            bandFrequencies,
            wave: waveform,
            level,
            peak,
            db: 20 * Math.log10(Math.max(0.000001, level)),
          };
          timer = requestAnimationFrame(sample);
        };
        stopRef.current = () => {
          cancelAnimationFrame(timer);
          source.disconnect();
          release();
          void context.close();
        };
        await context.resume();
        if (!current()) {
          stopRef.current();
          return;
        }
        stream.getTracks().forEach((t) =>
          t.addEventListener("ended", () => {
            if (current()) stop();
          }),
        );
        sample();
      }
      if (current()) setRunning(true);
    } catch (e) {
      if (current()) {
        stopRef.current();
        stopRef.current = () => {};
        setError(
          e instanceof Error ? e.message : "No se pudo acceder al audio",
        );
      }
    } finally {
      starting.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!active) return;
    let id = 0;
    let previous = 0;
    let lastFrame = 0;
    const peaks = Array(32).fill(0) as number[];
    const smooth = [0, 0];
    const draw = (time: number) => {
      const c = canvas.current;
      const ctx = c?.getContext("2d");
      if (c && ctx) {
        const bounds = c.getBoundingClientRect();
        const ratio = Math.min(devicePixelRatio || 1, 2);
        const width = Math.round(bounds.width * ratio),
          height = Math.round(bounds.height * ratio);
        if (c.width !== width || c.height !== height) {
          c.width = width;
          c.height = height;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = settings.color;
        ctx.strokeStyle = settings.color;
        ctx.shadowColor = settings.color;
        ctx.shadowBlur = 8 * ratio;
        drawReferenceMeter(
          ctx,
          width,
          height,
          settings.visualizerStyle,
          frame.current,
          settings.sensitivity,
          settings.color,
          peaks,
          smooth,
          lastFrame ? time - lastFrame : 16.67,
        );
        lastFrame = time;
        if (time - previous > 200) {
          setDb(frame.current.db ?? -120);
          previous = time;
        }
      }
      id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [active, settings.color, settings.sensitivity, settings.visualizerStyle]);
  return (
    <section className="relative h-full min-h-0 overflow-hidden bg-black text-white">
      <canvas
        ref={canvas}
        className="absolute inset-0 size-full"
        aria-label="Vúmetro de audio en tiempo real"
      />
      {controlHost &&
        createPortal(
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted p-3">
            <Button
              className="h-8 rounded-full text-xs"
              disabled={busy || !active}
              onClick={() => (running ? stop() : void start())}
            >
              {busy ? "Iniciando…" : running ? "Detener" : "Activar audio"}
            </Button>
            <span className="text-xs tabular-nums text-white/60">
              {running
                ? `${Math.round(db)} dBFS de entrada`
                : settings.audioSource === "music"
                  ? "Música"
                  : "Micrófono"}
            </span>
          </div>,
          controlHost,
        )}
      {controlHost &&
        error &&
        createPortal(
          <p
            role="alert"
            className="rounded-xl bg-muted p-3 text-sm text-amber-600"
          >
            {error}
          </p>,
          controlHost,
        )}
    </section>
  );
}
