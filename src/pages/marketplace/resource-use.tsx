import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { ArrowUpRight, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { marketplaceConnectionsPath } from "@/lib/marketplace-navigation";
import { LibraryAsset } from "./library-asset";
import PageInstall from "./page-install";
import { marketplaceResourceUsage } from "./resource-usage";

export function ResourceUsage({
  product,
}: {
  product: Parameters<typeof marketplaceResourceUsage>[0];
}) {
  const usage = marketplaceResourceUsage(product);
  return (
    <div className="vm-resource-usage">
      <strong>{usage.kind}</strong>
      <p>{usage.description}</p>
      <p>
        <b>Dónde se usa:</b> {usage.destination}
      </p>
      <p className="text-sm text-muted-foreground">{usage.requirements}</p>
    </div>
  );
}

export function MarketplaceUseButton({
  productId,
  label = "Usar",
}: {
  productId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <WandSparkles /> {label}
      </Button>
      <MarketplaceUseDialog
        productId={productId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

/** Read the acquired snapshot, rather than a later seller revision. */
export function MarketplaceUseDialog({
  productId,
  open,
  onOpenChange,
}: {
  productId: string;
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const entries = useQuery(api.marketplace.library, open ? {} : "skip");
  const entry = entries?.find((item) => item.productId === productId);
  const installProfile = useMutation(api.marketplace.installProfile);
  const [busy, setBusy] = useState(false);
  const applying = useRef(false);
  const [error, setError] = useState<string | null>(null);
  if (entry?.delivery === "page" && entry.pageTemplate)
    return (
      <PageInstall
        key={`${entry.productId}:${entry.revision}`}
        product={entry}
        open={open}
        onOpenChange={onOpenChange}
        showTrigger={false}
      />
    );
  const applyProfile = async () => {
    if (applying.current || !entry) return;
    applying.current = true;
    setBusy(true);
    setError(null);
    try {
      await installProfile({ productId });
      toast.success(
        "Agregamos el perfil a tu Deck. Tus otras páginas se conservan.",
      );
      onOpenChange(false);
    } catch {
      setError(
        "No se pudo agregar el perfil. Comprobá la conexión y el espacio disponible en tu Deck.",
      );
    } finally {
      applying.current = false;
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) {
          setError(null);
          onOpenChange(next);
        }
      }}
    >
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>
            {entry ? `Usar ${entry.title}` : "Usar recurso"}
          </DialogTitle>
          <DialogDescription>
            Elegí dónde usarlo. El recurso queda guardado en tu biblioteca.
          </DialogDescription>
        </DialogHeader>
        {entries === undefined ? (
          <p role="status">Consultando tu biblioteca…</p>
        ) : !entry ? (
          <p role="alert">Obtené este recurso antes de usarlo.</p>
        ) : (
          <>
            <ResourceUsage product={entry} />
            {entry.profileTemplate === "essential" ? (
              <DialogFooter>
                <Button disabled={busy} onClick={() => void applyProfile()}>
                  {busy ? "Agregando…" : "Confirmar y agregar página"}
                </Button>
              </DialogFooter>
            ) : entry.productId === "viso-stream-deck" ? (
              <Button asChild>
                <Link to={marketplaceConnectionsPath()}>
                  Descargar mi plugin configurado <ArrowUpRight />
                </Link>
              </Button>
            ) : (
              <div className="vm-asset-grid">
                {entry.assets.map((asset) => (
                  <LibraryAsset
                    key={`${entry.revision ?? 1}:${asset.id}`}
                    asset={asset}
                    product={entry}
                  />
                ))}
              </div>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="vm-error">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
