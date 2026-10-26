import { Link } from "react-router-dom";
import { useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { CreditCard, Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { isAndroidNative } from "@/lib/android-native";
import { openMarketplaceAsset } from "@/lib/marketplace-navigation";
import { marketErrorMessage } from "@/lib/marketplace-upload";
import type { MarketProduct } from "./types";

export default function ProductCheckout({
  product,
}: {
  product: MarketProduct;
}) {
  const configuration = useQuery(api.marketplace_payments.configuration, {});
  const createCheckout = useAction(api.marketplace_payments.createCheckout);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  if (product.priceMode !== "paid") return null;
  const physical = ["hardware", "new", "used"].includes(product.category);
  async function buy() {
    if (busy.current || !configuration?.enabled || physical) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await createCheckout({ productId: product.id });
      if (isAndroidNative()) await openMarketplaceAsset(result.checkoutUrl);
      else window.location.assign(result.checkoutUrl);
    } catch (problem) {
      setError(
        marketErrorMessage(
          problem,
          "No pudimos iniciar el pago. Intentá nuevamente.",
        ),
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <div className="vm-detail-actions vm-checkout">
      <Button
        disabled={
          pending || !configuration?.enabled || product.acquired || physical
        }
        onClick={() => void buy()}
      >
        {pending ? <Loader2 className="animate-spin" /> : <CreditCard />}
        {product.acquired
          ? "Ya está en tu biblioteca"
          : configuration?.mode === "test"
            ? "Probar pago con Mercado Pago"
            : "Comprar con Mercado Pago"}
      </Button>
      <p>
        {physical
          ? "La compra integrada de hardware requiere configurar entrega y garantía. Por ahora, estos productos se compran mediante su enlace externo."
          : configuration?.enabled
            ? configuration.mode === "test"
              ? "Modo de prueba. Usá únicamente cuentas y medios de pago de prueba de Mercado Pago."
              : "Tu recurso estará disponible cuando Mercado Pago confirme el pago. Su costo de procesamiento se informa durante el pago."
            : "La compra dentro de VISO todavía no está habilitada."}
      </p>
      {error && (
        <p role="alert" className="vm-error">
          {error}
        </p>
      )}
    </div>
  );
}

const ORDER_NAMES: Record<string, string> = {
  pending: "Esperando confirmación",
  approved: "Pago confirmado",
  rejected: "Pago rechazado",
  cancelled: "Pago cancelado",
  refunded: "Pago devuelto",
  charged_back: "Pago con contracargo",
};

export function MarketplaceOrders({
  showEmpty = false,
  focusOrderId,
}: {
  showEmpty?: boolean;
  focusOrderId?: string | null;
}) {
  const allOrders = useQuery(api.marketplace_payments.myOrders, {});
  const orders = focusOrderId
    ? allOrders?.filter((order) => order.id === focusOrderId)
    : allOrders;
  const library = useQuery(api.marketplace.library, showEmpty ? {} : "skip");
  if (orders === undefined) return <p role="status">Cargando tus compras…</p>;
  const paid = new Set((orders ?? []).map((o) => o.productId));
  const acquired = (library ?? []).filter((e) => !paid.has(e.productId));
  if (!orders?.length && !acquired.length)
    return showEmpty ? (
      <section className="vm-empty">
        <h2>Tus compras van a aparecer acá</h2>
        <p>También encontrarás los recursos que agregues a tu biblioteca.</p>
        <Button asChild>
          <Link to="/marketplace">Explorar productos</Link>
        </Button>
      </section>
    ) : null;
  return (
    <section className="vm-store-orders" aria-label="Mis compras">
      {(orders ?? []).map((order) => (
        <article className="vm-order-card" key={order.id}>
          <header>
            <div>
              <h2>{order.title}</h2>
              <p>{new Date(order.createdAt).toLocaleDateString("es-AR")}</p>
            </div>
            <strong>
              {new Intl.NumberFormat("es-AR", {
                style: "currency",
                currency: order.currency,
              }).format(order.amount / 100)}
            </strong>
          </header>
          <span
            className={`vm-order-status ${order.status === "approved" ? "is-approved" : ""}`}
          >
            {ORDER_NAMES[order.status]}
          </span>
          <footer>
            <Button variant="outline" size="sm" asChild>
              <Link
                to={`/marketplace/products/${encodeURIComponent(order.productId)}`}
              >
                Ver producto
              </Link>
            </Button>
            {order.status === "approved" && (
              <Button size="sm" asChild>
                <Link to="/marketplace?view=library">Usar recurso</Link>
              </Button>
            )}
          </footer>
        </article>
      ))}
      {acquired.map((entry) => (
        <article className="vm-order-card" key={entry.productId}>
          <header>
            <div>
              <h2>{entry.title}</h2>
              <p>{new Date(entry.acquiredAt).toLocaleDateString("es-AR")}</p>
            </div>
          </header>
          <span className="vm-order-status is-approved">En tu biblioteca</span>
          <footer>
            <Button size="sm" asChild>
              <Link to="/marketplace?view=library">Usar recurso</Link>
            </Button>
            <Link
              to={`/marketplace/products/${encodeURIComponent(entry.productId)}`}
            >
              Ver producto
            </Link>
          </footer>
        </article>
      ))}
    </section>
  );
}
