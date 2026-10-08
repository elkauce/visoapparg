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
  STATUS_COLORS,
  STATUS_ICON_KEYS,
} from "@/lib/status-icons.ts";
import StatusIcon from "@/components/status-icon.tsx";
import { cn } from "@/lib/utils.ts";
import type { KeyLightSetting } from "@/lib/key-light.ts";
import LightFields from "./light-fields.tsx";
import MediaField from "./media-field.tsx";
import type { DeckStatus } from "./status-key.tsx";

type StatusDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Si viene un estado se edita; si es null se crea uno nuevo
  status: DeckStatus | null;
};

export default function StatusDialog({
  open,
  onOpenChange,
  status,
}: StatusDialogProps) {
  // El contenido se monta con "key" para reiniciar el formulario al abrir
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        {open && (
          <StatusForm
            key={status?._id ?? "new"}
            status={status}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusForm({
  status,
  onDone,
}: {
  status: DeckStatus | null;
  onDone: () => void;
}) {
  const create = useMutation(api.statuses.create);
  const update = useMutation(api.statuses.update);
  const [name, setName] = useState(status?.name ?? "");
  const [color, setColor] = useState(status?.color ?? STATUS_COLORS[0]);
  const [icon, setIcon] = useState(status?.icon ?? "check-circle");
  const [light, setLight] = useState<KeyLightSetting | null>(status?.light ?? null);
  const [webhookUrl, setWebhookUrl] = useState(status?.webhookUrl ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (name.trim().length === 0) {
      toast.error("Ponle un nombre al estado");
      return;
    }
    setSaving(true);
    try {
      if (status) {
        await update({
          statusId: status._id as Id<"statuses">,
          name,
          color,
          icon,
          light,
          webhookUrl,
        });
      } else {
        await create({ name, color, icon, light, webhookUrl });
      }
      onDone();
    } catch (error) {
      const message =
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "No se pudo guardar el estado";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{status ? "Editar estado" : "Nuevo estado"}</DialogTitle>
      </DialogHeader>

      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div
            className="flex size-20 shrink-0 flex-col items-center justify-center rounded-2xl text-white"
            style={{
              backgroundColor: color,
              boxShadow: `0 0 32px -6px ${color}`,
            }}
          >
            <StatusIcon name={icon} className="size-8" strokeWidth={1.75} />
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="status-name">Nombre</Label>
            <Input
              id="status-name"
              value={name}
              maxLength={30}
              placeholder="Ej: Grabando"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Color</Label>
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Color ${swatch}`}
                onClick={() => setColor(swatch)}
                className={cn(
                  "size-8 cursor-pointer rounded-full border-2 transition-transform hover:scale-110",
                  color === swatch ? "border-foreground" : "border-transparent",
                )}
                style={{ backgroundColor: swatch }}
              />
            ))}
            <label className="relative size-8 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-muted-foreground">
              <span className="sr-only">Color personalizado</span>
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="absolute -inset-2 size-12 cursor-pointer opacity-0"
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
            {STATUS_ICON_KEYS.map((key) => {
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={key}
                  onClick={() => setIcon(key)}
                  className={cn(
                    "flex aspect-square cursor-pointer items-center justify-center rounded-lg border transition-colors",
                    icon === key
                      ? "border-primary bg-accent text-primary"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  <StatusIcon name={key} className="size-4" />
                </button>
              );
            })}
          </div>
        </div>

        {status ? (
          <MediaField
            statusId={status._id}
            mediaUrl={status.mediaUrl ?? null}
            mediaType={status.mediaType ?? null}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            Después de crear el estado podrás subirle una imagen o video para el Display.
          </p>
        )}

        <div className="space-y-4 border-t pt-4">
          <LightFields value={light} onChange={setLight} />
          <div className="space-y-2">
            <Label htmlFor="status-webhook">Aviso propio de este estado (opcional)</Label>
            <Input
              id="status-webhook"
              value={webhookUrl}
              maxLength={500}
              placeholder="https://hooks.ejemplo.com/mi-luz"
              onChange={(event) => setWebhookUrl(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Al activar este estado, VISO avisa a esta dirección además de a la de
              tus luces de la casa. Útil para una rutina de Alexa distinta por estado.
            </p>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {status ? "Guardar" : "Crear estado"}
        </Button>
      </DialogFooter>
    </>
  );
}
