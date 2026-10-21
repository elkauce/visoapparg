import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "convex/react";
import { Check, Loader2, PanelsTopLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MarketplacePageTemplate } from "@/convex/lib/marketplace_catalog";

/** Install an acquired native preset, preserving existing deck configuration. */
export default function MarketplacePageInstall({
  product,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
  triggerLabel = "Agregar al deck",
}: {
  product: {
    productId: string;
    title: string;
    category: string;
    pageTemplate?: MarketplacePageTemplate;
  };
  open?: boolean;
  onOpenChange?(open: boolean): void;
  showTrigger?: boolean;
  triggerLabel?: string;
}) {
  const installPage = useMutation(api.marketplace_pages.installPage);
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = (next: boolean) => {
    setLocalOpen(next);
    onOpenChange?.(next);
  };
  const [pending, setPending] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  if (product.category !== "pages" || !product.pageTemplate) return null;
  const install = async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await installPage({
        productId: product.productId,
        ...(updateExisting ? { updateExisting: true } : {}),
      });
      toast.success(
        result.updated
          ? "Aplicamos la configuración de esta versión a tu página."
          : result.existing
            ? "Esta página ya está en tu deck. Conservamos tus ajustes."
            : "La página ya está en tu deck, en la web y en la app.",
      );
      setInstalled(true);
      setOpen(false);
    } catch {
      setError(
        "No se pudo agregar la página. Comprobá la conexión y que tu deck tenga espacio disponible.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return (
    <>
      {showTrigger &&
        (installed ? (
          <Button asChild variant="outline" size="sm">
            <Link to="/deck">
              <Check /> Abrir mi deck
            </Link>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setError(null);
              setUpdateExisting(false);
              setOpen(true);
            }}
          >
            <PanelsTopLeft /> {triggerLabel}
          </Button>
        ))}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy.current) setOpen(next);
        }}
      >
        <DialogContent
          showCloseButton={!pending}
          onEscapeKeyDown={(event) => pending && event.preventDefault()}
          onPointerDownOutside={(event) => pending && event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Agregar {product.title}</DialogTitle>
            <DialogDescription>
              Se agrega al final de tu deck y aparece en todos tus dispositivos.
              Si ya la tenés, conservamos sus ajustes. Tus otras páginas no se
              reemplazan.
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={updateExisting}
              disabled={pending}
              onChange={(event) => setUpdateExisting(event.target.checked)}
              className="mt-1"
            />
            Si ya existe, reemplazar sus ajustes por los de esta versión de mi
            biblioteca.
          </label>
          {error && (
            <p role="alert" className="vm-error">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button disabled={pending} onClick={() => void install()}>
              {pending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <PanelsTopLeft />
              )}
              {pending ? "Agregando…" : "Confirmar y agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
