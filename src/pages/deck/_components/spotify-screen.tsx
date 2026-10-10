import {
  Music2,
  Pause,
  Play,
  RefreshCw,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  isAndroidNative,
  type AndroidMediaState,
  type MediaCommand,
} from "@/lib/android-native.ts";

export interface SpotifyScreenProps {
  media: AndroidMediaState | null;
  loading: boolean;
  error: string | null;
  pending: boolean;
  onCommand(command: MediaCommand): void | Promise<void>;
  onRequestAccess(): void | Promise<void>;
  onRefresh(): void | Promise<void>;
}

function timeLabel(milliseconds: number): string {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function SpotifyScreen({
  media,
  loading,
  error,
  pending,
  onCommand,
  onRequestAccess,
  onRefresh,
}: SpotifyScreenProps) {
  const android = isAndroidNative();
  const available =
    android &&
    media?.available &&
    media.packageName === "com.spotify.music" &&
    media.permissionGranted;
  const playing = media?.state === "playing";
  const position = Math.max(
    0,
    Math.min(
      media?.positionMs ?? 0,
      media?.durationMs || Number.MAX_SAFE_INTEGER,
    ),
  );
  const progress = media?.durationMs
    ? Math.min(100, (position / media.durationMs) * 100)
    : 0;

  return (
    <section
      aria-label="Spotify"
      className="flex h-full min-h-0 min-w-0 flex-col gap-3"
    >
      {error && (
        <p
          role="alert"
          className="shrink-0 text-center text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {!available ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 text-center [@media(orientation:landscape)_and_(max-height:500px)]:gap-3">
          <Music2
            className="size-20 shrink-0 text-primary/70 [@media(orientation:landscape)_and_(max-height:500px)]:size-12"
            aria-hidden="true"
          />
          <div className="max-w-md space-y-3">
            {!android ? (
              <p className="text-sm text-muted-foreground">
                La canción, la carátula y los controles reales están disponibles
                en la app VISO Deck para Android. Abrí Spotify en ese teléfono
                para usar esta pantalla.
              </p>
            ) : loading && !media ? (
              <p role="status" className="text-sm text-muted-foreground">
                Consultando reproducción de Android…
              </p>
            ) : media && !media.permissionGranted ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Permití a VISO leer la reproducción de Android para mostrar la
                  canción y controlar Spotify.
                </p>
                <p className="text-xs text-muted-foreground">
                  Android te pedirá acceso a notificaciones. VISO utiliza la
                  sesión multimedia en este dispositivo.
                </p>
                <Button
                  className="min-h-11"
                  disabled={pending}
                  onClick={() => void onRequestAccess()}
                >
                  Autorizar reproducción
                </Button>
              </>
            ) : (
              <p role="status" className="text-sm text-muted-foreground">
                {error
                  ? "No se pudo leer la sesión de Spotify. Revisá el permiso multimedia y volvé a actualizar."
                  : "No hay una sesión de Spotify disponible. Abrí Spotify, reproducí una canción y volvé a VISO."}
              </p>
            )}
          </div>
          {android && (
            <Button
              size="icon"
              variant="ghost"
              className="size-11 shrink-0 rounded-xl"
              disabled={pending || loading}
              onClick={() => void onRefresh()}
              aria-label="Actualizar reproducción"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      ) : (
        <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-5 landscape:grid-cols-2 landscape:grid-rows-1 landscape:gap-8 [@media(orientation:landscape)_and_(max-height:500px)]:gap-4">
          <div className="flex min-h-0 min-w-0 items-center justify-center [container-type:size]">
            <div className="flex size-[min(100cqh,100cqw)] items-center justify-center overflow-hidden rounded-3xl bg-secondary/40">
              {media.artwork ? (
                <img
                  src={media.artwork}
                  alt="Carátula de la reproducción actual"
                  className="size-full object-contain"
                />
              ) : (
                <div className="space-y-3 p-3 text-center text-muted-foreground">
                  <Music2 className="mx-auto size-16" aria-hidden="true" />
                  <p className="text-xs">Sin carátula disponible</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex min-h-0 min-w-0 flex-col justify-center gap-4 landscape:gap-5 [@media(orientation:landscape)_and_(max-height:500px)]:gap-2">
            <div className="min-w-0 space-y-1 text-center landscape:text-left">
              <h2
                className="truncate text-2xl font-semibold sm:text-3xl [@media(orientation:landscape)_and_(max-height:500px)]:text-xl"
                title={media.title ?? undefined}
              >
                {media.title ?? "Título no disponible"}
              </h2>
              <p
                className="truncate text-base text-muted-foreground [@media(orientation:landscape)_and_(max-height:500px)]:text-sm"
                title={media.artist ?? undefined}
              >
                {media.artist ?? "Artista no disponible"}
              </p>
              {media.album && (
                <p
                  className="truncate text-xs text-muted-foreground"
                  title={media.album}
                >
                  {media.album}
                </p>
              )}
              <p role="status" className="text-xs text-primary">
                {playing
                  ? "Reproduciendo"
                  : media.state === "paused"
                    ? "En pausa"
                    : media.state === "buffering"
                      ? "Cargando reproducción…"
                      : media.state === "stopped"
                        ? "Reproducción detenida"
                        : "Sesión multimedia disponible"}
              </p>
            </div>
            {media.durationMs > 0 && (
              <div className="space-y-2">
                <div
                  role="progressbar"
                  aria-label="Progreso de reproducción"
                  aria-valuemin={0}
                  aria-valuemax={media.durationMs}
                  aria-valuenow={position}
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between font-mono text-xs text-muted-foreground">
                  <span>{timeLabel(position)}</span>
                  <span>{timeLabel(media.durationMs)}</span>
                </div>
              </div>
            )}
            <div className="flex items-center justify-center gap-6 [@media(orientation:landscape)_and_(max-height:500px)]:gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="size-14 rounded-2xl [@media(orientation:landscape)_and_(max-height:500px)]:size-11"
                aria-label="Anterior"
                disabled={pending || !media.canPrevious}
                onClick={() => void onCommand("previous")}
              >
                <SkipBack className="size-7" aria-hidden="true" />
              </Button>
              <Button
                size="icon"
                className="size-16 rounded-2xl [@media(orientation:landscape)_and_(max-height:500px)]:size-12"
                aria-label={playing ? "Pausar" : "Reproducir"}
                disabled={pending || !media.canPlayPause}
                onClick={() => void onCommand("play-pause")}
              >
                {playing ? (
                  <Pause className="size-8" aria-hidden="true" />
                ) : (
                  <Play className="size-8" aria-hidden="true" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-14 rounded-2xl [@media(orientation:landscape)_and_(max-height:500px)]:size-11"
                aria-label="Siguiente"
                disabled={pending || !media.canNext}
                onClick={() => void onCommand("next")}
              >
                <SkipForward className="size-7" aria-hidden="true" />
              </Button>
            </div>
            <div className="flex items-center justify-center gap-3 text-muted-foreground">
              <Button
                size="icon"
                variant="ghost"
                className="size-11 rounded-xl"
                aria-label="Bajar volumen multimedia"
                disabled={pending}
                onClick={() => void onCommand("volume-down")}
              >
                <Volume1 className="size-4" aria-hidden="true" />
              </Button>
              <span className="text-xs">Volumen</span>
              <Button
                size="icon"
                variant="ghost"
                className="size-11 rounded-xl"
                aria-label="Subir volumen multimedia"
                disabled={pending}
                onClick={() => void onCommand("volume-up")}
              >
                <Volume2 className="size-4" aria-hidden="true" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-11 rounded-xl"
                disabled={pending || loading}
                onClick={() => void onRefresh()}
                aria-label="Actualizar reproducción"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
