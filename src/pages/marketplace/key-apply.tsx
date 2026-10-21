import { useRef, useState } from "react";
import { useAuthToken } from "@convex-dev/auth/react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import DeckKey from "@/pages/deck/_components/deck-key";
import { resolveKeyFace } from "@/pages/deck/_lib/resolve-key";
import { uploadBuiltinKeyMedia } from "@/pages/deck/_lib/upload-media";
import { assetSource, type MarketAsset } from "./types";

export default function MarketplaceKeyApply({
  productId,
  asset,
}: {
  productId: string;
  asset: MarketAsset;
}) {
  const [open, setOpen] = useState(false);
  const [keyId, setKeyId] = useState<string>("");
  const [expectedMedia, setExpectedMedia] = useState<Id<"_storage"> | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const copied = useRef<Id<"_storage"> | null>(null);
  const token = useAuthToken();
  const layout = useQuery(
    api.deck_layout.get,
    open ? { unified: true } : "skip",
  );
  const statuses = useQuery(api.statuses.list, open ? {} : "skip");
  const copyAsset = useAction(api.marketplace.copyAssetToDeck);
  const applyMedia = useMutation(api.marketplace_apply.applyKeyMedia);
  const pages =
    layout?.pages.filter((page) => !page.kind || page.kind === "grid") ?? [];
  const keys =
    layout?.keys.filter((key) =>
      pages.some((page) => page._id === key.pageId),
    ) ?? [];
  const selected = keys.find((key) => key._id === keyId);
  const faceFor = (key: (typeof keys)[number]) =>
    resolveKeyFace(
      key.content,
      statuses?.statuses ?? [],
      null,
      layout?.volume ?? 0,
      key.appearance,
    );
  const selectedFace = selected ? faceFor(selected) : null;
  const source = assetSource(asset);
  const apply = async () => {
    if (pending.current || !selected || !source) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!copied.current) {
        const copy = asset.builtinPath
          ? await uploadBuiltinKeyMedia(
              {
                builtinPath: asset.builtinPath,
                name: asset.name,
                mimeType: asset.mimeType,
              },
              token,
            )
          : await copyAsset({ productId, assetId: asset.id });
        copied.current = copy.storageId;
      }
      await applyMedia({
        productId,
        assetId: asset.id,
        keyId: selected._id,
        storageId: copied.current,
        expectedMediaStorageId: expectedMedia,
      });
      toast.success(
        "La imagen de tu tecla ya está actualizada en la web y en la app.",
      );
      setOpen(false);
    } catch (failure) {
      const data =
        failure && typeof failure === "object" && "data" in failure
          ? failure.data
          : null;
      setError(
        typeof data === "string"
          ? data
          : "No se pudo aplicar el recurso. Tu tecla conserva su configuración; revisá la conexión e intentá de nuevo.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setKeyId("");
          setError(null);
          setOpen(true);
        }}
      >
        <ImagePlus /> Usar en una tecla
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!pending.current) setOpen(next);
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto"
          showCloseButton={!busy}
          onEscapeKeyDown={(event) => busy && event.preventDefault()}
          onPointerDownOutside={(event) => busy && event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Usar en una tecla</DialogTitle>
            <DialogDescription>
              Elegí dónde aplicar {asset.name}. Se reemplaza la imagen de esa
              tecla; su nombre, acción y color se conservan.
            </DialogDescription>
          </DialogHeader>
          {layout === undefined || statuses === undefined ? (
            <p role="status">Cargando tus teclas…</p>
          ) : !keys.length ? (
            <p>
              Creá una tecla en el editor del Deck para aplicar este recurso.
            </p>
          ) : (
            <>
              <label className="space-y-2 text-sm">
                Tecla de destino
                <select
                  className="w-full rounded-lg border bg-background p-3"
                  value={keyId}
                  disabled={busy}
                  onChange={(event) => {
                    const key = keys.find(
                      (item) => item._id === event.target.value,
                    );
                    setKeyId(event.target.value);
                    setExpectedMedia(key?.appearance?.mediaStorageId ?? null);
                    setError(null);
                  }}
                >
                  <option value="">Elegí una tecla</option>
                  {keys.map((key) => (
                    <option key={key._id} value={key._id}>
                      {pages.find((page) => page._id === key.pageId)?.name} ·{" "}
                      {faceFor(key)?.label ?? `Tecla ${key.position + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              {selected && source && (
                <div
                  className="vm-key-preview"
                  aria-label="Vista previa de la tecla"
                >
                  <DeckKey
                    face={{
                      label: selectedFace?.label ?? "Tecla",
                      icon: selectedFace?.icon ?? "check",
                      color: selectedFace?.color ?? "#22c55e",
                      active: false,
                      ...selectedFace,
                      mediaUrl: source,
                      mediaType:
                        asset.mediaType === "video" ? "video" : "image",
                    }}
                    editMode={false}
                    onPress={() => undefined}
                  />
                </div>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="vm-error">
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
              disabled={busy || !selected || !source}
              onClick={() => void apply()}
            >
              {busy ? "Aplicando…" : "Aplicar a esta tecla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
