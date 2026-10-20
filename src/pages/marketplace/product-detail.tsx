import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowUpRight,
  Check,
  Image,
  Library,
  Loader2,
  Package,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CATEGORY_LABELS,
  externalPurchaseUrl,
  type MarketProduct,
} from "./types";
import {
  externalMarketplaceNavigation,
  marketplaceConnectionsPath,
} from "@/lib/marketplace-navigation";

export default function MarketProductDialog({
  productId,
  onClose,
  onAcquired,
}: {
  productId: string;
  onClose: () => void;
  onAcquired: () => void;
}) {
  const product = useQuery(api.marketplace.get, { productId });
  const acquire = useMutation(api.marketplace.acquire);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const add = async () => {
    if (!product || product.priceMode !== "free" || busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await acquire({ productId: product.id });
      toast.success("Listo. El recurso ya está en tu biblioteca.");
      onAcquired();
    } catch {
      setError("No pudimos agregar el recurso. Volvé a intentarlo.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy.current && onClose()}>
      <DialogContent
        className="vm-product-dialog"
        showCloseButton={!pending}
        onEscapeKeyDown={(event) => pending && event.preventDefault()}
        onPointerDownOutside={(event) => pending && event.preventDefault()}
      >
        {product === undefined ? (
          <DialogHeader>
            <DialogTitle>Cargando recurso…</DialogTitle>
            <DialogDescription>Buscando sus detalles.</DialogDescription>
          </DialogHeader>
        ) : product === null ? (
          <>
            <DialogHeader>
              <DialogTitle>Este recurso no está disponible</DialogTitle>
              <DialogDescription>
                Podés volver al catálogo y descubrir otras opciones.
              </DialogDescription>
            </DialogHeader>
            <Button variant="outline" onClick={onClose}>
              Volver al catálogo
            </Button>
          </>
        ) : (
          <>
            <div
              className={`vm-detail-cover${product.category === "hardware" ? " vm-hardware-cover" : ""}`}
            >
              {product.coverUrl ? (
                <img src={product.coverUrl} alt="" />
              ) : (
                <Package aria-hidden="true" />
              )}
            </div>
            <div className="vm-detail-body">
              <DialogHeader>
                <span className="vm-product-category">
                  {CATEGORY_LABELS[product.category]}
                </span>
                <DialogTitle>{product.title}</DialogTitle>
                <DialogDescription className="vm-detail-creator">
                  Por {product.creatorName}
                  {product.builtin && (
                    <span>
                      <ShieldCheck aria-hidden="true" /> Original de VISO
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <p className="vm-detail-description">{product.description}</p>
              {product.assetCount > 0 && (
                <div className="vm-detail-facts">
                  <span>
                    <Image aria-hidden="true" /> {product.assetCount}{" "}
                    {product.assetCount === 1 ? "archivo" : "archivos"}
                  </span>
                  {product.priceMode === "free" && (
                    <span>
                      <Check aria-hidden="true" /> Recurso gratuito
                    </span>
                  )}
                </div>
              )}
              {product.category === "used" && (
                <div className="vm-detail-notice">
                  <strong>Una oportunidad seleccionada por VISO</strong>
                  <p>
                    La compra se realiza en Mercado Libre con el vendedor de la
                    publicación. Consultá allí el precio, estado y
                    disponibilidad.
                  </p>
                </div>
              )}
              {product.affiliate && (
                <p className="vm-affiliate-disclosure">
                  Enlace de afiliado: VISO puede recibir una comisión si comprás
                  desde este enlace.
                </p>
              )}
              {product.priceMode === "info" && (
                <div className="vm-detail-notice">
                  <strong>Conocé el equipo</strong>
                  <p>
                    Esta ficha presenta el producto. Las opciones de compra
                    aparecerán aquí cuando VISO las publique.
                  </p>
                </div>
              )}
              <ProductAction
                product={product}
                pending={pending}
                onAdd={() => void add()}
                onLibrary={onAcquired}
              />
              {error && (
                <p role="alert" className="vm-error">
                  {error}
                </p>
              )}
              {product.priceMode === "free" && product.category === "icons" && (
                <p className="vm-detail-help">
                  Después de agregarlo, elegí una imagen o animación desde el
                  editor de una tecla. Su acción se conserva.
                </p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProductAction({
  product,
  pending,
  onAdd,
  onLibrary,
}: {
  product: MarketProduct;
  pending: boolean;
  onAdd: () => void;
  onLibrary: () => void;
}) {
  const external = externalPurchaseUrl(product.externalUrl);
  if (product.priceMode === "info") return null;
  if (product.priceMode === "external") {
    if (!external) {
      return (
        <p className="vm-detail-help">
          El enlace de compra no está disponible.
        </p>
      );
    }
    return (
      <div className="vm-detail-actions">
        <Button asChild>
          <a
            href={external}
            onClick={(event) => externalMarketplaceNavigation(event, external)}
            target="_blank"
            rel={
              product.affiliate
                ? "noopener noreferrer nofollow sponsored"
                : "noopener noreferrer nofollow"
            }
          >
            {product.category === "used" || product.affiliate
              ? "Ver en Mercado Libre"
              : product.category === "hardware"
                ? "Ver producto en la tienda"
                : "Comprar en el sitio del creador"}
            <ArrowUpRight />
          </a>
        </Button>
        <p>Continuás la compra en un sitio externo.</p>
      </div>
    );
  }
  if (product.id === "viso-stream-deck") {
    return (
      <div className="vm-detail-actions">
        <Button asChild>
          <Link to={marketplaceConnectionsPath()}>
            Descargar mi plugin <ArrowUpRight />
          </Link>
        </Button>
        {!product.acquired && (
          <Button variant="outline" disabled={pending} onClick={onAdd}>
            {pending ? <Loader2 className="animate-spin" /> : <Library />}
            Guardar en mi biblioteca
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="vm-detail-actions">
      {product.acquired ? (
        <Button onClick={onLibrary}>
          <Check /> Ver en mi biblioteca
        </Button>
      ) : (
        <Button disabled={pending} onClick={onAdd}>
          {pending ? <Loader2 className="animate-spin" /> : <Library />}
          {pending ? "Agregando…" : "Agregar a mi biblioteca"}
        </Button>
      )}
    </div>
  );
}
