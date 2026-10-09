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
      className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5 [@media(orientation:landscape)_and_(max-height:500px)]:space-y-2 [@media(orientation:landscape)_and_(max-height:500px)]:p-3"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Music2 className="size-5 text-primary" aria-hidden="true" />
          Spotify
        </h2>
        {android && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending || loading}
            onClick={() => void onRefresh()}
            aria-label="Actualizar reproducción"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!android ? (
        <p className="text-sm text-muted-foreground">
          La canción, la carátula y los controles reales están disponibles en la
          app VISO Deck para Android. Abrí Spotify en ese teléfono para usar
          esta pantalla.
        </p>
      ) : loading && !media ? (
        <p role="status" className="text-sm text-muted-foreground">
          Consultando reproducción de Android…
        </p>
      ) : !available ? (
        <div className="space-y-4 py-3 [@media(orientation:landscape)_and_(max-height:500px)]:grid [@media(orientation:landscape)_and_(max-height:500px)]:grid-cols-[6rem_minmax(0,1fr)] [@media(orientation:landscape)_and_(max-height:500px)]:items-center [@media(orientation:landscape)_and_(max-height:500px)]:gap-3 [@media(orientation:landscape)_and_(max-height:500px)]:space-y-0 [@media(orientation:landscape)_and_(max-height:500px)]:py-1">
          <div className="mx-auto flex size-28 items-center justify-center rounded-2xl border border-border bg-background [@media(orientation:landscape)_and_(max-height:500px)]:size-24">
            <Music2
              className="size-12 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          <div className="space-y-4 [@media(orientation:landscape)_and_(max-height:500px)]:space-y-2">
            {media && !media.permissionGranted ? (
              <>
                <p className="text-center text-sm text-muted-foreground">
                  Permití a VISO leer la reproducción de Android para mostrar la
                  canción y controlar Spotify.
                </p>
                <p className="text-center text-xs text-muted-foreground">
                  Android te pedirá acceso a notificaciones. VISO utiliza la
                  sesión multimedia en este dispositivo.
                </p>
                <div className="flex justify-center">
                  <Button
                    disabled={pending}
                    onClick={() => void onRequestAccess()}
                  >
                    Autorizar reproducción
                  </Button>
                </div>
              </>
            ) : (
              <p
                role="status"
                className="text-center text-sm text-muted-foreground"
              >
                {error
                  ? "No se pudo leer la sesión de Spotify. Revisá el permiso multimedia y volvé a actualizar."
                  : "No hay una sesión de Spotify disponible. Abrí Spotify, reproducí una canción y volvé a VISO."}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid min-w-0 gap-5 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:items-center [@media(orientation:landscape)_and_(max-height:500px)]:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] [@media(orientation:landscape)_and_(max-height:500px)]:gap-3">
          <div className="mx-auto flex aspect-square w-full max-w-64 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background sm:max-w-72 [@media(orientation:landscape)_and_(max-height:500px)]:max-w-[min(9rem,calc(100dvh-13rem))]">
            {media.artwork ? (
              <img
                src={media.artwork}
                alt="Carátula de la reproducción actual"
                className="size-full object-contain"
              />
            ) : (
              <div className="space-y-2 text-center text-muted-foreground">
                <Music2 className="mx-auto size-16" aria-hidden="true" />
                <p className="text-xs">Sin carátula disponible</p>
              </div>
            )}
          </div>
          <div className="min-w-0 space-y-5 [@media(orientation:landscape)_and_(max-height:500px)]:space-y-2">
            <div className="min-w-0 space-y-1 text-center sm:text-left [@media(orientation:landscape)_and_(max-height:500px)]:space-y-0">
              <h3
                className="break-words text-xl font-semibold [@media(orientation:landscape)_and_(max-height:500px)]:truncate [@media(orientation:landscape)_and_(max-height:500px)]:text-lg"
                title={media.title ?? undefined}
              >
                {media.title ?? "Título no disponible"}
              </h3>
              <p
                className="break-words text-sm text-muted-foreground [@media(orientation:landscape)_and_(max-height:500px)]:truncate"
                title={media.artist ?? undefined}
              >
                {media.artist ?? "Artista no disponible"}
              </p>
              {media.album && (
                <p className="break-words text-xs text-muted-foreground [@media(orientation:landscape)_and_(max-height:500px)]:hidden">
                  {media.album}
                </p>
              )}
              <p
                role="status"
                className="pt-1 text-xs text-primary [@media(orientation:landscape)_and_(max-height:500px)]:pt-0"
              >
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
              <div className="space-y-1">
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
            <div className="space-y-5 [@media(orientation:landscape)_and_(max-height:500px)]:flex [@media(orientation:landscape)_and_(max-height:500px)]:items-center [@media(orientation:landscape)_and_(max-height:500px)]:justify-center [@media(orientation:landscape)_and_(max-height:500px)]:gap-3 [@media(orientation:landscape)_and_(max-height:500px)]:space-y-0">
              <div className="flex items-center justify-center gap-4 [@media(orientation:landscape)_and_(max-height:500px)]:gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Anterior"
                  disabled={pending || !media.canPrevious}
                  onClick={() => void onCommand("previous")}
                >
                  <SkipBack aria-hidden="true" />
                </Button>
                <Button
                  size="icon"
                  className="size-14 rounded-full [@media(orientation:landscape)_and_(max-height:500px)]:size-11"
                  aria-label={playing ? "Pausar" : "Reproducir"}
                  disabled={pending || !media.canPlayPause}
                  onClick={() => void onCommand("play-pause")}
                >
                  {playing ? (
                    <Pause className="size-6" aria-hidden="true" />
                  ) : (
                    <Play className="size-6" aria-hidden="true" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Siguiente"
                  disabled={pending || !media.canNext}
                  onClick={() => void onCommand("next")}
                >
                  <SkipForward aria-hidden="true" />
                </Button>
              </div>
              <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground [@media(orientation:landscape)_and_(max-height:500px)]:gap-0">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Bajar volumen multimedia"
                  disabled={pending}
                  onClick={() => void onCommand("volume-down")}
                >
                  <Volume1 className="size-4" aria-hidden="true" />
                </Button>
                <span className="[@media(orientation:landscape)_and_(max-height:500px)]:sr-only">
                  Volumen del teléfono
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Subir volumen multimedia"
                  disabled={pending}
                  onClick={() => void onCommand("volume-up")}
                >
                  <Volume2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
