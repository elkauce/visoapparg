import { useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { CreditCard, Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { isAndroidNative } from "@/lib/android-native";
import { openMarketplaceAsset } from "@/lib/marketplace-navigation";
import { marketErrorMessage } from "@/lib/marketplace-upload";
import type { MarketProduct } from "./types";

export default function ProductCheckout({ product }: { product: MarketProduct }) {
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
      setError(marketErrorMessage(problem, "No pudimos iniciar el pago. Intentá nuevamente."));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return <div className="vm-detail-actions vm-checkout">
    <Button disabled={pending || !configuration?.enabled || product.acquired || physical} onClick={() => void buy()}>
      {pending ? <Loader2 className="animate-spin" /> : <CreditCard />}
      {product.acquired ? "Ya está en tu biblioteca" : configuration?.mode === "test" ? "Probar pago con Mercado Pago" : "Comprar con Mercado Pago"}
    </Button>
    <p>{physical ? "La compra integrada de hardware requiere configurar entrega y garantía. Por ahora, estos productos se compran mediante su enlace externo."
      : configuration?.enabled
      ? configuration.mode === "test"
        ? "Modo de prueba. Usá únicamente cuentas y medios de pago de prueba de Mercado Pago."
        : "Tu recurso estará disponible cuando Mercado Pago confirme el pago. Su costo de procesamiento se informa durante el pago."
      : "La compra dentro de VISO todavía no está habilitada."}</p>
    {error && <p role="alert" className="vm-error">{error}</p>}
  </div>;
}

const ORDER_NAMES: Record<string, string> = {
  pending: "Esperando confirmación", approved: "Pago confirmado", rejected: "Pago rechazado",
  cancelled: "Pago cancelado", refunded: "Pago devuelto", charged_back: "Pago con contracargo",
};

export function MarketplaceOrders() {
  const orders = useQuery(api.marketplace_payments.myOrders, {});
  if (!orders?.length) return null;
  return <section className="vm-payment-card" aria-label="Mis compras">
    <h2>Mis compras</h2>
    <p>La confirmación llega directamente de Mercado Pago. Volver del pago no desbloquea un recurso por sí solo.</p>
    <ul className="vm-payment-orders">{orders.map((order) => <li key={order.id}>
      <span><strong>{order.title}</strong><small>{new Date(order.createdAt).toLocaleDateString("es-AR")}</small></span>
      <span>{new Intl.NumberFormat("es-AR", { style: "currency", currency: order.currency }).format(order.amount / 100)}<small>{ORDER_NAMES[order.status]}</small></span>
    </li>)}</ul>
  </section>;
}
