import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { normalizeScreenSettings } from "@/convex/lib/screen_settings";
import { SPORTS_LEAGUES } from "@/convex/lib/sports_leagues";
import { searchCity, type GeoResult } from "../_lib/weather";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import WeatherScreen from "./weather-screen";
import SportsScreen from "./sports-screen";
import VisualizerScreen from "./visualizer-screen";
export default function ExtendedScreen({
  page,
  active,
  editing,
}: {
  page: Doc<"deckPages">;
  active: boolean;
  editing: boolean;
}) {
  const settings = normalizeScreenSettings(page.screenSettings);
  const configure = useMutation(api.deck_layout.configureScreen);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(settings);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const title =
    page.kind === "weather"
      ? "Clima"
      : page.kind === "sports"
        ? "Deportes"
        : "Vúmetro";
  const save = async () => {
    setBusy(true);
    try {
      await configure({ pageId: page._id, screenSettings: draft });
      setOpen(false);
    } catch {
      toast.error("No se pudieron guardar los ajustes de la página");
    } finally {
      setBusy(false);
    }
  };
  const find = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      setResults(await searchCity(search.trim()));
    } catch {
      toast.error("No se pudo buscar la ciudad");
    } finally {
      setSearching(false);
    }
  };
  return (
    <div className="relative flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 justify-end">
        <button
          aria-label={`Configurar ${title}`}
          className="flex items-center gap-2 rounded-lg p-2 text-sm text-white/70"
          onClick={() => {
            setDraft(settings);
            setOpen(true);
          }}
        >
          <Settings2 className="size-4" />
          {editing ? `Personalizar ${title}` : ""}
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {page.kind === "weather" ? (
          <WeatherScreen settings={settings} active={active} />
        ) : page.kind === "sports" ? (
          <SportsScreen settings={settings} active={active} />
        ) : (
          <VisualizerScreen settings={settings} active={active && !open} />
        )}
      </div>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Personalizar {title}</DialogTitle>
            <DialogDescription>
              Estos ajustes se comparten con la web y la APK de tu cuenta.
            </DialogDescription>
          </DialogHeader>
          {page.kind === "weather" && (
            <div className="space-y-4">
              <p>Ciudad: {draft.city}</p>
              <label className="block">
                Buscar ciudad
                <input
                  aria-label="Buscar ciudad del clima"
                  className="mt-1 w-full rounded-lg border bg-background p-2"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <Button
                disabled={searching || !search.trim()}
                onClick={() => void find()}
              >
                {searching ? "Buscando…" : "Buscar ciudad"}
              </Button>
              <div>
                {results.map((city, i) => (
                  <button
                    key={i}
                    className="block w-full rounded-lg p-2 text-left hover:bg-muted"
                    onClick={() => {
                      setDraft({
                        ...draft,
                        city: `${city.name}${city.country ? `, ${city.country}` : ""}`,
                        latitude: city.latitude,
                        longitude: city.longitude,
                      });
                      setResults([]);
                    }}
                  >
                    {city.name}, {city.admin1} {city.country}
                  </button>
                ))}
              </div>
              <label className="block">
                Temperatura
                <select
                  aria-label="Unidad de temperatura"
                  className="ml-2 rounded border bg-background p-2"
                  value={draft.units}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      units: e.target.value as typeof draft.units,
                    })
                  }
                >
                  <option value="celsius">Celsius (°C)</option>
                  <option value="fahrenheit">Fahrenheit (°F)</option>
                </select>
              </label>
            </div>
          )}
          {page.kind === "visualizer" && (
            <div className="space-y-4">
              <label className="block">
                Fuente
                <select
                  aria-label="Fuente del vúmetro"
                  className="ml-2 rounded border bg-background p-2"
                  value={draft.audioSource}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      audioSource: e.target.value as typeof draft.audioSource,
                    })
                  }
                >
                  <option value="microphone">Micrófono</option>
                  <option value="music">Música del dispositivo</option>
                </select>
              </label>
              <label className="block">
                Estilo
                <select
                  aria-label="Estilo del vúmetro"
                  className="ml-2 rounded border bg-background p-2"
                  value={draft.visualizerStyle}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      visualizerStyle: e.target
                        .value as typeof draft.visualizerStyle,
                    })
                  }
                >
                  {[
                    ["bars", "Barras con picos"],
                    ["mirror", "Barras reflejadas"],
                    ["radial", "Radial"],
                    ["wave", "Onda"],
                    ["levels", "Medidor LED"],
                  ].map(([v, n]) => (
                    <option key={v} value={v}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-3">
                Color
                <input
                  aria-label="Color del vúmetro"
                  type="color"
                  value={draft.color}
                  onChange={(e) =>
                    setDraft({ ...draft, color: e.target.value })
                  }
                />
              </label>
              <label className="block">
                Sensibilidad ({draft.sensitivity}×)
                <input
                  aria-label="Sensibilidad del vúmetro"
                  className="block w-full"
                  type="range"
                  min="0.25"
                  max="4"
                  step="0.25"
                  value={draft.sensitivity}
                  onChange={(e) =>
                    setDraft({ ...draft, sensitivity: Number(e.target.value) })
                  }
                />
              </label>
              <p className="text-sm text-muted-foreground">
                El audio se activa con tu permiso, se procesa en este
                dispositivo y no se sube a la cuenta. En el navegador, música
                requiere compartir una pestaña con audio. Android puede limitar
                ciertas salidas o contenidos protegidos.
              </p>
            </div>
          )}
          {page.kind === "sports" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(SPORTS_LEAGUES).map(([key, league]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.leagues.includes(key)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          leagues: e.target.checked
                            ? [...draft.leagues, key]
                            : draft.leagues.filter((k) => k !== key),
                        })
                      }
                    />
                    {league.name}
                  </label>
                ))}
              </div>
              <label className="block">
                Equipo o piloto favorito
                <input
                  aria-label="Favorito deportivo"
                  className="mt-1 w-full rounded border bg-background p-2"
                  maxLength={60}
                  placeholder="Ej.: River, Boca, Hamilton…"
                  value={draft.favorite}
                  onChange={(e) =>
                    setDraft({ ...draft, favorite: e.target.value })
                  }
                />
              </label>
            </div>
          )}
          <Button disabled={busy} onClick={() => void save()}>
            {busy ? "Guardando…" : "Guardar ajustes"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
