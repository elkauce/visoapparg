import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
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
import { SPORTS_LEAGUES, type SportsLeagueKey } from "@/convex/lib/sports_leagues.ts";
import { searchCity, type GeoResult } from "../_lib/weather.ts";
import { STATUS_COLORS, STATUS_ICON_KEYS } from "@/lib/status-icons.ts";
import { cn } from "@/lib/utils.ts";
import type { DeckStatusInfo, KeyContent } from "../_lib/resolve-key.ts";

export type EditTarget = {
  pageId: string;
  position: number;
  keyId: string | null;
  content: KeyContent | null;
};

type PageInfo = { _id: string; name: string };

type KeyEditorProps = {
  target: EditTarget | null;
  statuses: DeckStatusInfo[];
  pages: PageInfo[];
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
};

const VOLUME_ACTIONS = {
  up: "Subir volumen",
  down: "Bajar volumen",
  mute: "Silenciar",
} as const;

type VolumeAction = keyof typeof VOLUME_ACTIONS;
type Weather = { label: string; latitude: number; longitude: number };

export default function KeyEditor({ target, statuses, pages, onClose }: KeyEditorProps) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        {target && (
          <KeyForm
            key={`${target.pageId}-${target.position}`}
            target={target}
            statuses={statuses}
            pages={pages}
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
  onClose,
}: Omit<KeyEditorProps, "target"> & { target: EditTarget; onClose: () => void }) {
  const setKey = useMutation(api.deck_layout.setKey);
  const removeKey = useMutation(api.deck_layout.removeKey);
  const initial = target.content;
  const otherPages = pages.filter((p) => p._id !== target.pageId);

  const [kind, setKind] = useState<Kind>(initial?.kind ?? "status");
  const [statusId, setStatusId] = useState(
    initial?.kind === "status" ? initial.statusId : (statuses[0]?._id ?? ""),
  );
  const [label, setLabel] = useState(
    initial?.kind === "link" || initial?.kind === "folder" ? initial.label : "",
  );
  const [url, setUrl] = useState(initial?.kind === "link" ? initial.url : "");
  const [weather, setWeather] = useState<Weather | null>(
    initial?.kind === "weather"
      ? { label: initial.label, latitude: initial.latitude, longitude: initial.longitude }
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
    initial?.kind === "folder" ? initial.targetPageId : (otherPages[0]?._id ?? ""),
  );
  const [icon, setIcon] = useState(
    initial?.kind === "link" || initial?.kind === "folder"
      ? initial.icon
      : kind === "folder"
        ? "folder"
        : "globe",
  );
  const [color, setColor] = useState(
    initial?.kind === "link" || initial?.kind === "folder" ? initial.color : STATUS_COLORS[4],
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
          ? { kind, label, targetPageId: targetPageId as Id<"deckPages">, icon, color }
          : null;
    }
  };

  const handleSave = async () => {
    const content = buildContent();
    if (!content) {
      toast.error("Completa los datos de la tecla");
      return;
    }
    try {
      await setKey({
        pageId: target.pageId as Id<"deckPages">,
        position: target.position,
        content,
      });
      onClose();
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "No se pudo guardar la tecla",
      );
    }
  };

  const handleRemove = async () => {
    if (!target.keyId) {
      return;
    }
    try {
      await removeKey({ keyId: target.keyId as Id<"deckKeys"> });
      onClose();
    } catch {
      toast.error("No se pudo quitar la tecla");
    }
  };

  const needsLook = kind === "link" || kind === "folder";

  return (
    <>
      <DialogHeader>
        <DialogTitle>{initial ? "Editar tecla" : "Nueva tecla"}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
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
              {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
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

        {kind === "weather" && <CityPicker value={weather} onChange={setWeather} />}

        {kind === "sports" && (
          <div className="space-y-2">
            <Label>Liga</Label>
            <Select value={league} onValueChange={(v) => setLeague(v as SportsLeagueKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SPORTS_LEAGUES) as SportsLeagueKey[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {SPORTS_LEAGUES[key].name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {kind === "volume" && (
          <div className="space-y-2">
            <Label>Acción</Label>
            <Select value={volumeAction} onValueChange={(v) => setVolumeAction(v as VolumeAction)}>
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
                maxLength={20}
                placeholder={kind === "link" ? "Ej: Calendario" : "Ej: Música"}
                onChange={(e) => setLabel(e.target.value)}
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
                    onClick={() => setColor(swatch)}
                    className={cn(
                      "size-7 cursor-pointer rounded-full border-2",
                      color === swatch ? "border-foreground" : "border-transparent",
                    )}
                    style={{ backgroundColor: swatch }}
                  />
                ))}
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
                    onClick={() => setIcon(key)}
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
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        {target.keyId ? (
          <Button variant="ghost" onClick={handleRemove}>
            Quitar tecla
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Guardar</Button>
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
        <Button type="button" variant="secondary" disabled={searching} onClick={handleSearch}>
          Buscar
        </Button>
      </div>
      {value && <p className="text-sm text-primary">Elegida: {value.label}</p>}
      {results.length > 0 && (
        <ul className="space-y-1">
          {results.map((city) => {
            const label = [city.name, city.admin1, city.country].filter(Boolean).join(", ");
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
