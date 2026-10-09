import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy } from "lucide-react";
import { toast } from "sonner";
import { useAuthToken } from "@convex-dev/auth/react";
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
import { deckErrorMessage } from "../_lib/deck-options.ts";
import { isGridPreference, type GridPreference } from "../_lib/grid.ts";
import { uploadKeyMedia, validateKeyMedia } from "../_lib/upload-media.ts";

type PageInfo = { _id: string; name: string };
type CanvasMedia = {
  mediaStorageId: Id<"_storage">;
  mediaType?: "image" | "video";
  mediaUrl?: string | null;
};

type Props = {
  page: PageInfo;
  pages: PageInfo[];
  preference: GridPreference;
  advanced: boolean;
  connected: boolean;
  canvas?: CanvasMedia;
  onSave: (
    name: string,
    grid: GridPreference,
    canvas?: CanvasMedia | null,
  ) => Promise<void>;
  onDuplicate: () => Promise<void>;
  onReorder: (direction: -1 | 1) => Promise<void>;
  onClose: () => void;
};

export default function PageSettings(props: Props) {
  const [name, setName] = useState(props.page.name);
  const [slots, setSlots] = useState(String(props.preference.slots));
  const [columns, setColumns] = useState(String(props.preference.columns));
  const [preset, setPreset] = useState(
    [6, 15, 32].includes(props.preference.slots)
      ? String(props.preference.slots)
      : "custom",
  );
  const [busy, setBusy] = useState(false);
  const token = useAuthToken();
  const [canvasFile, setCanvasFile] = useState<File | null>(null);
  const [clearCanvas, setClearCanvas] = useState(false);
  const uploaded = useRef<{
    file: File;
    mediaStorageId: Id<"_storage">;
    mediaType: "image" | "video";
  } | null>(null);
  const pending = useRef(false);
  const index = props.pages.findIndex((page) => page._id === props.page._id);

  const run = async (operation: () => Promise<void>, close = false) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await operation();
      if (close) props.onClose();
    } catch (error) {
      toast.error(deckErrorMessage(error));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const save = () => {
    const preference = { slots: Number(slots), columns: Number(columns) };
    if (!name.trim() || !isGridPreference(preference)) {
      toast.error(
        "Elige un nombre y una cuadrícula de 1 a 64 teclas con columnas válidas.",
      );
      return;
    }
    void run(async () => {
      let canvas: CanvasMedia | null | undefined = clearCanvas
        ? null
        : undefined;
      if (canvasFile) {
        if (uploaded.current?.file !== canvasFile) {
          const media = await uploadKeyMedia(canvasFile, token);
          uploaded.current = {
            file: canvasFile,
            mediaStorageId: media.storageId,
            mediaType: media.mediaType,
          };
        }
        canvas = {
          mediaStorageId: uploaded.current.mediaStorageId,
          mediaType: uploaded.current.mediaType,
        };
      }
      await props.onSave(name.trim(), preference, canvas);
    }, true);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && props.onClose()}>
      <DialogContent
        className="max-h-[90dvh] max-w-md overflow-y-auto"
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>Página y cuadrícula</DialogTitle>
          <DialogDescription>
            Conserva las teclas y el orden. Los cambios se aplican al guardar.
          </DialogDescription>
        </DialogHeader>
        <fieldset disabled={busy} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deck-page-name">Nombre de la página</Label>
            <Input
              id="deck-page-name"
              value={name}
              maxLength={20}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deck-grid-preset">Teclas por vista</Label>
            <Select
              value={preset}
              onValueChange={(value) => {
                setPreset(value);
                if (value !== "custom") {
                  setSlots(value);
                  setColumns(value === "6" ? "3" : value === "32" ? "8" : "5");
                }
              }}
            >
              <SelectTrigger id="deck-grid-preset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 teclas</SelectItem>
                <SelectItem value="15">15 teclas</SelectItem>
                <SelectItem value="32">32 teclas</SelectItem>
                <SelectItem value="custom">Personalizada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="deck-grid-slots">Cantidad</Label>
              <Input
                id="deck-grid-slots"
                type="number"
                min={1}
                max={64}
                inputMode="numeric"
                value={slots}
                disabled={preset !== "custom"}
                onChange={(event) => setSlots(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deck-grid-columns">Columnas en horizontal</Label>
              <Input
                id="deck-grid-columns"
                type="number"
                min={1}
                max={Number(slots) || 64}
                inputMode="numeric"
                value={columns}
                onChange={(event) => setColumns(event.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            En vertical las teclas se reorganizan. Si hace falta, puedes
            desplazarte sin reducir las teclas. Las teclas existentes fuera de
            esta vista siguen disponibles con las flechas.
          </p>
          {!props.advanced && (
            <p className="text-xs text-muted-foreground">
              Esta distribución se guarda en este dispositivo. La cuenta admite
              actualmente 15 posiciones por página; la ampliación, duplicación y
              orden de páginas requieren la actualización del servidor.
            </p>
          )}
          {props.advanced && (
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="deck-canvas-media">
                VISO Canvas: fondo continuo
              </Label>
              {props.canvas?.mediaUrl && !clearCanvas && !canvasFile && (
                <div className="overflow-hidden rounded-xl border bg-black">
                  {props.canvas.mediaType === "video" ? (
                    <video
                      src={props.canvas.mediaUrl}
                      muted
                      loop
                      autoPlay
                      playsInline
                      className="h-28 w-full object-cover"
                    />
                  ) : (
                    <img
                      src={props.canvas.mediaUrl}
                      alt="Canvas de la página"
                      className="h-28 w-full object-cover"
                    />
                  )}
                </div>
              )}
              <Input
                id="deck-canvas-media"
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
                  setCanvasFile(file);
                  setClearCanvas(false);
                }}
              />
              {canvasFile && (
                <p className="text-xs text-muted-foreground">
                  {canvasFile.name}
                </p>
              )}
              {(props.canvas || canvasFile) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCanvasFile(null);
                    setClearCanvas(true);
                  }}
                >
                  Quitar Canvas
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Una imagen, GIF o video compartido entre las teclas de esta
                página. Los espacios vacíos se conservan. Hasta 60 MB; se sube
                al guardar.
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!props.advanced || !props.connected}
              onClick={() => void run(props.onDuplicate, true)}
            >
              <Copy /> Duplicar página
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Mover página antes"
              disabled={!props.advanced || !props.connected || index === 0}
              onClick={() => void run(() => props.onReorder(-1))}
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Mover página después"
              disabled={
                !props.advanced ||
                !props.connected ||
                index === props.pages.length - 1
              }
              onClick={() => void run(() => props.onReorder(1))}
            >
              <ArrowDown />
            </Button>
          </div>
        </fieldset>
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={props.onClose}>
            Cancelar
          </Button>
          <Button disabled={busy || !props.connected} onClick={save}>
            {busy ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
