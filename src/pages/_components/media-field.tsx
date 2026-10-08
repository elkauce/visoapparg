import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";

const MAX_BYTES = 60 * 1024 * 1024;

type MediaFieldProps = {
  statusId: string;
  mediaUrl: string | null;
  mediaType: "image" | "video" | null;
};

// Sube imagen, PNG o video del estado. Solo existe al editar (el estado ya debe existir)
export default function MediaField({ statusId, mediaUrl, mediaType }: MediaFieldProps) {
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  const setMedia = useMutation(api.media.setMedia);
  const clearMedia = useMutation(api.media.clearMedia);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const id = statusId as Id<"statuses">;

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast.error("Elige una imagen, PNG o video");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("El archivo pesa más de 60 MB");
      return;
    }
    setBusy(true);
    try {
      const uploadUrl = await generateUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) {
        throw new Error("upload");
      }
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
      await setMedia({ statusId: id, storageId });
      toast.success("Archivo guardado");
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "No se pudo subir el archivo",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleClear = async () => {
    setBusy(true);
    try {
      await clearMedia({ statusId: id });
    } catch {
      toast.error("No se pudo quitar el archivo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Fondo del Display (opcional)</Label>
      {mediaUrl && (
        <div className="overflow-hidden rounded-xl border bg-black">
          {mediaType === "video" ? (
            <video src={mediaUrl} muted loop autoPlay playsInline className="h-32 w-full object-cover" />
          ) : (
            <img src={mediaUrl} alt="Fondo del estado" className="h-32 w-full object-cover" />
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              void handleFile(file);
            }
          }}
        />
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Spinner /> : <ImagePlus />}
          {mediaUrl ? "Cambiar archivo" : "Subir imagen o video"}
        </Button>
        {mediaUrl && (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={handleClear}>
            <Trash2 /> Quitar
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Imagen, PNG o video (hasta 60 MB). Se muestra a pantalla completa en tu
        Display cuando este estado esté activo.
      </p>
    </div>
  );
}
