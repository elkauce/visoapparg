import { useRef, useState } from "react";
import { useAuthToken } from "@convex-dev/auth/react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Monitor } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { uploadBuiltinKeyMedia } from "@/pages/deck/_lib/upload-media";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type VisualAsset = {
  id: string;
  name: string;
  mediaType: string;
  builtinPath?: string;
  url?: string | null;
};

/** Apply a library resource through the same owned-media pipeline as a file.
 * Opening a preview never modifies the current Display or its signaling. */
export default function MarketplaceDisplayApply({
  productId,
  asset,
}: {
  productId: string;
  asset: VisualAsset;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showStatus, setShowStatus] = useState<boolean | null>(null);
  const [fit, setFit] = useState<"cover" | "contain" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const copy = useRef<{
    storageId: Id<"_storage">;
    mediaType: "image" | "video";
  } | null>(null);
  const token = useAuthToken();
  const background = useQuery(api.display.getBackground, open ? {} : "skip");
  const copyAsset = useAction(api.marketplace.copyAssetToDeck);
  const setBackground = useMutation(api.display.setBackground);
  if (asset.mediaType !== "image" && asset.mediaType !== "video") return null;
  const preview = asset.builtinPath ?? asset.url;
  const apply = async () => {
    if (pending.current || background === undefined) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!copy.current) {
        copy.current = asset.builtinPath
          ? await uploadBuiltinKeyMedia(
              { builtinPath: asset.builtinPath, name: asset.name },
              token,
            )
          : await copyAsset({ productId, assetId: asset.id });
      }
      await setBackground({
        storageId: copy.current.storageId,
        fit: fit ?? background?.fit ?? "cover",
        showStatus: showStatus ?? background?.showStatus ?? true,
      });
      toast.success("El recurso ya se ve en tu Display.");
      setOpen(false);
    } catch {
      setError(
        "No se pudo aplicar el recurso. Tu fondo anterior se conserva; intentá de nuevo.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        setError(null);
      }}
    >
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Monitor className="size-4" /> Usar en Display
      </Button>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto"
        showCloseButton={!busy}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Usar en tu Display</DialogTitle>
          <DialogDescription>
            {asset.name}. Reemplaza el fondo del Display; tus teclas y estados
            se conservan.
          </DialogDescription>
        </DialogHeader>
        {preview && (
          <div className="aspect-video overflow-hidden rounded-xl bg-black">
            {asset.mediaType === "video" ? (
              <video
                src={preview}
                muted
                autoPlay
                loop
                playsInline
                className="size-full object-cover"
                aria-label={`Vista previa de ${asset.name}`}
              />
            ) : (
              <img
                src={preview}
                alt={`Vista previa de ${asset.name}`}
                className="size-full object-cover"
              />
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor={`market-display-status-${asset.id}`}>
            Mostrar mi estado sobre el fondo
          </Label>
          <Switch
            id={`market-display-status-${asset.id}`}
            checked={showStatus ?? background?.showStatus ?? true}
            disabled={busy || background === undefined}
            onCheckedChange={setShowStatus}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`market-display-fit-${asset.id}`}>
            Ajuste de la imagen
          </Label>
          <select
            id={`market-display-fit-${asset.id}`}
            value={fit ?? background?.fit ?? "cover"}
            disabled={busy || background === undefined}
            onChange={(event) =>
              setFit(event.target.value as "cover" | "contain")
            }
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
          >
            <option value="cover">Llenar la pantalla</option>
            <option value="contain">Mostrar completa</option>
          </select>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            disabled={busy || background === undefined}
            onClick={() => void apply()}
          >
            {busy ? "Aplicando…" : "Aplicar al Display"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
