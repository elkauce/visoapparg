import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

// Panel con el link público que muestra el estado a pantalla completa
export default function SharePanel() {
  const slug = useQuery(api.public_status.getMine, {});
  const ensureMine = useMutation(api.public_status.ensureMine);
  const regenerate = useMutation(api.public_status.regenerate);
  const [copied, setCopied] = useState(false);

  // Crea el link la primera vez que el usuario entra
  useEffect(() => {
    if (slug === null) {
      ensureMine({}).catch(() => toast.error("No se pudo crear tu link"));
    }
  }, [slug, ensureMine]);

  if (!slug) {
    return <Skeleton className="h-28 w-full rounded-2xl" />;
  }

  const url = `${window.location.origin}/s/${slug}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar, cópialo manualmente");
    }
  };

  const handleRegenerate = async () => {
    try {
      await regenerate({});
      toast.success("Nuevo link generado");
    } catch {
      toast.error("No se pudo generar un nuevo link");
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border bg-card/60 p-5">
      <div>
        <h2 className="font-semibold">Pantalla completa</h2>
        <p className="text-sm text-muted-foreground">
          Abre este link en cualquier pantalla (tablet, TV, puerta de tu
          oficina) y mostrará tu estado en tiempo real.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input readOnly value={url} onFocus={(e) => e.target.select()} />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleCopy}>
            {copied ? <Check /> : <Copy />}
            Copiar
          </Button>
          <Button asChild>
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLink />
              Abrir
            </a>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Generar un link nuevo"
              >
                <RefreshCw />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Generar un link nuevo?</AlertDialogTitle>
                <AlertDialogDescription>
                  El link actual dejará de funcionar en todas las pantallas
                  donde lo tengas abierto.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleRegenerate}>
                  Generar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </section>
  );
}
