import { useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorText, money, qrUrl } from "./config";
import { QrDownload } from "./qr";

const labels = {
  requested: "Solicitud recibida",
  awaiting_payment: "Pago pendiente",
  paid: "Pago confirmado",
  configuring: "En configuración",
  active: "Servicio activo",
  cancelled: "Cancelado",
};
function ActiveBusiness({
  row,
}: {
  row: {
    _id: Id<"teavisoBusinessRequests">;
    businessName: string;
    assignedPhone?: string;
    token: string;
    message: string;
    enabled: boolean;
  };
}) {
  const update = useMutation(api.teaviso.updateBusinessContact);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <>
      <p>WhatsApp del servicio: +{row.assignedPhone}</p>
      <QrDownload url={qrUrl(row.token)} label={row.businessName} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (lock.current) return;
          lock.current = true;
          setBusy(true);
          setError("");
          setSaved(false);
          const data = new FormData(e.currentTarget);
          void update({
            requestId: row._id,
            message: String(data.get("message")),
            enabled: data.get("enabled") === "on",
          })
            .then(() => setSaved(true))
            .catch((e) => setError(errorText(e)))
            .finally(() => {
              lock.current = false;
              setBusy(false);
            });
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Mensaje para visitantes
            <textarea
              name="message"
              defaultValue={row.message}
              maxLength={500}
            />
          </label>
          <label className="tea-check">
            <input
              name="enabled"
              type="checkbox"
              defaultChecked={row.enabled}
            />{" "}
            QR activo
          </label>
          <button className="tea-secondary">Guardar preferencias</button>
        </fieldset>
      </form>
      {error && <p role="alert">{error}</p>}
      {saved && <p role="status">Preferencias guardadas.</p>}
    </>
  );
}
export default function BusinessPanel() {
  const config = useQuery(api.teaviso.configuration, {
    origin: window.location.origin,
  });
  const requests = useQuery(api.teaviso.myBusinessRequests, {});
  const request = useMutation(api.teaviso.requestBusiness);
  const checkout = useAction(api.teaviso.createBusinessCheckout);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [accepted, setAccepted] = useState<string | null>(null);
  const offer = config?.business;
  const acceptance = offer ? `${offer.priceAmount}:${offer.terms}` : null;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      await request({
        businessName: String(data.get("businessName")),
        contactPhone: String(data.get("contactPhone")),
        notes: String(data.get("notes")),
      });
      form.reset();
      setSuccess("Recibimos tu solicitud. Podés seguir su estado acá.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function pay(id: Id<"teavisoBusinessRequests">) {
    if (lock.current || !offer || accepted !== acceptance) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await checkout({
        requestId: id,
        acceptedTerms: offer.terms,
        acceptedAmount: offer.priceAmount,
      });
      window.location.assign(result.checkoutUrl);
    } catch (e) {
      setError(errorText(e));
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="tea-stack">
      <header>
        <span className="eyebrow">SERVICIO PAGO · CONFIGURACIÓN INCLUIDA</span>
        <h1>WhatsApp Business</h1>
        <p>
          Un número dedicado, su QR y la configuración inicial para tu casa,
          oficina o negocio.
        </p>
      </header>
      <section className="tea-card">
        <h2>Qué incluye</h2>
        <ul className="tea-feature-list">
          <li>Preparación del número y perfil de WhatsApp Business.</li>
          <li>Configuración del enlace y mensaje para tus visitas.</li>
          <li>QR descargable, panel y seguimiento de la puesta en marcha.</li>
        </ul>
        <p>
          La asignación del número y configuración las realiza nuestro equipo
          después del pago. No es una central automática de llamadas.
        </p>
        {offer?.enabled ? (
          <>
            <strong>
              {money(offer.priceAmount)} · configuración, pago único
            </strong>
            <p className="tea-terms">{offer.terms}</p>
            <label className="tea-check">
              <input
                type="checkbox"
                checked={accepted === acceptance}
                onChange={(e) =>
                  setAccepted(e.target.checked ? acceptance : null)
                }
              />{" "}
              Acepto el importe y las condiciones del servicio.
            </label>
            {!offer.buyable && (
              <p className="tea-muted">
                Los cobros todavía no están habilitados. Podés registrar tu
                solicitud sin pagar.
              </p>
            )}
          </>
        ) : (
          <p className="tea-muted">
            El importe y las condiciones se están preparando. Podés registrar tu
            interés sin cobros ni compromiso.
          </p>
        )}
      </section>
      <section className="tea-card">
        <h2>Solicitar mi servicio</h2>
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            <label>
              Nombre del lugar
              <input name="businessName" required maxLength={100} />
            </label>
            <label>
              Teléfono para coordinar la configuración
              <input
                name="contactPhone"
                type="tel"
                placeholder="5491112345678"
                required
                maxLength={30}
              />
            </label>
            <label>
              Qué necesitás
              <textarea name="notes" maxLength={1000} />
            </label>
            <small>
              Este teléfono es para coordinar con vos. No se publica como número
              del servicio.
            </small>
            <button className="button" type="submit">
              {busy ? "Procesando…" : "Enviar solicitud"}
            </button>
          </fieldset>
        </form>
      </section>
      {error && <p role="alert">{error}</p>}
      {success && <p role="status">{success}</p>}
      <section className="tea-stack">
        <h2>Mis solicitudes</h2>
        {requests === undefined ? (
          <p role="status">Cargando solicitudes…</p>
        ) : !requests.length ? (
          <p className="tea-muted">Todavía no tenés solicitudes.</p>
        ) : (
          requests.map((row) => (
            <article key={row._id} className="tea-card">
              <div className="tea-card-head">
                <h3>{row.businessName}</h3>
                <span className="tea-badge">{labels[row.status]}</span>
              </div>
              {row.priceAmount !== undefined && (
                <p>Contratado: {money(row.priceAmount)} · pago único</p>
              )}
              {row.terms && (
                <details>
                  <summary>Condiciones aceptadas</summary>
                  <p className="tea-terms">{row.terms}</p>
                </details>
              )}
              {["requested", "awaiting_payment"].includes(row.status) &&
                offer?.enabled && (
                  <button
                    className="button"
                    disabled={busy || !offer.buyable || accepted !== acceptance}
                    onClick={() => void pay(row._id)}
                  >
                    Pagar configuración con Mercado Pago
                  </button>
                )}
              {row.status === "paid" && (
                <p>
                  Tu pago está confirmado. Nuestro equipo preparará el número y
                  la configuración.
                </p>
              )}
              {row.status === "configuring" && (
                <p>
                  Estamos preparando tu servicio. El QR se habilitará cuando
                  esté listo.
                </p>
              )}
              {row.status === "active" && row.assignedPhone && (
                <ActiveBusiness
                  key={`${row._id}:${row.enabled}:${row.message}`}
                  row={row}
                />
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
export function BusinessAdmin() {
  const data = useQuery(api.teaviso.adminBusiness, {});
  const save = useMutation(api.teaviso.saveBusinessSettings);
  const provision = useMutation(api.teaviso.provisionBusiness);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function run(task: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
      setMessage("Cambios guardados.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!data) return <p role="status">Cargando administración…</p>;
  return (
    <div className="tea-stack">
      <header>
        <h1>Administración Business</h1>
        <p>
          Configurá la oferta y completá cada servicio después de verificar su
          pago.
        </p>
      </header>
      <section className="tea-card">
        <h2>Precio y condiciones</h2>
        <form
          key={data.settings?.updatedAt ?? "new"}
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            void run(() =>
              save({
                enabled: form.get("enabled") === "on",
                priceAmount: Math.round(Number(form.get("price")) * 100),
                terms: String(form.get("terms")),
              }),
            );
          }}
        >
          <fieldset disabled={busy}>
            <label>
              Configuración inicial · ARS
              <input
                name="price"
                type="number"
                min="0.01"
                step="0.01"
                max="1000000"
                required
                defaultValue={
                  data.settings ? data.settings.priceAmount / 100 : ""
                }
              />
            </label>
            <label>
              Condiciones del servicio
              <textarea
                name="terms"
                required
                minLength={40}
                maxLength={5000}
                defaultValue={data.settings?.terms}
                placeholder="Detallá provisión y titularidad del número, configuración incluida, plazos, mantenimiento, costos posteriores, cancelaciones y reintegros."
              />
            </label>
            <label className="tea-check">
              <input
                name="enabled"
                type="checkbox"
                defaultChecked={data.settings?.enabled}
              />{" "}
              Mostrar la oferta paga
            </label>
            <button className="button">Guardar oferta</button>
          </fieldset>
        </form>
        <p className="tea-muted">
          Mostrar la oferta no habilita los cobros. Se respetan la configuración
          y autorización vigentes de Mercado Pago. No se crea una suscripción
          automática.
        </p>
      </section>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {data.requests.map((row) => (
        <article className="tea-card" key={row._id}>
          <h2>{row.businessName}</h2>
          <p>
            {labels[row.status]} · Contacto: +{row.contactPhone}
          </p>
          <p>{row.notes}</p>
          {["paid", "configuring", "active"].includes(row.status) ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                void run(() =>
                  provision({
                    requestId: row._id,
                    assignedPhone: String(form.get("phone")),
                    message: String(form.get("message")),
                    adminNotes: String(form.get("notes")),
                    activate: form.get("activate") === "on",
                  }),
                );
              }}
            >
              <fieldset disabled={busy}>
                <label>
                  Número Business preparado
                  <input
                    name="phone"
                    type="tel"
                    required
                    defaultValue={row.assignedPhone}
                  />
                </label>
                <label>
                  Mensaje para visitantes
                  <textarea
                    name="message"
                    defaultValue={row.message}
                    maxLength={500}
                  />
                </label>
                <label>
                  Notas internas
                  <textarea
                    name="notes"
                    defaultValue={row.adminNotes}
                    maxLength={2000}
                  />
                </label>
                <label className="tea-check">
                  <input
                    name="activate"
                    type="checkbox"
                    defaultChecked={row.status === "active"}
                  />{" "}
                  Confirmo que el número está configurado y probado. Activar QR.
                </label>
                <button className="button">Guardar configuración</button>
              </fieldset>
            </form>
          ) : (
            <p className="tea-muted">
              La asignación se habilita después del pago confirmado por el
              proveedor.
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
