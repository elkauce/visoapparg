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
  db?: number;
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
}: {
  settings: ScreenSettings;
  active: boolean;
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
        analyser.fftSize = 1024;
        source.connect(analyser);

        const frequency = new Uint8Array(analyser.frequencyBinCount);
        const wave = new Uint8Array(analyser.fftSize);
        let timer = 0;
        const sample = () => {
          if (!current()) return;
          analyser.getByteFrequencyData(frequency);
          analyser.getByteTimeDomainData(wave);
          const waveform = Array.from(
            { length: 64 },
            (_, i) => (wave[Math.floor((i * wave.length) / 64)] - 128) / 128,
          );
          const level = Math.sqrt(
            waveform.reduce((sum, v) => sum + v * v, 0) / waveform.length,
          );
          frame.current = {
            bands: Array.from({ length: 32 }, (_, i) => {
              const from = Math.floor((i * frequency.length) / 32);
              const to = Math.floor(((i + 1) * frequency.length) / 32);
              return (
                frequency.slice(from, to).reduce((s, v) => s + v, 0) /
                (to - from) /
                255
              );
            }),
            wave: waveform,
            level,
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
    let peaks = Array(32).fill(0) as number[];
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
        const values =
          frame.current.bands ?? Array(32).fill(frame.current.level ?? 0);
        ctx.fillStyle = settings.color;
        ctx.strokeStyle = settings.color;
        ctx.shadowColor = settings.color;
        ctx.shadowBlur = 8 * ratio;
        const levels = values.map((v, i) => {
          const value = Math.min(1, v * settings.sensitivity);
          peaks[i] = Math.max(value, (peaks[i] ?? 0) * 0.92);
          return value;
        });
        if (settings.visualizerStyle === "wave") {
          ctx.lineWidth = 3 * ratio;
          ctx.beginPath();
          (frame.current.wave ?? Array(64).fill(0)).forEach((v, i, a) => {
            const x = (i * width) / (a.length - 1),
              y = height / 2 + v * height * 0.4 * settings.sensitivity;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();
        } else if (settings.visualizerStyle === "radial") {
          const radius = Math.min(width, height) * 0.18;
          levels.forEach((v, i) => {
            const angle = (i / levels.length) * Math.PI * 2;
            ctx.lineWidth = 7 * ratio;
            ctx.beginPath();
            ctx.moveTo(
              width / 2 + Math.cos(angle) * radius,
              height / 2 + Math.sin(angle) * radius,
            );
            ctx.lineTo(
              width / 2 +
                Math.cos(angle) * (radius + v * Math.min(width, height) * 0.25),
              height / 2 +
                Math.sin(angle) * (radius + v * Math.min(width, height) * 0.25),
            );
            ctx.stroke();
          });
        } else if (settings.visualizerStyle === "levels") {
          const v = Math.min(
            1,
            (frame.current.level ?? 0) * settings.sensitivity * 3,
          );
          for (let i = 0; i < 40; i++) {
            ctx.fillStyle =
              i < 28 ? settings.color : i < 35 ? "#facc15" : "#ef4444";
            ctx.globalAlpha = i / 40 <= v ? 1 : 0.12;
            ctx.fillRect(
              width * 0.1 + i * width * 0.02,
              height * 0.25,
              width * 0.015,
              height * 0.5,
            );
          }
          ctx.globalAlpha = 1;
        } else {
          const barWidth = width / levels.length;
          levels.forEach((v, i) => {
            const h =
              v *
              height *
              (settings.visualizerStyle === "mirror" ? 0.45 : 0.85);
            ctx.fillRect(
              i * barWidth + barWidth * 0.15,
              settings.visualizerStyle === "mirror"
                ? height / 2 - h
                : height - h,
              barWidth * 0.7,
              settings.visualizerStyle === "mirror" ? h * 2 : h,
            );
            if (settings.visualizerStyle === "bars") {
              ctx.globalAlpha = 0.6;
              ctx.fillRect(
                i * barWidth + barWidth * 0.15,
                height - peaks[i] * height * 0.85 - 4 * ratio,
                barWidth * 0.7,
                2 * ratio,
              );
              ctx.globalAlpha = 1;
            }
          });
        }
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
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl bg-black p-4 text-white">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Vúmetro</h2>
          <p className="text-xs text-white/50">
            {settings.audioSource === "music"
              ? "Música del dispositivo"
              : "Micrófono"}{" "}
            · {running ? "Audio activo" : "Detenido"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="tabular-nums text-white/60">
            {running ? `${Math.round(db)} dBFS` : "—"}
          </span>
          <Button
            disabled={busy || !active}
            onClick={() => (running ? stop() : void start())}
          >
            {busy ? "Iniciando…" : running ? "Detener" : "Activar audio"}
          </Button>
        </div>
      </header>
      <canvas
        ref={canvas}
        className="min-h-0 w-full flex-1"
        aria-label="Vúmetro de audio en tiempo real"
      />
      {error && (
        <p role="alert" className="text-sm text-amber-300">
          {error}
        </p>
      )}
      <p className="mt-2 text-xs text-white/40">
        Audio local, sin grabación. Se detiene al salir de esta página. dBFS
        indica nivel digital, no decibelios ambientales.
        {settings.audioSource === "music"
          ? " La fuente musical depende de los permisos del dispositivo y del reproductor."
          : ""}
      </p>
    </section>
  );
}
