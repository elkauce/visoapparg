import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useAuthToken } from "@convex-dev/auth/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import StatusIcon from "@/components/status-icon.tsx";
import {
  SPORTS_LEAGUES,
  type SportsLeagueKey,
} from "@/convex/lib/sports_leagues.ts";
import { searchCity, type GeoResult } from "../_lib/weather.ts";
import { STATUS_COLORS, STATUS_ICON_KEYS } from "@/lib/status-icons.ts";
import { cn } from "@/lib/utils.ts";
import {
  resolveKeyFace,
  type DeckStatusInfo,
  type KeyAppearance,
  type KeyContent,
} from "../_lib/resolve-key.ts";
import { deckErrorMessage } from "../_lib/deck-options.ts";
import { uploadKeyMedia, validateKeyMedia } from "../_lib/upload-media.ts";
import ActionEditor, { getActionValidationMessage } from "./action-editor.tsx";
import type { DeckAction } from "../_lib/action-runner.ts";

export type EditTarget = {
  pageId: string;
  position: number;
  keyId: string | null;
  content: KeyContent | null;
  appearance?: KeyAppearance;
};

type PageInfo = {
  _id: string;
  name: string;
  grid?: { columns: number; rows: number };
};
type KeyInfo = { _id: string; pageId: string; position: number };

type KeyEditorProps = {
  target: EditTarget | null;
  statuses: DeckStatusInfo[];
  pages: PageInfo[];
  keys?: KeyInfo[];
  connected?: boolean;
  advanced?: boolean;
  onClose: () => void;
};

type Kind = KeyContent["kind"];

const KIND_LABELS: Record<Kind, string> = {
  status: "Estado",
  link: "Enlace web",
  folder: "Carpeta (otra página)",
  off: "Apagar estado",
  clock: "Reloj",
  weather: "Clima",
  sports: "Deportes",
  volume: "Volumen del Display",
  action: "Acción Android o automatización",
};

const VOLUME_ACTIONS = {
  up: "Subir volumen",
  down: "Bajar volumen",
  mute: "Silenciar",
} as const;

type VolumeAction = keyof typeof VOLUME_ACTIONS;
type Weather = { label: string; latitude: number; longitude: number };

export default function KeyEditor({
  target,
  statuses,
  pages,
  keys = [],
  connected = true,
  advanced = false,
  onClose,
}: KeyEditorProps) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => !open && !busy && onClose()}
    >
      <DialogContent
        className="max-h-[90dvh] max-w-md overflow-y-auto"
        showCloseButton={!busy}
      >
        {target && (
          <KeyForm
            key={`${target.pageId}-${target.position}`}
            target={target}
            statuses={statuses}
            pages={pages}
            keys={keys}
            connected={connected}
            advanced={advanced}
            onBusyChange={setBusy}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function KeyForm({
  target,
  statuses,
  pages,
  keys = [],
  connected = true,
  advanced = false,
  onBusyChange,
  onClose,
}: Omit<KeyEditorProps, "target"> & {
  target: EditTarget;
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
}) {
  const setKey = useMutation(api.deck_layout.setKey);
  const removeKey = useMutation(api.deck_layout.removeKey);
  const moveKey = useMutation(api.deck_layout.moveKey);
  const token = useAuthToken();
  const initial = target.content;
  const initialFace = initial
    ? resolveKeyFace(initial, statuses, null, 0, target.appearance)
    : null;
  const otherPages = pages.filter((p) => p._id !== target.pageId);

  const [kind, setKind] = useState<Kind>(initial?.kind ?? "status");
  const [statusId, setStatusId] = useState(
    initial?.kind === "status" ? initial.statusId : (statuses[0]?._id ?? ""),
  );
  const [label, setLabel] = useState(initialFace?.label ?? "");
  const [url, setUrl] = useState(initial?.kind === "link" ? initial.url : "");
  const [weather, setWeather] = useState<Weather | null>(
    initial?.kind === "weather"
      ? {
          label: initial.label,
          latitude: initial.latitude,
          longitude: initial.longitude,
        }
      : null,
  );
  const [league, setLeague] = useState<SportsLeagueKey>(
    initial?.kind === "sports" && initial.league in SPORTS_LEAGUES
      ? (initial.league as SportsLeagueKey)
      : "laliga",
  );
  const [volumeAction, setVolumeAction] = useState<VolumeAction>(
    initial?.kind === "volume" ? initial.action : "up",
  );
  const [targetPageId, setTargetPageId] = useState(
    initial?.kind === "folder"
      ? initial.targetPageId
      : (otherPages[0]?._id ?? ""),
  );
  const [icon, setIcon] = useState(
    initialFace ? initialFace.icon : kind === "folder" ? "folder" : "globe",
  );
  const [color, setColor] = useState(initialFace?.color ?? STATUS_COLORS[4]);
  const [action, setAction] = useState<DeckAction>(
    initial?.kind === "action" ? initial.action : { type: "display" },
  );
  const [saving, setSaving] = useState(false);
  const pendingRef = useRef(false);
  const [destinationPageId, setDestinationPageId] = useState(target.pageId);
  const [position, setPosition] = useState(target.position);
  const [swap, setSwap] = useState(false);
  const [appearanceTouched, setAppearanceTouched] = useState(false);
  const [resetAppearance, setResetAppearance] = useState(false);
  const [media, setMedia] = useState<File | null>(null);
  const [removeMedia, setRemoveMedia] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const uploadedRef = useRef<{
    file: File;
    storageId: Id<"_storage">;
    mediaType: "image" | "video";
  } | null>(null);
  const destinationPage = pages.find((page) => page._id === destinationPageId);
  const destinationSlots = destinationPage?.grid
    ? destinationPage.grid.columns * destinationPage.grid.rows
    : 15;
  const occupied = keys.some(
    (key) =>
      key.pageId === destinationPageId &&
      key.position === position &&
      key._id !== target.keyId,
  );

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const buildContent = (): KeyContent | null => {
    switch (kind) {
      case "status":
        return statusId ? { kind, statusId: statusId as Id<"statuses"> } : null;
      case "off":
      case "clock":
        return { kind };
      case "weather":
        return weather ? { kind, ...weather } : null;
      case "sports":
        return { kind, league };
      case "volume":
        return { kind, action: volumeAction };
      case "link":
        return { kind, label, url, icon, color };
      case "folder":
        return targetPageId
          ? {
              kind,
              label,
              targetPageId: targetPageId as Id<"deckPages">,
              icon,
              color,
            }
          : null;
      case "action":
        return { kind, label, icon, color, action };
    }
  };

  const handleSave = async () => {
    if (pendingRef.current) return;
    if (!connected) {
      toast.error("Sin conexión. Espera la reconexión para guardar.");
      return;
    }
    const content = buildContent();
    if (!content) {
      toast.error("Completa los datos de la tecla");
      return;
    }
    if (content.kind === "action") {
      const invalid = getActionValidationMessage(content.action);
      if (invalid) {
        toast.error(invalid);
        return;
      }
    }
    if (
      (kind === "link" || kind === "folder" || kind === "action") &&
      !label.trim()
    ) {
      toast.error("Ponle un nombre a la tecla");
      return;
    }
    if (
      !Number.isInteger(position) ||
      position < 0 ||
      position >= destinationSlots
    ) {
      toast.error("Elige una posición válida");
      return;
    }
    if (
      occupied &&
      (destinationPageId !== target.pageId || position !== target.position) &&
      !swap
    ) {
      toast.error(
        "La posición está ocupada. Elige intercambiar o usa una posición vacía.",
      );
      return;
    }
    pendingRef.current = true;
    setSaving(true);
    onBusyChange(true);
    try {
      let uploaded =
        uploadedRef.current?.file === media ? uploadedRef.current : null;
      if (media && !uploaded) {
        uploaded = { file: media, ...(await uploadKeyMedia(media, token)) };
        uploadedRef.current = uploaded;
      }
      const needsAppearance =
        advanced &&
        (appearanceTouched ||
          media ||
          removeMedia ||
          target.appearance ||
          resetAppearance);
      const appearance =
        resetAppearance && !appearanceTouched && !media
          ? null
          : {
              ...(appearanceTouched
                ? { label: label.trim(), icon, color }
                : {
                    ...(target.appearance?.label
                      ? { label: target.appearance.label }
                      : {}),
                    ...(target.appearance?.icon
                      ? { icon: target.appearance.icon }
                      : {}),
                    ...(target.appearance?.color
                      ? { color: target.appearance.color }
                      : {}),
                  }),
              ...(uploaded
                ? {
                    mediaStorageId: uploaded.storageId,
                    mediaType: uploaded.mediaType,
                  }
                : !removeMedia && target.appearance?.mediaStorageId
                  ? {
                      mediaStorageId: target.appearance.mediaStorageId,
                      mediaType: target.appearance.mediaType,
                    }
                  : {}),
            };
      if (advanced && target.keyId) {
        // Edit and move belong to one server transaction. A stale position is
        // rejected before any write when another device has moved the key.
        await moveKey({
          keyId: target.keyId as Id<"deckKeys">,
          pageId: destinationPageId as Id<"deckPages">,
          position,
          swap,
          from: {
            pageId: target.pageId as Id<"deckPages">,
            position: target.position,
          },
          content,
          ...(needsAppearance ? { appearance } : {}),
        });
      } else {
        await setKey({
          pageId: target.pageId as Id<"deckPages">,
          position: target.position,
          content,
          ...(needsAppearance ? { appearance } : {}),
        });
      }
      onClose();
    } catch (error) {
      toast.error(deckErrorMessage(error, "No se pudo guardar la tecla"));
    } finally {
      pendingRef.current = false;
      setSaving(false);
      onBusyChange(false);
    }
  };

  const handleRemove = async () => {
    if (!target.keyId || pendingRef.current || !connected) {
      return;
    }
    pendingRef.current = true;
    setSaving(true);
    onBusyChange(true);
    try {
      await removeKey({ keyId: target.keyId as Id<"deckKeys"> });
      onClose();
    } catch {
      toast.error("No se pudo quitar la tecla");
    } finally {
      pendingRef.current = false;
      setSaving(false);
      onBusyChange(false);
    }
  };

  const needsLook =
    kind === "link" ||
    kind === "folder" ||
    kind === "action" ||
    (advanced && kind !== "clock" && kind !== "weather");

  return (
    <>
      <DialogHeader>
        <DialogTitle>{initial ? "Editar tecla" : "Nueva tecla"}</DialogTitle>
        <DialogDescription>
          Elige la acción y guarda los cambios de esta tecla.
        </DialogDescription>
      </DialogHeader>

      <fieldset disabled={saving} className="space-y-4">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select
            value={kind}
            onValueChange={(value) => {
              setKind(value as Kind);
              if (value === "folder" || value === "link") {
                setIcon(value === "folder" ? "folder" : "globe");
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(KIND_LABELS) as Kind[])
                .filter(
                  (k) =>
                    advanced || k !== "action" || initial?.kind === "action",
                )
                .map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABELS[k]}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {kind === "status" && (
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={statusId} onValueChange={setStatusId}>
              <SelectTrigger>
                <SelectValue placeholder="Elige un estado" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s._id} value={s._id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {kind === "weather" && (
          <CityPicker value={weather} onChange={setWeather} />
        )}

        {kind === "sports" && (
          <div className="space-y-2">
            <Label>Liga</Label>
            <Select
              value={league}
              onValueChange={(v) => setLeague(v as SportsLeagueKey)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SPORTS_LEAGUES) as SportsLeagueKey[]).map(
                  (key) => (
                    <SelectItem key={key} value={key}>
                      {SPORTS_LEAGUES[key].name}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {kind === "volume" && (
          <div className="space-y-2">
            <Label>Acción</Label>
            <Select
              value={volumeAction}
              onValueChange={(v) => setVolumeAction(v as VolumeAction)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(VOLUME_ACTIONS) as VolumeAction[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {VOLUME_ACTIONS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Controla el sonido de los videos de tu Display público.
            </p>
          </div>
        )}

        {kind === "action" && (
          <ActionEditor
            value={action}
            onChange={setAction}
            statuses={statuses}
            pages={pages}
            disabled={!advanced}
          />
        )}

        {kind === "folder" && (
          <div className="space-y-2">
            <Label>Lleva a la página</Label>
            {otherPages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Crea otra página primero con el botón "+" de arriba.
              </p>
            ) : (
              <Select value={targetPageId} onValueChange={setTargetPageId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {otherPages.map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {needsLook && (
          <>
            <div className="space-y-2">
              <Label htmlFor="key-label">Nombre</Label>
              <Input
                id="key-label"
                value={label}
                maxLength={
                  kind === "link" || kind === "folder" || kind === "action"
                    ? 20
                    : 30
                }
                placeholder={kind === "link" ? "Ej: Calendario" : "Ej: Música"}
                onChange={(e) => {
                  setLabel(e.target.value);
                  if (advanced) setAppearanceTouched(true);
                }}
              />
            </div>
            {kind === "link" && (
              <div className="space-y-2">
                <Label htmlFor="key-url">Dirección</Label>
                <Input
                  id="key-url"
                  value={url}
                  placeholder="https://calendar.google.com"
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {STATUS_COLORS.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    aria-label={`Color ${swatch}`}
                    onClick={() => {
                      setColor(swatch);
                      if (advanced) setAppearanceTouched(true);
                    }}
                    className={cn(
                      "size-9 cursor-pointer rounded-full border-2",
                      color === swatch
                        ? "border-foreground"
                        : "border-transparent",
                    )}
                    style={{ backgroundColor: swatch }}
                  />
                ))}
                <label className="relative size-9 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-muted-foreground">
                  <span className="sr-only">Color personalizado</span>
                  <input
                    type="color"
                    aria-label="Color personalizado"
                    value={color}
                    onChange={(event) => {
                      setColor(event.target.value);
                      if (advanced) setAppearanceTouched(true);
                    }}
                    className="absolute -inset-2 size-14 cursor-pointer opacity-0"
                  />
                  <span
                    className="block size-full rounded-full"
                    style={{ backgroundColor: color }}
                  />
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Icono</Label>
              <div className="grid grid-cols-8 gap-1.5">
                {STATUS_ICON_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={key}
                    onClick={() => {
                      setIcon(key);
                      if (advanced) setAppearanceTouched(true);
                    }}
                    className={cn(
                      "flex aspect-square cursor-pointer items-center justify-center rounded-lg border",
                      icon === key
                        ? "border-primary bg-accent text-primary"
                        : "border-border text-muted-foreground hover:bg-accent",
                    )}
                  >
                    <StatusIcon name={key} className="size-4" />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {advanced && kind !== "clock" && kind !== "weather" && (
          <div className="space-y-2">
            <Label htmlFor="deck-key-media">
              Imagen, GIF o video de la tecla
            </Label>
            {(previewUrl || (!removeMedia && target.appearance?.mediaUrl)) && (
              <div className="overflow-hidden rounded-xl border bg-black">
                {(
                  media
                    ? media.type.startsWith("video/")
                    : target.appearance?.mediaType === "video"
                ) ? (
                  <video
                    src={previewUrl ?? target.appearance?.mediaUrl ?? undefined}
                    muted
                    loop
                    autoPlay
                    playsInline
                    className="h-32 w-full object-cover"
                  />
                ) : (
                  <img
                    src={previewUrl ?? target.appearance?.mediaUrl ?? undefined}
                    alt="Vista previa de la tecla"
                    className="h-32 w-full object-cover"
                  />
                )}
              </div>
            )}
            <Input
              id="deck-key-media"
              type="file"
              accept="image/*,video/mp4,video/webm"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const invalid = validateKeyMedia(file);
                if (invalid) {
                  toast.error(invalid);
                  event.target.value = "";
                  return;
                }
                setPreviewUrl(URL.createObjectURL(file));
                setMedia(file);
                setRemoveMedia(false);
                setResetAppearance(false);
              }}
            />
            {(media || target.appearance?.mediaStorageId) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMedia(null);
                  setPreviewUrl(null);
                  setRemoveMedia(true);
                }}
              >
                Quitar archivo
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Hasta 60 MB. El archivo se sube al guardar. La reproducción
              depende del formato compatible con el dispositivo.
            </p>
            {target.appearance && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const face = initial
                    ? resolveKeyFace(initial, statuses, null, 0)
                    : null;
                  setLabel(face?.label ?? "");
                  setIcon(face?.icon ?? "globe");
                  setColor(face?.color ?? STATUS_COLORS[4]);
                  setMedia(null);
                  setPreviewUrl(null);
                  setRemoveMedia(true);
                  setAppearanceTouched(false);
                  setResetAppearance(true);
                }}
              >
                Restablecer aspecto original
              </Button>
            )}
          </div>
        )}

        {target.keyId && (
          <div className="space-y-2 border-t pt-4">
            <Label>Posición</Label>
            {advanced ? (
              <>
                <Select
                  value={destinationPageId}
                  onValueChange={(id) => {
                    setDestinationPageId(id);
                    setPosition(0);
                    setSwap(false);
                  }}
                >
                  <SelectTrigger aria-label="Página de la tecla">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pages.map((page) => (
                      <SelectItem key={page._id} value={page._id}>
                        {page.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="space-y-2">
                  <Label htmlFor="deck-key-position">
                    Posición (1–{destinationSlots})
                  </Label>
                  <Input
                    id="deck-key-position"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={destinationSlots}
                    value={position + 1}
                    onChange={(event) =>
                      setPosition(Number(event.target.value) - 1)
                    }
                  />
                </div>
                {occupied && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={swap}
                      onChange={(event) => setSwap(event.target.checked)}
                    />
                    Intercambiar con la tecla de esta posición
                  </label>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Posición {target.position + 1}. Mover teclas e incorporar
                archivos requiere la actualización del servidor. Puedes editar
                el estado y su fondo de Display desde Configuración.
              </p>
            )}
          </div>
        )}
      </fieldset>

      <DialogFooter className="gap-2 sm:justify-between">
        {target.keyId ? (
          <Button
            variant="ghost"
            onClick={handleRemove}
            disabled={saving || !connected}
          >
            Quitar tecla
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !connected || (kind === "action" && !advanced)}
          >
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

// Busca una ciudad y guarda sus coordenadas para el clima
function CityPicker({
  value,
  onChange,
}: {
  value: Weather | null;
  onChange: (value: Weather) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (query.trim().length < 2) {
      return;
    }
    setSearching(true);
    try {
      setResults(await searchCity(query.trim()));
    } catch {
      toast.error("No se pudo buscar la ciudad");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="city-search">Ciudad</Label>
      <div className="flex gap-2">
        <Input
          id="city-search"
          value={query}
          placeholder="Ej: Madrid"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={searching}
          onClick={handleSearch}
        >
          Buscar
        </Button>
      </div>
      {value && <p className="text-sm text-primary">Elegida: {value.label}</p>}
      {results.length > 0 && (
        <ul className="space-y-1">
          {results.map((city) => {
            const label = [city.name, city.admin1, city.country]
              .filter(Boolean)
              .join(", ");
            return (
              <li key={`${city.latitude}-${city.longitude}`}>
                <button
                  type="button"
                  className="w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    onChange({
                      label: label.slice(0, 30),
                      latitude: city.latitude,
                      longitude: city.longitude,
                    });
                    setResults([]);
                  }}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
