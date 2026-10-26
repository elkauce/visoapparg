import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  Library,
  Loader2,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { externalMarketplaceNavigation } from "@/lib/marketplace-navigation";
import { marketErrorMessage } from "@/lib/marketplace-upload";
import { useShopping } from "./use-shopping";
import ProductCheckout from "./checkout";
import { externalPurchaseUrl, productPrice } from "./types";

export default function StoreCart() {
  const shopping = useShopping();
  const acquire = useMutation(api.marketplace.acquire);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const navigate = useNavigate();
  const items = shopping?.cart ?? [];
  const resources = items.filter(
    (x) => x.product?.priceMode === "free" && !x.product.acquired,
  );
  const purchasable = items.filter(
    (x) => x.product && !x.product.acquired && x.product.priceMode !== "free",
  );
  const totals = new Map<string, number>();
  for (const { product: p } of purchasable) {
    if (p?.priceMode === "paid" && Number.isSafeInteger(p.priceAmount))
      totals.set(
        p.currency ?? "ARS",
        (totals.get(p.currency ?? "ARS") ?? 0) + p.priceAmount!,
      );
  }
  async function getFree() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    let acquired = 0;
    try {
      for (const item of resources) {
        await acquire({ productId: item.productId });
        await shopping?.set(item.productId, "cart", false);
        acquired++;
      }
      toast.success("Tus recursos ya están en la biblioteca.");
      navigate("/marketplace?view=library");
    } catch (e) {
      toast.error(
        marketErrorMessage(
          e,
          `Se agregaron ${acquired} recursos. Revisá la conexión para continuar.`,
        ),
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  if (shopping?.loading) return <p role="status">Cargando tu carrito…</p>;
  return (
    <section>
      <header className="vm-store-heading">
        <div>
          <h1>Tu carrito</h1>
          <p>
            {items.length} {items.length === 1 ? "producto" : "productos"}
          </p>
        </div>
      </header>
      {!items.length ? (
        <div className="vm-empty">
          <ShoppingCart />
          <h2>Tu carrito está esperando ideas</h2>
          <p>Explorá el catálogo y guardá lo que te guste.</p>
          <Button asChild>
            <Link to="/marketplace">Explorar productos</Link>
          </Button>
        </div>
      ) : (
        <div className="vm-cart-layout">
          <div className="vm-cart-items">
            {items.map(({ productId, product: p }) => (
              <article key={productId} className="vm-cart-item">
                <div className="vm-cart-item-content">
                  {p?.coverUrl && <img src={p.coverUrl} alt="" />}
                  <div>
                    <Link
                      to={`/marketplace/products/${encodeURIComponent(productId)}`}
                    >
                      <h2>{p?.title ?? "Producto no disponible"}</h2>
                    </Link>
                    <p>{p?.creatorName}</p>
                    {p && <strong>{productPrice(p)}</strong>}
                    {p?.affiliate && (
                      <small>Compra externa · Mercado Libre</small>
                    )}
                    {p?.acquired && (
                      <small>
                        <Check /> En tu biblioteca
                      </small>
                    )}
                  </div>
                </div>
                <div className="vm-cart-actions">
                  <button
                    aria-label={`Quitar ${p?.title ?? "producto no disponible"} del carrito`}
                    onClick={() => void shopping?.set(productId, "cart", false)}
                  >
                    <Trash2 /> Quitar
                  </button>
                  {p && !p.acquired && p.priceMode !== "free" && (
                    <Button asChild size="sm">
                      <Link
                        to={`/marketplace?view=checkout&checkout=${encodeURIComponent(productId)}`}
                      >
                        {p.priceMode === "external"
                          ? "Ver compra externa"
                          : "Continuar compra"}
                        <ArrowRight />
                      </Link>
                    </Button>
                  )}
                  {p?.acquired && (
                    <Link to="/marketplace?view=library">Usar recurso</Link>
                  )}
                </div>
              </article>
            ))}
          </div>
          <aside className="vm-cart-summary">
            <h2>Resumen</h2>
            {[...totals].map(([currency, amount]) => (
              <p key={currency}>
                Productos en {currency}
                <strong>
                  {new Intl.NumberFormat("es-AR", {
                    style: "currency",
                    currency,
                  }).format(amount / 100)}
                </strong>
              </p>
            ))}
            {!!resources.length && (
              <p>
                Recursos gratuitos<strong>{resources.length}</strong>
              </p>
            )}
            {!!purchasable.length && (
              <p className="vm-small-help">
                Cada producto se compra a su vendedor. Los enlaces externos se
                pagan en la tienda de destino.
              </p>
            )}
            {!!resources.length && (
              <Button disabled={pending} onClick={() => void getFree()}>
                {pending ? <Loader2 className="animate-spin" /> : <Library />}
                {pending ? "Agregando…" : "Agregar gratuitos a mi biblioteca"}
              </Button>
            )}
            {purchasable[0] && (
              <Button
                variant={resources.length ? "outline" : "default"}
                asChild
              >
                <Link
                  to={`/marketplace?view=checkout&checkout=${encodeURIComponent(purchasable[0].productId)}`}
                >
                  Continuar compra
                  <ArrowRight />
                </Link>
              </Button>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
export function StoreCheckout({ productId }: { productId: string }) {
  const product = useQuery(api.marketplace.get, { productId });
  if (product === undefined) return <p role="status">Preparando tu compra…</p>;
  if (!product)
    return (
      <div className="vm-empty">
        <h1>Este producto no está disponible</h1>
        <Link to="/marketplace?view=cart">Volver al carrito</Link>
      </div>
    );
  const external = externalPurchaseUrl(product.externalUrl);
  return (
    <section className="vm-checkout-page">
      <Link className="vm-text-back" to="/marketplace?view=cart">
        <ArrowLeft /> Tu carrito
      </Link>
      <header className="vm-store-heading">
        <div>
          <h1>Revisá tu compra</h1>
          <p>El precio se confirma antes de continuar al pago.</p>
        </div>
      </header>
      <div className="vm-checkout-summary">
        {product.coverUrl && <img src={product.coverUrl} alt="" />}
        <div>
          <h2>{product.title}</h2>
          <p>{product.creatorName}</p>
          <strong>{productPrice(product)}</strong>
        </div>
      </div>
      {product.acquired ? (
        <Button asChild>
          <Link to="/marketplace?view=library">
            Ya está en tu biblioteca <Library />
          </Link>
        </Button>
      ) : product.priceMode === "paid" ? (
        <ProductCheckout product={product} />
      ) : product.priceMode === "external" && external ? (
        <div className="vm-external-purchase">
          <h2>
            {product.affiliate
              ? "Continuás en Mercado Libre"
              : "Continuás con el vendedor"}
          </h2>
          <p>
            Consultá allí el precio final, la disponibilidad, la entrega y la
            garantía.
          </p>
          {product.affiliate && (
            <p>
              Enlace de afiliado: VISO puede recibir una comisión. No agregamos
              un cargo a tu compra.
            </p>
          )}
          <Button asChild>
            <a
              href={external}
              target="_blank"
              rel={
                product.affiliate
                  ? "noopener noreferrer nofollow sponsored"
                  : "noopener noreferrer nofollow"
              }
              onClick={(e) => externalMarketplaceNavigation(e, external)}
            >
              Continuar compra <ExternalLink />
            </a>
          </Button>
        </div>
      ) : (
        <Button asChild>
          <Link to={`/marketplace/products/${encodeURIComponent(productId)}`}>
            Abrir producto
            <ArrowRight />
          </Link>
        </Button>
      )}
    </section>
  );
}
