import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuthToken } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { uploadKeyMedia } from "@/pages/deck/_lib/upload-media";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
export default function DisplayBackgroundSettings() {
  const background = useQuery(api.display.getBackground, {});
  const set = useMutation(api.display.setBackground);
  const clear = useMutation(api.display.clearBackground);
  const token = useAuthToken();
  const [busy, setBusy] = useState(false);
  const [fit, setFit] = useState<"cover" | "contain">("contain");
  const [show, setShow] = useState(true);
  useEffect(() => {
    if (background) {
      setFit(background.fit);
      setShow(background.showStatus);
    }
  }, [background]);
  const change = async (nextFit: "cover" | "contain", nextShow: boolean) => {
    setFit(nextFit);
    setShow(nextShow);
    if (!background) return;
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
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3 border-t pt-4">
      <h3 className="font-semibold">Imagen o video del Display</h3>
      <p className="text-sm text-muted-foreground">
        Tu marca en todas las pantallas vinculadas, independientemente de la
        tecla activa. Imagen o video MP4/WebM de hasta 60 MB.
      </p>
      {background?.mediaUrl &&
        (background.mediaType === "video" ? (
          <video
            src={background.mediaUrl}
            muted
            autoPlay
            loop
            playsInline
            className="h-40 w-full rounded-xl bg-black object-contain"
          />
        ) : (
          <img
            src={background.mediaUrl}
            alt="Fondo del Display"
            className="h-40 w-full rounded-xl bg-black object-contain"
          />
        ))}
      <label className="block text-sm">
        Ajuste de imagen{" "}
        <select
          aria-label="Ajuste del fondo del Display"
          disabled={busy || background === undefined}
          value={fit}
          className="ml-2 rounded border bg-background p-2"
          onChange={(e) =>
            void change(
              e.target.value as "cover" | "contain",
              background?.showStatus ?? show,
            )
          }
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
          onChange={(e) =>
            void change(background?.fit ?? fit, e.target.checked)
          }
        />
        Mostrar estado sobre el fondo
      </label>
      <label className="block text-sm">
        Subir imagen o video
        <input
          aria-label="Archivo del Display"
          className="mt-2 block w-full text-sm"
          type="file"
          accept="image/*,video/mp4,video/webm"
          disabled={busy || background === undefined}
          onChange={async (e) => {
            const input = e.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            setBusy(true);
            try {
              const uploaded = await uploadKeyMedia(file, token);
              await set({
                storageId: uploaded.storageId,
                fit: background?.fit ?? fit,
                showStatus: background?.showStatus ?? show,
              });
              toast.success("Fondo del Display guardado");
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "No se pudo guardar",
              );
            } finally {
              setBusy(false);
              input.value = "";
            }
          }}
        />
      </label>
      {busy && (
        <p role="status" className="text-sm">
          Guardando…
        </p>
      )}
      {background && (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await clear({});
              toast.success("Fondo del Display eliminado");
            } catch {
              toast.error("No se pudo eliminar el fondo");
            } finally {
              setBusy(false);
            }
          }}
        >
          Quitar fondo del Display
        </Button>
      )}
    </div>
  );
}
