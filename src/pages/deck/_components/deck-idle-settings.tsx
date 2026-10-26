import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
type Configuration = {
  enabled: boolean;
  mainPageId: Id<"deckPages">;
  restPageId: Id<"deckPages">;
  seconds: number;
};
export default function DeckIdleSettings({
  open,
  onOpenChange,
  pages,
  configuration,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  pages: { _id: Id<"deckPages">; name: string }[];
  configuration?: Configuration;
}) {
  const configure = useMutation(api.deck_layout.setIdle);
  const disable = useMutation(api.deck_layout.disableIdle);
  const [enabled, setEnabled] = useState(false);
  const [main, setMain] = useState("");
  const [rest, setRest] = useState("");
  const [seconds, setSeconds] = useState(3);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setEnabled(configuration?.enabled ?? false);
      setMain(
        pages.some((p) => p._id === configuration?.mainPageId)
          ? configuration!.mainPageId
          : (pages[0]?._id ?? ""),
      );
      setRest(
        pages.some((p) => p._id === configuration?.restPageId)
          ? configuration!.restPageId
          : (pages[1]?._id ?? ""),
      );
      setSeconds(configuration?.seconds ?? 3);
    }
  }, [open, configuration, pages]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent management>
        <DialogHeader>
          <DialogTitle>Principal y protector de pantalla</DialogTitle>
          <DialogDescription>
            Elegí tus páginas. Desactivado, el Deck funciona manualmente como
            siempre.
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-center justify-between gap-3">
          Activar protector de pantalla
          <Switch
            aria-label="Activar protector de pantalla"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </label>
        <label className="grid gap-2 text-sm">
          Página principal
          <select
            aria-label="Página principal"
            className="rounded border bg-background p-2"
            value={main}
            onChange={(e) => setMain(e.target.value)}
          >
            {pages.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          Página de reposo
          <select
            aria-label="Página de reposo"
            className="rounded border bg-background p-2"
            value={rest}
            onChange={(e) => setRest(e.target.value)}
          >
            {pages.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          Segundos sin tocar
          <input
            aria-label="Segundos sin tocar"
            type="number"
            min={3}
            max={3600}
            className="rounded border bg-background p-2"
            value={seconds}
            onChange={(e) => setSeconds(Number(e.target.value))}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Un toque en reposo vuelve a la principal sin accionar teclas. Mantené
          presionado en reposo para abrir estos ajustes y desactivar el modo. No
          cambia de página mientras editás o tenés un diálogo abierto.
        </p>
        <Button
          disabled={
            busy ||
            !main ||
            !rest ||
            main === rest ||
            !Number.isInteger(seconds) ||
            seconds < 3 ||
            seconds > 3600
          }
          onClick={async () => {
            setBusy(true);
            try {
              await configure({
                enabled,
                mainPageId: main as Id<"deckPages">,
                restPageId: rest as Id<"deckPages">,
                seconds,
              });
              onOpenChange(false);
            } catch {
              toast.error("No se pudieron guardar las preferencias del Deck.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Guardando…" : "Guardar"}
        </Button>
        {configuration?.enabled && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await disable({});
                onOpenChange(false);
              } catch {
                toast.error("No se pudo desactivar el protector.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Desactivar el protector
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
