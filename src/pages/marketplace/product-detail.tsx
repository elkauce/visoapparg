import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Expand,
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
  productPrice,
  type MarketGalleryItem,
  type MarketProduct,
} from "./types";
import {
  externalMarketplaceNavigation,
  marketplaceConnectionsPath,
} from "@/lib/marketplace-navigation";
import PageInstall from "./page-install";
import ProductCheckout from "./checkout";

function gallerySource(item: MarketGalleryItem): string | null {
  const local = item.builtinPath ?? item.url;
  if (
    local &&
    (local.startsWith("/marketplace/") || local.startsWith("/products/")) &&
    !local.includes("..") &&
    !local.includes("\\")
  )
    return local;
  const source = item.url ?? item.externalUrl;
  if (!source) return null;
  try {
    const parsed = new URL(source);
    const localStorage =
      item.url === source &&
      parsed.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
    return (parsed.protocol === "https:" || localStorage) &&
      !parsed.username &&
      !parsed.password
      ? source
      : null;
  } catch {
    return null;
  }
}

export default function MarketProductPage({
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
  const [expanded, setExpanded] = useState<MarketGalleryItem | null>(null);
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
  if (product === undefined)
    return (
      <section className="vm-product-page" role="status">
        <Loader2 className="animate-spin" />
        <h1>Cargando recurso…</h1>
      </section>
    );
  if (product === null)
    return (
      <section className="vm-empty">
        <Package />
        <h1>Este recurso no está disponible</h1>
        <p>Podés volver al catálogo y descubrir otras opciones.</p>
        <Button variant="outline" onClick={onClose}>
          Volver al catálogo
        </Button>
      </section>
    );
  const gallery: MarketGalleryItem[] =
    product.gallery?.filter((item) => gallerySource(item)) ?? [];
  if (!gallery.length && product.coverUrl)
    gallery.push({
      id: "cover",
      name: product.title,
      mediaType: "image",
      url: product.coverUrl,
    });
  const details = product.details;
  const facts: [string, string | undefined][] = [
    ["Tipo", details?.type ?? CATEGORY_LABELS[product.category]],
    ["Dispositivo", details?.device],
    ["Sistema operativo", details?.os],
    ["Compatibilidad", details?.compatibility],
    ["Tamaño", details?.size],
    ["Versión", details?.version],
    ["Idioma", details?.language],
    ["Contenido incluido", details?.included],
  ];
  const support = externalPurchaseUrl(details?.supportUrl);
  return (
    <article className="vm-product-page">
      <nav
        className="vm-product-breadcrumb"
        aria-label="Ubicación del producto"
      >
        <button type="button" onClick={onClose}>
          <ArrowLeft /> Marketplace
        </button>
        <ChevronRight />
        <span>{CATEGORY_LABELS[product.category]}</span>
      </nav>
      <header className="vm-product-title-row">
        <div>
          <span className="vm-product-category">
            {CATEGORY_LABELS[product.category]}
          </span>
          <h1>{product.title}</h1>
          <p className="vm-detail-creator">
            Por {product.creatorName}
            {product.builtin && (
              <span>
                <ShieldCheck aria-hidden="true" /> Original de VISO
              </span>
            )}
          </p>
        </div>
        <div className="vm-product-purchase">
          <strong className="vm-detail-price">{productPrice(product)}</strong>
          <ProductAction
            product={product}
            pending={pending}
            onAdd={() => void add()}
            onLibrary={onAcquired}
          />
        </div>
      </header>
      {error && (
        <p role="alert" className="vm-error">
          {error}
        </p>
      )}
      {!!gallery.length && (
        <section
          aria-label="Galería del producto"
          className="vm-product-gallery"
        >
          {gallery.map((item, index) => (
            <figure key={item.id} className="vm-gallery-item">
              {item.mediaType === "video" ? (
                <video
                  src={gallerySource(item)!}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={item.name || `Video ${index + 1}`}
                />
              ) : (
                <button
                  type="button"
                  className="vm-gallery-image"
                  onClick={() => setExpanded(item)}
                  aria-label={`Ampliar ${item.name || `imagen ${index + 1}`}`}
                >
                  <img
                    src={gallerySource(item)!}
                    alt={item.name || `Imagen ${index + 1} de ${product.title}`}
                    loading={index ? "lazy" : "eager"}
                  />
                  <span>
                    <Expand aria-hidden="true" />
                  </span>
                </button>
              )}
              {item.mediaType === "video" && (
                <button
                  type="button"
                  className="vm-gallery-expand"
                  onClick={() => setExpanded(item)}
                  aria-label={`Ampliar ${item.name || `video ${index + 1}`}`}
                >
                  <Expand aria-hidden="true" />
                </button>
              )}
            </figure>
          ))}
        </section>
      )}
      <div className="vm-product-information">
        <div className="vm-product-overview">
          <section>
            <h2>Descripción</h2>
            <div className="vm-product-info-card">
              <p className="vm-detail-description">{product.description}</p>
            </div>
          </section>
          {details?.setup && (
            <section>
              <h2>Cómo se usa</h2>
              <div className="vm-product-info-card vm-detail-description">
                {details.setup}
              </div>
            </section>
          )}
          {!!product.changelog?.length && (
            <section>
              <h2>Novedades e historial</h2>
              <div className="vm-product-info-card vm-version-history">
                {product.changelog.map((change, index) => (
                  <div key={`${change.version}-${index}`}>
                    <div>
                      <strong>Versión {change.version}</strong>
                      {change.date && (
                        <time dateTime={change.date}>
                          {new Date(
                            `${change.date}T12:00:00`,
                          ).toLocaleDateString("es-AR")}
                        </time>
                      )}
                    </div>
                    <p>{change.notes}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
          {product.affiliate && (
            <div className="vm-detail-notice">
              <strong>Compra en Mercado Libre</strong>
              <p>
                La compra, el pago y la entrega se completan con el vendedor en
                Mercado Libre. Consultá allí el precio y la disponibilidad
                vigentes.
              </p>
              <p className="vm-affiliate-disclosure">
                Enlace de afiliado: VISO puede recibir una comisión si comprás
                desde este enlace. VISO no agrega una comisión a esta compra.
              </p>
            </div>
          )}
          {product.priceMode === "free" &&
            ["icons", "screensavers"].includes(product.category) && (
              <p className="vm-detail-help">
                Después de agregarlo, elegí una imagen o animación desde la
                biblioteca al editar una tecla o el fondo del Display. La acción
                de la tecla se conserva.
              </p>
            )}
          {product.priceMode === "info" && (
            <p className="vm-detail-help">
              La publicación todavía no tiene un precio de venta confirmado.
            </p>
          )}
        </div>
        <aside className="vm-product-details">
          <h2>Detalles</h2>
          <dl className="vm-product-info-card">
            {facts
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            {product.assetCount > 0 && (
              <div>
                <dt>Archivos</dt>
                <dd>
                  <Image aria-hidden="true" /> {product.assetCount}{" "}
                  {product.assetCount === 1 ? "archivo" : "archivos"}
                </dd>
              </div>
            )}
            {support && (
              <div>
                <dt>Soporte</dt>
                <dd>
                  <a
                    href={support}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) =>
                      externalMarketplaceNavigation(event, support)
                    }
                  >
                    Contactar al creador <ArrowUpRight />
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </aside>
      </div>
      {expanded && (
        <Dialog open onOpenChange={(open) => !open && setExpanded(null)}>
          <DialogContent className="vm-gallery-dialog">
            <DialogHeader>
              <DialogTitle>{expanded.name || product.title}</DialogTitle>
              <DialogDescription>
                Vista completa del contenido.
              </DialogDescription>
            </DialogHeader>
            {expanded.mediaType === "video" ? (
              <video
                src={gallerySource(expanded)!}
                controls
                playsInline
                autoPlay
              />
            ) : (
              <img
                src={gallerySource(expanded)!}
                alt={expanded.name || product.title}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </article>
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
  if (product.acquired && product.delivery === "page")
    return (
      <PageInstall
        product={{
          productId: product.id,
          title: product.title,
          pageTemplate: product.pageTemplate,
          category: product.category,
        }}
      />
    );
  if (product.priceMode === "info") return null;
  if (product.priceMode === "paid")
    return product.acquired ? (
      <Button onClick={onLibrary}>
        <Check /> Ver en mi biblioteca
      </Button>
    ) : (
      <ProductCheckout product={product} />
    );
  if (product.priceMode === "external") {
    if (!external)
      return (
        <p className="vm-detail-help">
          El enlace de compra no está disponible.
        </p>
      );
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
            {product.affiliate
              ? "Ver en Mercado Libre"
              : "Comprar en el sitio del vendedor"}
            <ArrowUpRight />
          </a>
        </Button>
        <p>Continuás la compra en un sitio externo.</p>
      </div>
    );
  }
  if (product.id === "viso-stream-deck")
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
