import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuthToken } from "@convex-dev/auth/react";
import { FolderOpen, Library } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { uploadKeyMedia } from "@/pages/deck/_lib/upload-media";
import KeyAssetPicker, {
  type KeyLibrarySelection,
} from "@/components/marketplace/key-asset-picker";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function DisplayBackgroundSettings() {
  const background = useQuery(api.display.getBackground, {});
  const set = useMutation(api.display.setBackground);
  const clear = useMutation(api.display.clearBackground);
  const token = useAuthToken();
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<"file" | "library">("file");
  const [selected, setSelected] = useState<KeyLibrarySelection | null>(null);
  const [options, setOptions] = useState<{
    fit: "cover" | "contain";
    showStatus: boolean;
  } | null>(null);
  const fit = options?.fit ?? background?.fit ?? "contain";
  const show = options?.showStatus ?? background?.showStatus ?? true;
  const pending = useRef(false);
  const copied = useRef<{ id: string; storageId: Id<"_storage"> } | null>(null);

  const change = async (nextFit: "cover" | "contain", nextShow: boolean) => {
    if (pending.current) return;
    setOptions({ fit: nextFit, showStatus: nextShow });
    // A library choice is a preview until the user confirms it.
    if (!background || selected) return;
    pending.current = true;
    setBusy(true);
    try {
      await set({
        storageId: background.mediaStorageId,
        fit: nextFit,
        showStatus: nextShow,
      });
    } catch {
      toast.error("No se pudo actualizar el Display");
    } finally {
      setOptions(null);
      pending.current = false;
      setBusy(false);
    }
  };

  const applyLibrary = async () => {
    if (!selected || pending.current || background === undefined) return;
    pending.current = true;
    setBusy(true);
    try {
      if (copied.current?.id !== selected.id) {
        const media = await selected.load(token);
        copied.current = { id: selected.id, storageId: media.storageId };
      }
      await set({ storageId: copied.current.storageId, fit, showStatus: show });
      setSelected(null);
      setOptions(null);
      copied.current = null;
      toast.success("Fondo del Display guardado");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo aplicar el recurso. Tu fondo anterior se conserva.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const preview = selected
    ? { mediaUrl: selected.previewUrl, mediaType: selected.mediaType }
    : background;

  return (
    <section className="space-y-3 border-t pt-4" aria-label="Fondo del Display">
      <h3 className="font-semibold">Imagen, GIF o video del Display</h3>
      <p className="text-sm text-muted-foreground">
        Elegí tus archivos o los recursos de tu biblioteca. El fondo se comparte
        con los Displays vinculados a tu cuenta. Hasta 60 MB por archivo.
      </p>
      <div className="flex flex-wrap gap-2" aria-label="Origen del fondo">
        <Button
          variant={source === "file" ? "secondary" : "outline"}
          size="sm"
          aria-pressed={source === "file"}
          disabled={busy}
          onClick={() => setSource("file")}
        >
          <FolderOpen className="size-4" /> Mis archivos
        </Button>
        <Button
          variant={source === "library" ? "secondary" : "outline"}
          size="sm"
          aria-pressed={source === "library"}
          disabled={busy}
          onClick={() => setSource("library")}
        >
          <Library className="size-4" /> Biblioteca
        </Button>
      </div>
      {source === "library" && (
        <div className="rounded-xl border p-3" inert={busy || undefined}>
          <KeyAssetPicker
            purpose="display"
            onSelect={(selection) => {
              if (pending.current) return;
              setSelected(selection);
              setOptions({ fit, showStatus: show });
              copied.current = null;
            }}
          />
        </div>
      )}
      {preview?.mediaUrl &&
        (preview.mediaType === "video" ? (
          <video
            src={preview.mediaUrl}
            aria-label={selected ? `Vista previa de ${selected.name}` : "Fondo actual del Display"}
            muted
            autoPlay
            loop
            playsInline
            className="h-40 w-full rounded-xl bg-black object-contain"
          />
        ) : (
          <img
            src={preview.mediaUrl}
            alt={selected ? `Vista previa de ${selected.name}` : "Fondo del Display"}
            className="h-40 w-full rounded-xl bg-black object-contain"
          />
        ))}
      {selected && (
        <p className="text-sm font-medium">
          Seleccionado: {selected.name}. Confirmá para cambiar el fondo.
        </p>
      )}
      <label className="block text-sm">
        Ajuste de imagen{" "}
        <select
          aria-label="Ajuste del fondo del Display"
          disabled={busy || background === undefined}
          value={fit}
          className="ml-2 rounded border bg-background p-2"
          onChange={(event) => void change(event.target.value as "cover" | "contain", show)}
        >
          <option value="contain">Ver completo, sin recortar</option>
          <option value="cover">Cubrir toda la pantalla</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          disabled={busy || background === undefined}
          checked={show}
          onChange={(event) => void change(fit, event.target.checked)}
        />
        Mostrar estado sobre el fondo
      </label>
      {source === "file" && (
        <label className="block text-sm">
          Subir imagen, GIF o video
          <input
            aria-label="Archivo del Display"
            className="mt-2 block w-full text-sm"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/webm"
            disabled={busy || background === undefined}
            onChange={async (event) => {
              const input = event.currentTarget;
              const file = input.files?.[0];
              if (!file || pending.current) return;
              pending.current = true;
              setBusy(true);
              try {
                const uploaded = await uploadKeyMedia(file, token);
                await set({ storageId: uploaded.storageId, fit, showStatus: show });
                setSelected(null);
                setOptions(null);
                copied.current = null;
                toast.success("Fondo del Display guardado");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "No se pudo guardar");
              } finally {
                pending.current = false;
                setBusy(false);
                input.value = "";
              }
            }}
          />
        </label>
      )}
      {selected && (
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || background === undefined} onClick={() => void applyLibrary()}>
            {busy ? "Aplicando…" : "Aplicar al Display"}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setSelected(null);
              setOptions(null);
              copied.current = null;
            }}
          >
            Cancelar selección
          </Button>
        </div>
      )}
      {busy && <p role="status" className="text-sm">Guardando…</p>}
      {background && (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            if (pending.current) return;
            pending.current = true;
            setBusy(true);
            try {
              await clear({});
              setSelected(null);
              setOptions(null);
              copied.current = null;
              toast.success("Fondo del Display eliminado");
            } catch {
              toast.error("No se pudo eliminar el fondo");
            } finally {
              pending.current = false;
              setBusy(false);
            }
          }}
        >
          Quitar fondo del Display
        </Button>
      )}
    </section>
  );
}
