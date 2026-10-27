import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { defaultTimbreQrDesign, type TimbreQrDesign } from "@/lib/timbre-qr";
import { timbrePrice, timbreTask } from "./shared";
import TimbreQrEditor from "./qr-editor";
import { timbrePublicQrUrl } from "@/lib/timbre-public-url";
import { toast } from "sonner";

type Variant = FunctionReturnType<
  typeof api.timbre_commerce.catalog
>[number]["variants"][number];

export default function TimbreCommercial({
  accountOnly = false,
}: { accountOnly?: boolean } = {}) {
  const catalog = useQuery(
    api.timbre_commerce.catalog,
    accountOnly ? "skip" : {},
  );
  const orders = useQuery(api.timbre_commerce.myPlateOrders, {});
  const licenses = useQuery(api.timbre_commerce.myLicenses, {});
  const checkout = useAction(api.timbre_commerce.createCheckout);
  const plateCheckout = useAction(api.timbre_commerce.createPlateCheckout);
  const request = useMutation(api.timbre_commerce.requestSubscription);
  const recurring = useQuery(api.timbre_recurring.configuration, {});
  const subscribe = useAction(api.timbre_recurring.createSubscriptionCheckout);
  const [variant, setVariant] = useState<Variant | null>(null);
  const [busy, setBusy] = useState(false);
  const [coupon, setCoupon] = useState("");
  if (!catalog && !accountOnly)
    return <p role="status">Cargando opciones de Timbre…</p>;
  return (
    <div className="vt-stack">
      {!accountOnly && (
        <>
          <div className="vt-notice">
            <strong>Un servicio dentro de tu cuenta VISO.</strong>
            <p>
              Timbre requiere pago o una licencia incluida expresamente con
              hardware elegible. La cuenta y los recursos gratuitos de la
              biblioteca no lo activan. Antes de pagar verás el importe y las
              condiciones configuradas por VISO.
            </p>
          </div>
          <section className="vt-grid" aria-label="Ofertas de Timbre">
            {catalog?.map((offer) => (
              <article className="vt-card" key={offer.code}>
                <span className="vt-eyebrow">VISO TIMBRE</span>
                <h2>{offer.title}</h2>
                <p>{offer.description}</p>
                {!offer.configured && (
                  <p>
                    Las condiciones comerciales todavía no están configuradas.
                  </p>
                )}
                {offer.plans.map((plan) => (
                  <div className="vt-details" key={plan.id}>
                    <h3 className="font-semibold">{plan.name}</h3>
                    <p>{plan.description}</p>
                    <strong>
                      {timbrePrice(plan.priceAmount, plan.currency)}
                      {plan.period === "monthly"
                        ? " / mes"
                        : plan.period === "yearly"
                          ? " / año"
                          : " · pago único"}
                    </strong>
                    <p>
                      {plan.durationDays
                        ? `Vigencia: ${plan.durationDays} días.`
                        : "Vigencia según condiciones de la licencia."}{" "}
                      Hasta {plan.limits.maxSites} timbres. Cada Timbre admite
                      hasta {plan.limits.maxQrs} QR y {plan.limits.maxMembers}{" "}
                      integrantes.
                    </p>
                    <p>
                      {[
                        plan.features.audio && "Audio",
                        plan.features.video && "Video",
                        plan.features.chat && "Chat",
                        plan.features.messages && "Mensajes",
                        plan.features.buildings && "Edificios",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {plan.period === "one_time" ? (
                      <Button
                        disabled={
                          !plan.buyable ||
                          busy ||
                          offer.code === "hardware" ||
                          offer.code === "personalizado"
                        }
                        onClick={() => {
                          setBusy(true);
                          void timbreTask(async () => {
                            const result = await checkout({
                              planId: plan.id,
                              ...(coupon.trim()
                                ? { coupon: coupon.trim() }
                                : {}),
                            });
                            window.location.assign(result.checkoutUrl);
                          }).finally(() => setBusy(false));
                        }}
                      >
                        Contratar en Mercado Pago
                      </Button>
                    ) : recurring?.enabled &&
                      plan.priceAmount &&
                      plan.currency === "ARS" &&
                      ["digital", "edificios"].includes(offer.code) ? (
                      <>
                        <p className="vt-caption">
                          La suscripción se autoriza en Mercado Pago. Timbre se
                          activa al confirmar el primer pago y se renueva por
                          cada período pagado.
                        </p>
                        <Button
                          disabled={busy}
                          onClick={() => {
                            setBusy(true);
                            void timbreTask(async () => {
                              const result = await subscribe({
                                planId: plan.id,
                              });
                              window.location.assign(result.checkoutUrl);
                            }).finally(() => setBusy(false));
                          }}
                        >
                          Suscribirme con Mercado Pago
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="vt-caption">
                          La contratación recurrente está pendiente de
                          habilitación. Esta solicitud no realiza cobros ni
                          activa una licencia.
                        </p>
                        <Button
                          variant="outline"
                          disabled={!plan.priceAmount || busy}
                          onClick={() =>
                            void timbreTask(async () => {
                              const result = await request({ planId: plan.id });
                              if (result.activated === false)
                                toast.info(result.message);
                            })
                          }
                        >
                          Registrar interés en este plan
                        </Button>
                      </>
                    )}
                  </div>
                ))}
                {offer.variants.map((row) => (
                  <div key={row.id} className="vt-details">
                    <h3 className="font-semibold">{row.name}</h3>
                    <p>
                      {row.material} · {row.widthMm} × {row.heightMm} mm
                    </p>
                    <strong>
                      {timbrePrice(row.priceAmount, row.currency)}
                    </strong>
                    <p>
                      {row.includedPlanId
                        ? "Incluye una licencia Timbre, activada después de verificar el pago."
                        : "Requiere un QR de tu licencia Timbre activa. No incluye licencia."}
                    </p>
                    {row.warranty && (
                      <details>
                        <summary>Garantía</summary>
                        <p>{row.warranty}</p>
                      </details>
                    )}
                    <Button
                      disabled={!row.buyable}
                      onClick={() => setVariant(row)}
                    >
                      Personalizar placa
                    </Button>
                  </div>
                ))}
                {offer.eligibleProducts.map((product) => (
                  <p key={product.productId}>
                    Producto elegible:{" "}
                    <a
                      href={`/marketplace/products/${encodeURIComponent(product.productId)}`}
                    >
                      Ver equipo y condiciones
                    </a>
                  </p>
                ))}
                {offer.blockReason && (
                  <p className="vt-caption">{offer.blockReason}</p>
                )}
              </article>
            ))}
          </section>
          <label className="vt-form">
            Cupón para planes de pago único
            <input
              value={coupon}
              maxLength={40}
              placeholder="Código promocional"
              onChange={(e) => setCoupon(e.target.value)}
            />
          </label>
          {variant && (
            <PlatePurchase
              key={variant.id}
              variant={variant}
              onClose={() => setVariant(null)}
            />
          )}
        </>
      )}
      <section className="vt-card">
        <h2>Tus licencias</h2>
        {licenses?.length === 0 ? (
          <p>Todavía no tenés licencias Timbre.</p>
        ) : (
          licenses?.map((row) => (
            <div className="vt-history-row" key={row._id}>
              <div>
                <strong>{row.planName}</strong>
                <p>
                  {row.active ? "Activa" : row.status} ·{" "}
                  {row.expiresAt
                    ? `Vence ${new Date(row.expiresAt).toLocaleDateString("es-AR")}`
                    : "Sin vencimiento configurado"}
                </p>
              </div>
            </div>
          ))
        )}
      </section>
      <TimbreSubscriptions />
      <section className="vt-card">
        <h2>Tus pedidos de placas</h2>
        {orders?.length === 0 ? (
          <p>Todavía no hay pedidos.</p>
        ) : (
          orders?.map((order) => (
            <div className="vt-history-row" key={order._id}>
              <div>
                <strong>{order.variant.name}</strong>
                <p>
                  {order.status} · {timbrePrice(order.amount, order.currency)}
                </p>
                {!order.qrId && order.status === "paid" && (
                  <p>
                    Pago recibido. Creá tu Timbre y un QR con la licencia
                    incluida, y vinculalo antes de fabricar.
                  </p>
                )}
                {order.trackingReference && (
                  <p>
                    {order.carrier}: {order.trackingReference}
                  </p>
                )}
              </div>
              {["draft", "pending_payment"].includes(order.status) && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void timbreTask(async () => {
                      const result = await plateCheckout({ id: order._id });
                      window.location.assign(result.checkoutUrl);
                    })
                  }
                >
                  Continuar pago
                </Button>
              )}
              {order.status === "paid" && <AttachPlateQr id={order._id} />}
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function TimbreSubscriptions() {
  const subscriptions = useQuery(api.timbre_recurring.mySubscriptions, {});
  const refresh = useAction(api.timbre_recurring.refreshSubscription);
  const cancel = useAction(api.timbre_recurring.cancelSubscription);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="vt-card">
      <h2>Tus suscripciones</h2>
      {subscriptions === undefined ? (
        <p role="status">Cargando suscripciones…</p>
      ) : subscriptions.length === 0 ? (
        <p>Todavía no hay suscripciones.</p>
      ) : (
        subscriptions.map((row) => (
          <div className="vt-details" key={row._id}>
            <h3 className="font-semibold">{row.planSnapshot.name}</h3>
            <p>
              {row.status === "authorized"
                ? "Autorizada"
                : row.status === "cancelled"
                  ? "Cancelada"
                  : row.status === "paused"
                    ? "Pausada"
                    : "Pendiente de autorización o habilitación"}{" "}
              ·{" "}
              {timbrePrice(
                row.planSnapshot.priceAmount,
                row.planSnapshot.currency,
              )}{" "}
              {row.planSnapshot.period === "yearly" ? "por año" : "por mes"}
            </p>
            {row.periods
              .filter((period) => period.status === "approved")
              .map((period) => (
                <p key={period._id} className="vt-caption">
                  Período pagado:{" "}
                  {new Date(period.startsAt).toLocaleDateString("es-AR")} –{" "}
                  {new Date(period.endsAt).toLocaleDateString("es-AR")}
                </p>
              ))}
            <div className="vt-toolbar">
              {row.providerReference && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void timbreTask(
                      () => refresh({ id: row._id }),
                      "Estado consultado con Mercado Pago",
                    ).finally(() => setBusy(false));
                  }}
                >
                  Actualizar estado
                </Button>
              )}
              {row.status !== "cancelled" && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setConfirm(row._id)}
                >
                  Cancelar suscripción
                </Button>
              )}
            </div>
            {confirm === row._id && (
              <div className="vt-notice">
                <p>
                  ¿Confirmás la cancelación? Conservás los períodos ya pagados.
                  La cancelación se informa como completada sólo después de
                  comprobarla con Mercado Pago.
                </p>
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void timbreTask(async () => {
                      const result = await cancel({ id: row._id });
                      if (result.providerCancellationPending)
                        toast.info(
                          "La solicitud se registró; falta confirmar la cancelación con Mercado Pago.",
                        );
                      else toast.success("Suscripción cancelada");
                      setConfirm("");
                    }).finally(() => setBusy(false));
                  }}
                >
                  Confirmar cancelación
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirm("")}
                >
                  Volver
                </Button>
              </div>
            )}
          </div>
        ))
      )}
    </section>
  );
}

function AttachPlateQr({ id }: { id: Id<"timbrePlateOrders"> }) {
  const workspace = useQuery(api.timbre.workspace, {});
  const attach = useMutation(api.timbre_commerce.attachPlateQr);
  const [siteId, setSiteId] = useState("");
  const site =
    workspace?.sites.find((row) => row._id === siteId) ??
    workspace?.sites.find((row) => row.role === "owner");
  const qrs = useQuery(
    api.timbre.listQrs,
    site ? { siteId: site._id } : "skip",
  );
  const [qrId, setQrId] = useState("");
  return (
    <div className="vt-form">
      <label>
        Timbre
        <select
          value={site?._id ?? ""}
          onChange={(e) => {
            setSiteId(e.target.value);
            setQrId("");
          }}
        >
          {workspace?.sites
            .filter((row) => row.role === "owner")
            .map((row) => (
              <option key={row._id} value={row._id}>
                {row.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        QR de producción
        <select value={qrId} onChange={(e) => setQrId(e.target.value)}>
          <option value="">Seleccionar QR</option>
          {qrs
            ?.filter((row) => row.enabled && !row.revokedAt)
            .map((row) => (
              <option key={row._id} value={row._id}>
                {row.label}
              </option>
            ))}
        </select>
      </label>
      <Button
        variant="outline"
        disabled={!qrId}
        onClick={() =>
          void timbreTask(
            () => attach({ id, qrId: qrId as Id<"timbreQrs"> }),
            "QR vinculado al pedido",
          )
        }
      >
        Vincular QR
      </Button>
    </div>
  );
}

function PlatePurchase({
  variant,
  onClose,
}: {
  variant: Variant;
  onClose: () => void;
}) {
  const workspace = useQuery(api.timbre.workspace, {});
  const shipping = useQuery(api.timbre_commerce.shippingOptions, {});
  const create = useMutation(api.timbre_commerce.createPlateOrder);
  const [siteId, setSiteId] = useState("");
  const site =
    workspace?.sites.find((row) => row._id === siteId) ??
    workspace?.sites.find((row) => row.role === "owner" && row.licenseActive);
  const qrs = useQuery(
    api.timbre.listQrs,
    site ? { siteId: site._id } : "skip",
  );
  const [qrId, setQrId] = useState("");
  const qr = qrs?.find(
    (row) => row._id === qrId && row.enabled && !row.revokedAt,
  );
  const fullQr = useQuery(
    api.timbre.qrForExport,
    qr ? { qrId: qr._id } : "skip",
  );
  const [draft, setDraft] = useState<TimbreQrDesign | null>(null);
  const design: TimbreQrDesign = draft ?? {
    ...(fullQr?.qr.design ?? defaultTimbreQrDesign(qr?.label)),
    widthMm: variant.widthMm,
    heightMm: variant.heightMm,
  };
  const [busy, setBusy] = useState(false);
  return (
    <section className="vt-card" aria-label="Personalizar placa">
      <div className="vt-toolbar">
        <h2>{variant.name}</h2>
        <Button variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      </div>
      <p>
        {variant.material} · {variant.widthMm} × {variant.heightMm} mm. El
        precio del envío se suma al de la placa antes de confirmar.
      </p>
      {site && (
        <div className="vt-form vt-form-inline">
          <label>
            Timbre
            <select
              value={site._id}
              onChange={(e) => {
                setSiteId(e.target.value);
                setQrId("");
                setDraft(null);
              }}
            >
              {workspace?.sites
                .filter((row) => row.role === "owner" && row.licenseActive)
                .map((row) => (
                  <option key={row._id} value={row._id}>
                    {row.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            QR
            <select
              value={qrId}
              onChange={(e) => {
                setQrId(e.target.value);
                setDraft(null);
              }}
            >
              <option value="">Elegir QR para la placa</option>
              {qrs
                ?.filter((row) => row.enabled && !row.revokedAt)
                .map((row) => (
                  <option key={row._id} value={row._id}>
                    {row.label}
                  </option>
                ))}
            </select>
          </label>
        </div>
      )}
      {qr && fullQr ? (
        <TimbreQrEditor
          key={qr._id}
          url={timbrePublicQrUrl(qr.token)}
          label={qr.label}
          initialDesign={{
            ...(fullQr.qr.design ?? defaultTimbreQrDesign(qr.label)),
            widthMm: variant.widthMm,
            heightMm: variant.heightMm,
          }}
          onDesignChange={setDraft}
          fixedDimensions={{
            widthMm: variant.widthMm,
            heightMm: variant.heightMm,
          }}
        />
      ) : qr ? (
        <p role="status">Cargando el diseño guardado…</p>
      ) : variant.includedPlanId ? (
        <div className="vt-notice">
          <p>
            Esta placa incluye licencia. Podés guardar los textos y comprarla;
            después del pago, creá y vinculá tu QR. El archivo final se confirma
            antes de fabricar.
          </p>
          <TimbreQrEditor
            key="unlicensed-preview"
            url=""
            label={variant.name}
            initialDesign={design}
            onDesignChange={setDraft}
            previewOnly
            fixedDimensions={{
              widthMm: variant.widthMm,
              heightMm: variant.heightMm,
            }}
          />
        </div>
      ) : (
        <p>Elegí un QR activo. Esta variante no incluye licencia.</p>
      )}
      <form
        className="vt-form"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setBusy(true);
          void timbreTask(async () => {
            await create({
              variantId: variant.id,
              ...(qr ? { qrId: qr._id } : {}),
              design,
              shippingOptionId: String(
                data.get("shipping"),
              ) as Id<"timbreShippingOptions">,
              shippingAddress: {
                name: String(data.get("name")),
                street: String(data.get("street")),
                city: String(data.get("city")),
                region: String(data.get("region")),
                postalCode: String(data.get("postalCode")),
                country: String(data.get("country")),
                phone: String(data.get("phone")),
                notes: String(data.get("notes")),
              },
            });
            onClose();
          }, "Pedido guardado. Podés continuar con el pago desde Tus pedidos.").finally(
            () => setBusy(false),
          );
        }}
      >
        <h3 className="font-semibold">Dirección de entrega</h3>
        <div className="vt-grid">
          {[
            { name: "name", label: "Nombre y apellido" },
            { name: "street", label: "Calle, número y unidad" },
            { name: "city", label: "Ciudad" },
            { name: "region", label: "Provincia o región" },
            { name: "postalCode", label: "Código postal" },
            { name: "country", label: "País (código ISO, por ejemplo AR)" },
            { name: "phone", label: "Teléfono de entrega" },
          ].map((field) => (
            <label key={field.name}>
              {field.label}
              <input
                name={field.name}
                required
                maxLength={200}
                autoComplete={
                  field.name === "name"
                    ? "name"
                    : field.name === "phone"
                      ? "tel"
                      : undefined
                }
              />
            </label>
          ))}
        </div>
        <label>
          Notas de entrega
          <textarea name="notes" maxLength={1000} />
        </label>
        <label>
          Envío disponible
          <select name="shipping" required>
            <option value="">Elegir envío</option>
            {shipping
              ?.filter((row) => row.currency === variant.currency)
              .map((row) => (
                <option key={row._id} value={row._id}>
                  {row.name} · {timbrePrice(row.priceAmount, row.currency)} ·
                  Total{" "}
                  {timbrePrice(
                    (variant.priceAmount ?? 0) + row.priceAmount,
                    row.currency,
                  )}
                </option>
              ))}
          </select>
        </label>
        {shipping?.map((row) => (
          <p key={row._id} className="vt-caption">
            {row.name}: {row.terms}. Zonas: {row.country}{" "}
            {row.regions.join(", ")}
          </p>
        ))}
        <label className="vt-toggle">
          <span>
            Confirmo los textos, las medidas y las condiciones de la placa. La
            fabricación comienza después del pago y de confirmar el archivo
            final con mi QR.
          </span>
          <input type="checkbox" required />
        </label>
        <Button
          type="submit"
          disabled={
            busy || (!!qr && !fullQr) || (!qr && !variant.includedPlanId)
          }
        >
          Guardar pedido y diseño
        </Button>
      </form>
    </section>
  );
}
