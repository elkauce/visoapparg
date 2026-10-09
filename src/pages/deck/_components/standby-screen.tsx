import {
  useEffect,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import {
  Battery,
  BatteryCharging,
  CalendarDays,
  Circle,
  Clock3,
  ImagePlus,
  Music2,
  Pause,
  Play,
  Settings2,
  SkipBack,
  SkipForward,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import {
  isAndroidNative,
  nativeDeck,
  type AndroidMediaState,
  type MediaCommand,
  type StandbyDeviceState,
} from "@/lib/android-native.ts";
import { cn } from "@/lib/utils.ts";
import {
  clockParts,
  loadStandbySettings,
  saveStandbySettings,
  type StandbySettings,
} from "../_lib/standby-settings.ts";
import {
  addStandbyPhotos,
  listStandbyPhotos,
  removeStandbyPhoto,
} from "../_lib/standby-photos.ts";

export interface StandbyScreenProps {
  userId: string;
  media: AndroidMediaState | null;
  mediaLoading: boolean;
  activeStatus: { name: string; color: string } | null;
  connected: boolean;
  onMediaCommand(command: MediaCommand): void;
  mediaBusy: boolean;
}

interface PhotoPreview {
  id: string;
  url: string;
}

const SELECT_CLASS =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const DATE_FORMAT = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  return now;
}

function StandbyClock({
  now,
  settings,
  compact = false,
}: {
  now: Date;
  settings: StandbySettings;
  compact?: boolean;
}) {
  const { hours, minutes, seconds, period } = clockParts(now, settings.hour12);
  const label = `${hours}:${minutes}${settings.showSeconds ? `:${seconds}` : ""}${period ? ` ${period}` : ""}`;
  const accentStyle = { color: settings.accent };
  const fontClass = {
    mono: "font-mono",
    sans: "font-sans",
    serif: "font-serif",
  }[settings.clockFont];
  const colorful = settings.clockPalette !== "single";
  const digitalStyle: CSSProperties =
    settings.clockPalette === "multicolor"
      ? {
          backgroundImage: `linear-gradient(90deg, ${settings.accent}, ${settings.minuteColor}, ${settings.secondColor})`,
          backgroundClip: "text",
          color: "transparent",
        }
      : accentStyle;
  return (
    <div className="flex min-h-0 min-w-0 flex-col items-center justify-center gap-[min(3cqh,0.75rem)] text-center">
      {settings.clockStyle === "analog" ? (
        <div
          role="img"
          aria-label={`Reloj: ${label}`}
          className={cn(
            "relative aspect-square rounded-full border-2 border-border bg-background/40",
            compact
              ? "size-[min(70cqw,70cqh,11rem)]"
              : "size-[min(70cqw,70cqh,15rem)]",
          )}
        >
          {[12, 3, 6, 9].map((number, index) => (
            <span
              key={number}
              className="absolute text-sm font-semibold text-muted-foreground"
              style={{
                left: `${50 + Math.sin((index * Math.PI) / 2) * 39}%`,
                top: `${50 - Math.cos((index * Math.PI) / 2) * 39}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              {number}
            </span>
          ))}
          <span
            aria-hidden="true"
            className="absolute bottom-1/2 left-1/2 h-[25%] w-1.5 origin-bottom rounded-full bg-foreground"
            style={{
              transform: `translateX(-50%) rotate(${(now.getHours() % 12) * 30 + now.getMinutes() / 2}deg)`,
            }}
          />
          <span
            aria-hidden="true"
            className="absolute bottom-1/2 left-1/2 h-[35%] w-1 origin-bottom rounded-full"
            style={{
              backgroundColor: settings.accent,
              transform: `translateX(-50%) rotate(${now.getMinutes() * 6 + now.getSeconds() / 10}deg)`,
            }}
          />
          {settings.showSeconds && (
            <span
              aria-hidden="true"
              className="absolute bottom-1/2 left-1/2 h-[38%] w-px origin-bottom bg-foreground/60"
              style={{ transform: `rotate(${now.getSeconds() * 6}deg)` }}
            />
          )}
          <span
            aria-hidden="true"
            className="absolute top-1/2 left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ backgroundColor: settings.accent }}
          />
        </div>
      ) : settings.clockStyle === "flip" ? (
        <div
          role="img"
          aria-label={`Reloj: ${label}`}
          className={cn(
            "flex max-w-full items-center gap-1.5 font-semibold tabular-nums",
            fontClass,
          )}
          style={{ color: settings.flipColor }}
        >
          {[hours, minutes, ...(settings.showSeconds ? [seconds] : [])].map(
            (value, index) => (
              <span
                key={index}
                aria-hidden="true"
                className={cn(
                  "relative overflow-hidden rounded-xl border border-border bg-[#f4f4f0] px-[min(3cqw,0.5rem)] py-[min(3cqh,0.75rem)] leading-none",
                  compact || settings.showSeconds
                    ? "text-[length:min(20cqw,50cqh,4rem)]"
                    : "text-[length:min(24cqw,50cqh,6rem)]",
                )}
              >
                {value}
                <span className="absolute inset-x-0 top-1/2 h-px bg-black/70" />
              </span>
            ),
          )}
          {period && (
            <span aria-hidden="true" className="self-end pb-3 text-xs">
              {period}
            </span>
          )}
        </div>
      ) : (
        <time
          dateTime={now.toISOString()}
          aria-label={`Reloj: ${label}`}
          className={cn(
            "max-w-full leading-none font-semibold tracking-tight tabular-nums",
            fontClass,
            compact || settings.showSeconds
              ? "text-[length:min(23cqw,50cqh,5rem)]"
              : "text-[length:min(26cqw,56cqh,8rem)]",
          )}
          style={digitalStyle}
        >
          <span>{hours}</span>:
          <span
            style={
              settings.clockPalette === "pastel"
                ? { color: settings.minuteColor }
                : undefined
            }
          >
            {minutes}
          </span>
          {settings.showSeconds && (
            <span
              className="text-[0.5em]"
              style={
                colorful && settings.clockPalette !== "multicolor"
                  ? { color: settings.secondColor }
                  : undefined
              }
            >
              :{seconds}
            </span>
          )}
          {period && (
            <span className="ml-2 text-[0.2em] tracking-normal">{period}</span>
          )}
        </time>
      )}
      {settings.showDate && (
        <p className="max-w-full text-sm text-muted-foreground capitalize">
          {DATE_FORMAT.format(now)}
        </p>
      )}
    </div>
  );
}

function CalendarWidget({ now }: { now: Date }) {
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthLabel = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(now);
  return (
    <div className="flex h-full min-h-0 w-full max-w-xs flex-col gap-[min(3cqh,0.75rem)]">
      <div className="flex shrink-0 items-center justify-center gap-2">
        <CalendarDays className="size-4 text-muted-foreground" />
        <p className="text-xs font-semibold capitalize">{monthLabel}</p>
      </div>
      <div
        role="group"
        aria-label={`Calendario de ${monthLabel}`}
        className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-1 text-center text-[length:clamp(0.625rem,6cqh,0.75rem)] leading-none"
      >
        {["L", "M", "M", "J", "V", "S", "D"].map((day, index) => (
          <span
            key={`weekday-${index}`}
            aria-hidden="true"
            className="flex min-h-0 items-center justify-center text-muted-foreground"
          >
            {day}
          </span>
        ))}
        {Array.from({ length: offset }, (_, index) => (
          <span key={`empty-${index}`} />
        ))}
        {Array.from({ length: days }, (_, index) => (
          <span
            key={index + 1}
            aria-current={index + 1 === now.getDate() ? "date" : undefined}
            className={cn(
              "flex min-h-0 items-center justify-center rounded-full",
              index + 1 === now.getDate() &&
                "bg-primary font-semibold text-primary-foreground",
            )}
          >
            {index + 1}
          </span>
        ))}
      </div>
    </div>
  );
}

function BatteryWidget({ device }: { device: StandbyDeviceState }) {
  if (
    device.batteryPercentage === null ||
    !Number.isFinite(device.batteryPercentage) ||
    device.batteryPercentage < 0 ||
    device.batteryPercentage > 100
  )
    return null;
  return (
    <div className="flex items-center justify-center gap-3">
      {device.charging ? (
        <BatteryCharging className="size-9 text-primary" aria-hidden="true" />
      ) : (
        <Battery className="size-9 text-primary" aria-hidden="true" />
      )}
      <div>
        <p className="text-2xl font-semibold tabular-nums">
          {device.batteryPercentage}%
        </p>
        <p className="text-xs text-muted-foreground">
          {device.charging ? "Cargando" : "Batería"}
        </p>
      </div>
    </div>
  );
}

function safeArtwork(value: string | null): string | null {
  return value &&
    value.length < 200_000 &&
    /^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(value)
    ? value
    : null;
}

function MusicWidget({
  media,
  mediaLoading,
  onMediaCommand,
  mediaBusy,
  compact = false,
}: Pick<
  StandbyScreenProps,
  "media" | "mediaLoading" | "onMediaCommand" | "mediaBusy"
> & { compact?: boolean }) {
  const artwork = safeArtwork(media?.artwork ?? null);
  if (!media?.available || !media.permissionGranted) {
    const message = mediaLoading
      ? "Consultando la reproducción…"
      : !isAndroidNative()
        ? "La información musical está disponible en la APK Android."
        : media && !media.permissionGranted
          ? "Habilitá el acceso multimedia desde Spotify para mostrar tu música."
          : "Abrí Spotify o reproducí música en Android para verla acá.";
    return (
      <div className="flex min-h-0 flex-col items-center justify-center gap-[min(3cqh,0.75rem)] p-1 text-center">
        <Music2
          className="size-[min(20cqh,2.5rem)] shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="max-w-xs text-xs text-muted-foreground">{message}</p>
      </div>
    );
  }
  const progress =
    media.durationMs > 0
      ? Math.max(0, Math.min(100, (media.positionMs / media.durationMs) * 100))
      : null;
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 items-center gap-[min(2cqh,1rem)]",
        compact ? "flex-col text-center" : "flex-col sm:flex-row",
      )}
    >
      {artwork ? (
        <img
          src={artwork}
          alt="Carátula de la reproducción actual"
          className={cn(
            "aspect-square shrink-0 rounded-2xl object-contain",
            compact
              ? "size-[min(45cqw,28cqh,6rem)]"
              : "size-[min(30cqw,65cqh,12rem)]",
          )}
        />
      ) : (
        <div
          aria-label="Esta sesión no ofrece carátula"
          className={cn(
            "flex aspect-square shrink-0 items-center justify-center rounded-2xl bg-background/60",
            compact
              ? "size-[min(45cqw,28cqh,6rem)]"
              : "size-[min(30cqw,65cqh,12rem)]",
          )}
        >
          <Music2 className="size-10 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-[min(2cqh,0.75rem)]">
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-[0.625rem] text-muted-foreground">
            {media.sourceName || "Reproducción Android"}
          </p>
          <p
            className={cn(
              "line-clamp-1 break-words font-semibold",
              compact ? "text-sm" : "text-lg",
            )}
          >
            {media.title || "Sin título disponible"}
          </p>
          <p className="line-clamp-1 break-words text-xs text-muted-foreground">
            {media.artist || "Artista no informado por la aplicación"}
          </p>
        </div>
        {progress !== null && (
          <div
            role="progressbar"
            aria-label="Progreso de reproducción"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            className="h-1 w-full overflow-hidden rounded-full bg-background/70"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        <div
          className={cn(
            "flex items-center gap-2",
            compact ? "justify-center" : "justify-center sm:justify-start",
          )}
        >
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Canción anterior"
            disabled={mediaBusy || !media.canPrevious}
            onClick={() => onMediaCommand("previous")}
          >
            <SkipBack className="size-4" />
          </Button>
          <Button
            size="icon"
            className="size-8"
            aria-label={media.state === "playing" ? "Pausar" : "Reproducir"}
            disabled={mediaBusy || !media.canPlayPause}
            onClick={() => onMediaCommand("play-pause")}
          >
            {media.state === "playing" ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Canción siguiente"
            disabled={mediaBusy || !media.canNext}
            onClick={() => onMediaCommand("next")}
          >
            <SkipForward className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatusWidget({
  activeStatus,
  connected,
}: Pick<StandbyScreenProps, "activeStatus" | "connected">) {
  const color =
    activeStatus && /^#[\da-f]{6}$/i.test(activeStatus.color)
      ? activeStatus.color
      : undefined;
  return (
    <div className="flex min-w-0 items-center justify-center gap-2 text-sm">
      <Circle
        className="size-3 shrink-0 fill-current"
        style={{ color }}
        aria-hidden="true"
      />
      <span className="truncate">
        {activeStatus?.name ||
          (connected ? "Sin estado seleccionado" : "Estado sin actualizar")}
      </span>
    </div>
  );
}

function PreferenceToggle({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange(value: boolean): void;
}) {
  return (
    <label className="flex min-h-10 items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </label>
  );
}

function AccountStandby(props: StandbyScreenProps) {
  const { userId, activeStatus, connected } = props;
  const [settings, setSettings] = useState(() => loadStandbySettings(userId));
  const [customizing, setCustomizing] = useState(false);
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [photosRevision, setPhotosRevision] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [device, setDevice] = useState<StandbyDeviceState | null>(null);
  const now = useClock();

  useEffect(() => {
    if (!isAndroidNative()) return;
    let active = true;
    const readBattery = () => {
      if (document.visibilityState === "hidden") return;
      void nativeDeck
        .getStandbyDeviceState()
        .then((value) => {
          if (active) setDevice(value);
        })
        .catch(() => {
          if (active) setDevice(null);
        });
    };
    readBattery();
    const interval = window.setInterval(readBattery, 60_000);
    document.addEventListener("visibilitychange", readBattery);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", readBattery);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const urls: string[] = [];
    void listStandbyPhotos(userId)
      .then((stored) => {
        if (!active) return;
        const previews = stored.map(({ id, blob }) => {
          const url = URL.createObjectURL(blob);
          urls.push(url);
          return { id, url };
        });
        setPhotos(previews);
        setPhotosLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setPhotosLoading(false);
        // Clock and music still work when local photo storage is unavailable.
        setMessage(
          error instanceof Error
            ? error.message
            : "No se pudieron leer las fotografías.",
        );
      });
    return () => {
      active = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [userId, photosRevision]);

  useEffect(() => {
    if (
      (settings.style !== "photos" &&
        !(settings.style === "duo" && settings.duoContent === "photo")) ||
      photos.length < 2 ||
      customizing
    )
      return;
    const interval = window.setInterval(
      () => setPhotoIndex((index) => (index + 1) % photos.length),
      settings.photoInterval * 1000,
    );
    return () => window.clearInterval(interval);
  }, [
    settings.style,
    settings.duoContent,
    settings.photoInterval,
    photos.length,
    customizing,
  ]);

  function updateSettings(patch: Partial<StandbySettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      saveStandbySettings(userId, next);
      setMessage(null);
    } catch {
      setMessage("No se pudo guardar la personalización en este dispositivo.");
    }
  }

  async function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length || photoBusy) return;
    setPhotoBusy(true);
    setMessage(null);
    try {
      await addStandbyPhotos(userId, files);
      setPhotosRevision((revision) => revision + 1);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron guardar las fotografías.",
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  async function deletePhoto(id: string) {
    setPhotoBusy(true);
    setMessage(null);
    try {
      await removeStandbyPhoto(userId, id);
      setPhotosRevision((revision) => revision + 1);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo borrar la fotografía.",
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  const currentPhoto = photos.length
    ? photos[photoIndex % photos.length]
    : null;
  const panelClass =
    "min-h-0 min-w-0 rounded-2xl border border-border bg-card p-4 landscape:p-2 [container-type:size]";
  const stageClass = "min-h-0 flex-1";
  const widgetCount =
    1 +
    Number(settings.showDate) +
    Number(settings.showMusic) +
    Number(settings.showStatus || settings.showConnection) +
    Number(settings.showBattery && device?.batteryPercentage != null);
  const accentStyle = { "--standby-accent": settings.accent } as CSSProperties;
  const backgroundStyle = { backgroundColor: settings.background };
  return (
    <section
      aria-label="Standby"
      className="flex h-full min-h-0 min-w-0 flex-col gap-3"
      style={accentStyle}
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <span className="text-sm font-medium">Standby</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCustomizing(true)}
        >
          <Settings2 className="size-4" />
          Personalizar
        </Button>
      </div>
      {message && (
        <p role="status" className="shrink-0 text-xs text-muted-foreground">
          {message}
        </p>
      )}
      {settings.style === "clock" && (
        <div
          className={cn(
            panelClass,
            stageClass,
            "flex items-center justify-center",
          )}
          style={backgroundStyle}
        >
          <StandbyClock now={now} settings={settings} />
        </div>
      )}
      {settings.style === "duo" && (
        <div
          className={cn(
            stageClass,
            "grid min-w-0 grid-cols-1 grid-rows-[repeat(2,minmax(0,1fr))] gap-3 sm:grid-cols-2 sm:grid-rows-1 landscape:grid-cols-2 landscape:grid-rows-1",
          )}
        >
          <div
            className={cn(panelClass, "flex items-center justify-center")}
            style={backgroundStyle}
          >
            <StandbyClock now={now} settings={settings} compact />
          </div>
          <div className={cn(panelClass, "flex items-center justify-center")}>
            {settings.duoContent === "music" ? (
              <MusicWidget {...props} compact />
            ) : currentPhoto ? (
              <img
                src={currentPhoto.url}
                alt="Fotografía personal de Standby"
                className={cn(
                  "size-full rounded-xl",
                  settings.photoFit === "cover"
                    ? "object-cover"
                    : "object-contain",
                )}
              />
            ) : (
              <div className="space-y-2 p-4 text-center">
                <ImagePlus className="mx-auto size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Agregá tus fotos desde Personalizar.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      {settings.style === "music" && (
        <div
          className={cn(
            panelClass,
            stageClass,
            "flex items-center justify-center",
          )}
        >
          <MusicWidget {...props} />
        </div>
      )}
      {settings.style === "photos" && (
        <div
          className={cn(
            panelClass,
            stageClass,
            "relative flex items-center justify-center overflow-hidden p-0 landscape:p-0",
          )}
        >
          {currentPhoto ? (
            <>
              <img
                src={currentPhoto.url}
                alt="Fotografía personal de Standby"
                className={cn(
                  "absolute inset-0 size-full",
                  settings.photoFit === "cover"
                    ? "object-cover"
                    : "object-contain",
                )}
              />
              {settings.photoClock && (
                <div className="relative z-10 self-end rounded-t-2xl bg-black/65 px-4 py-3 backdrop-blur-sm">
                  <StandbyClock
                    now={now}
                    settings={{
                      ...settings,
                      clockStyle: "digital",
                      showSeconds: false,
                    }}
                    compact
                  />
                </div>
              )}
              {photos.length > 1 && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute top-3 right-3 z-10"
                  onClick={() =>
                    setPhotoIndex((index) => (index + 1) % photos.length)
                  }
                >
                  Siguiente foto
                </Button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 p-4 text-center">
              <ImagePlus className="size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {photosLoading
                  ? "Cargando tus fotografías…"
                  : "Agregá tus fotos desde Personalizar."}
              </p>
            </div>
          )}
        </div>
      )}
      {settings.style === "widgets" && (
        <div
          className={cn(
            stageClass,
            "grid min-w-0 auto-rows-fr grid-cols-2 gap-3 landscape:grid-cols-[repeat(var(--standby-widgets),minmax(0,1fr))] landscape:grid-rows-1 landscape:gap-2",
          )}
          style={{ "--standby-widgets": widgetCount } as CSSProperties}
        >
          <div
            className={cn(panelClass, "flex items-center justify-center")}
            style={backgroundStyle}
          >
            <StandbyClock
              now={now}
              settings={{ ...settings, showDate: false }}
              compact
            />
          </div>
          {settings.showDate && (
            <div className={cn(panelClass, "flex items-center justify-center")}>
              <CalendarWidget now={now} />
            </div>
          )}
          {settings.showMusic && (
            <div className={panelClass}>
              <MusicWidget {...props} compact />
            </div>
          )}
          {(settings.showStatus || settings.showConnection) && (
            <div
              className={cn(
                panelClass,
                "flex flex-col items-center justify-center gap-2",
              )}
            >
              {settings.showStatus && (
                <>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Estado VISO
                  </p>
                  <StatusWidget
                    activeStatus={activeStatus}
                    connected={connected}
                  />
                </>
              )}
              {settings.showConnection && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {connected ? (
                    <Wifi className="size-4" />
                  ) : (
                    <WifiOff className="size-4" />
                  )}
                  {connected ? "VISO conectado" : "VISO sin conexión"}
                </div>
              )}
            </div>
          )}
          {settings.showBattery &&
            device?.batteryPercentage !== null &&
            device && (
              <div className={panelClass}>
                <BatteryWidget device={device} />
              </div>
            )}
        </div>
      )}
      {settings.style !== "widgets" &&
        (settings.showStatus || settings.showConnection) && (
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {settings.showStatus && (
              <StatusWidget activeStatus={activeStatus} connected={connected} />
            )}
            {settings.showConnection && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {connected ? (
                  <Wifi className="size-3" />
                ) : (
                  <WifiOff className="size-3" />
                )}
                {connected ? "Conectado" : "Sin conexión"}
              </span>
            )}
          </div>
        )}
      <Dialog open={customizing} onOpenChange={setCustomizing}>
        <DialogContent className="max-h-[calc(100dvh-3rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Personalizar Standby</DialogTitle>
            <DialogDescription>
              Una sola pantalla, con tu estilo. La configuración y las fotos se
              guardan en este dispositivo para tu cuenta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="block space-y-1.5 text-sm">
              <span>Estilo</span>
              <select
                className={SELECT_CLASS}
                value={settings.style}
                onChange={(event) =>
                  updateSettings({
                    style: event.target.value as StandbySettings["style"],
                  })
                }
              >
                <option value="clock">Reloj</option>
                <option value="duo">Dúo: reloj y música o foto</option>
                <option value="music">Música</option>
                <option value="photos">Fotografías</option>
                <option value="widgets">Widgets</option>
              </select>
            </label>
            {settings.style === "duo" && (
              <label className="block space-y-1.5 text-sm">
                <span>Panel junto al reloj</span>
                <select
                  className={SELECT_CLASS}
                  value={settings.duoContent}
                  onChange={(event) =>
                    updateSettings({
                      duoContent: event.target
                        .value as StandbySettings["duoContent"],
                    })
                  }
                >
                  <option value="music">Música real de Android</option>
                  <option value="photo">Mis fotografías</option>
                </select>
              </label>
            )}
            {(settings.style === "clock" ||
              settings.style === "widgets" ||
              settings.style === "duo") && (
              <label className="block space-y-1.5 text-sm">
                <span>Diseño del reloj</span>
                <select
                  className={SELECT_CLASS}
                  value={settings.clockStyle}
                  onChange={(event) =>
                    updateSettings({
                      clockStyle: event.target
                        .value as StandbySettings["clockStyle"],
                      ...(event.target.value === "flip"
                        ? { showSeconds: true }
                        : {}),
                    })
                  }
                >
                  <option value="digital">Digital</option>
                  <option value="analog">Analógico</option>
                  <option value="flip">Flip</option>
                </select>
              </label>
            )}
            <label className="block space-y-1.5 text-sm">
              <span>Tipografía</span>
              <select
                className={SELECT_CLASS}
                value={settings.clockFont}
                onChange={(event) =>
                  updateSettings({
                    clockFont: event.target
                      .value as StandbySettings["clockFont"],
                  })
                }
              >
                <option value="mono">Digital</option>
                <option value="sans">Clásica</option>
                <option value="serif">Serif</option>
              </select>
            </label>
            {settings.clockStyle === "digital" && (
              <label className="block space-y-1.5 text-sm">
                <span>Colores del reloj</span>
                <select
                  className={SELECT_CLASS}
                  value={settings.clockPalette}
                  onChange={(event) =>
                    updateSettings({
                      clockPalette: event.target
                        .value as StandbySettings["clockPalette"],
                    })
                  }
                >
                  <option value="single">Un color</option>
                  <option value="multicolor">Multicolor</option>
                  <option value="pastel">Tres tonos</option>
                </select>
              </label>
            )}
            <label className="flex min-h-10 items-center justify-between gap-3 text-sm">
              <span>Color del reloj</span>
              <input
                aria-label="Color del reloj"
                type="color"
                value={
                  settings.clockStyle === "flip"
                    ? settings.flipColor
                    : settings.accent
                }
                className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
                onChange={(event) =>
                  updateSettings(
                    settings.clockStyle === "flip"
                      ? { flipColor: event.target.value }
                      : { accent: event.target.value },
                  )
                }
              />
            </label>
            {settings.clockPalette !== "single" && (
              <>
                {(["minuteColor", "secondColor"] as const).map((key, index) => (
                  <label
                    key={key}
                    className="flex min-h-10 items-center justify-between gap-3 text-sm"
                  >
                    <span>
                      {index === 0 ? "Segundo color" : "Tercer color"}
                    </span>
                    <input
                      aria-label={
                        index === 0 ? "Segundo color" : "Tercer color"
                      }
                      type="color"
                      value={settings[key]}
                      className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
                      onChange={(event) =>
                        updateSettings({ [key]: event.target.value })
                      }
                    />
                  </label>
                ))}
              </>
            )}
            <label className="flex min-h-10 items-center justify-between gap-3 text-sm">
              <span>Color de fondo del reloj</span>
              <input
                aria-label="Color de fondo del reloj"
                type="color"
                value={settings.background}
                className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
                onChange={(event) =>
                  updateSettings({ background: event.target.value })
                }
              />
            </label>
            <div className="space-y-1">
              <PreferenceToggle
                label="Formato de 12 horas"
                checked={settings.hour12}
                onCheckedChange={(hour12) => updateSettings({ hour12 })}
              />
              <PreferenceToggle
                label="Mostrar segundos"
                checked={settings.showSeconds}
                onCheckedChange={(showSeconds) =>
                  updateSettings({ showSeconds })
                }
              />
              <PreferenceToggle
                label="Mostrar fecha"
                checked={settings.showDate}
                onCheckedChange={(showDate) => updateSettings({ showDate })}
              />
              <PreferenceToggle
                label="Mostrar estado VISO"
                checked={settings.showStatus}
                onCheckedChange={(showStatus) => updateSettings({ showStatus })}
              />
              <PreferenceToggle
                label="Mostrar conexión"
                checked={settings.showConnection}
                onCheckedChange={(showConnection) =>
                  updateSettings({ showConnection })
                }
              />
              {settings.style === "widgets" && (
                <>
                  <PreferenceToggle
                    label="Widget de música"
                    checked={settings.showMusic}
                    onCheckedChange={(showMusic) =>
                      updateSettings({ showMusic })
                    }
                  />
                  {isAndroidNative() && (
                    <PreferenceToggle
                      label="Widget de batería"
                      checked={settings.showBattery}
                      onCheckedChange={(showBattery) =>
                        updateSettings({ showBattery })
                      }
                    />
                  )}
                </>
              )}
            </div>
            {(settings.style === "photos" ||
              (settings.style === "duo" &&
                settings.duoContent === "photo")) && (
              <div className="space-y-4 border-t border-border pt-4">
                <label className="block space-y-1.5 text-sm">
                  <span>Fotografías personales</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    disabled={photoBusy || photosLoading}
                    onChange={(event) => void addPhotos(event)}
                    className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  Hasta 8 fotos JPG, PNG o WebP; 8 MB por foto y 24 MB en total.
                  Permanecen en este dispositivo y no se suben a la nube.
                </p>
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo, index) => (
                      <div
                        key={photo.id}
                        className="relative overflow-hidden rounded-lg border border-border"
                      >
                        <img
                          src={photo.url}
                          alt={`Fotografía ${index + 1}`}
                          className="aspect-square w-full object-cover"
                        />
                        <Button
                          variant="secondary"
                          size="icon"
                          disabled={photoBusy}
                          className="absolute top-1 right-1 size-7"
                          aria-label={`Borrar fotografía ${index + 1}`}
                          onClick={() => void deletePhoto(photo.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="block space-y-1.5 text-sm">
                  <span>Encuadre</span>
                  <select
                    className={SELECT_CLASS}
                    value={settings.photoFit}
                    onChange={(event) =>
                      updateSettings({
                        photoFit: event.target
                          .value as StandbySettings["photoFit"],
                      })
                    }
                  >
                    <option value="contain">Mostrar la foto completa</option>
                    <option value="cover">Llenar la pantalla</option>
                  </select>
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span>Cambiar foto cada</span>
                  <select
                    className={SELECT_CLASS}
                    value={settings.photoInterval}
                    onChange={(event) =>
                      updateSettings({
                        photoInterval: Number(
                          event.target.value,
                        ) as StandbySettings["photoInterval"],
                      })
                    }
                  >
                    {[10, 20, 30, 60].map((seconds) => (
                      <option key={seconds} value={seconds}>
                        {seconds} segundos
                      </option>
                    ))}
                  </select>
                </label>
                <PreferenceToggle
                  label="Reloj sobre las fotos"
                  checked={settings.photoClock}
                  onCheckedChange={(photoClock) =>
                    updateSettings({ photoClock })
                  }
                />
              </div>
            )}
            {message && (
              <p role="status" className="text-sm text-destructive">
                {message}
              </p>
            )}
            <Button className="w-full" onClick={() => setCustomizing(false)}>
              <Clock3 className="size-4" />
              Listo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Remounting on account switch releases all photos and account-specific state. */
export default function StandbyScreen(props: StandbyScreenProps) {
  return <AccountStandby key={props.userId} {...props} />;
}
