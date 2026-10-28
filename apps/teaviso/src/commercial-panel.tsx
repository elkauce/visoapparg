import { useState, type FormEvent } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Check, MessageCircle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import {
  isTeavisoInterest,
  teavisoOffers,
  type TeavisoInterest,
} from "@/convex/lib/teaviso_offers";
import TimbreCommercial from "@/pages/timbre/commercial";
import { Feedback, Loading } from "./ui-v2";
import { useTask } from "./use-teaviso-task";
import { randomToken } from "./v2-model";
import { servicePlans, serviceInterest } from "./service-plans";
import "./commercial-panel.css";

const statuses = {
  new: "Recibida",
  reviewing: "En revisión",
  answered: "Con respuesta",
  closed: "Finalizada",
};
const offerName = (value: string) =>
  isTeavisoInterest(value) ? teavisoOffers[value].name : value;
export function PlanPanel() {
  const [params] = useSearchParams(),
    raw = params.get("interes"),
    interest = serviceInterest(raw);
  const requests = useQuery(api.teaviso_plan_requests.mine, {});
  return (
    <div className="av-stack ta-plan-account">
      <header className="av-panel-heading">
        <div>
          <span className="av-eyebrow">TU SERVICIO TE AVISO</span>
          <h1>Mi plan y beneficios</h1>
          <p>
            Lo que tenés contratado, tus consultas y las opciones para tu
            timbre.
          </p>
        </div>
        <Link className="av-button av-outline" to="/planes">
          Comparar planes <ArrowRight size={16} />
        </Link>
      </header>
      <section className="av-card pc-plan-summary">
        <span className="pc-icon">
          <MessageCircle size={24} />
        </span>
        <div>
          <h2>Un servicio para tu lugar.</h2>
          <p>
            Casas y departamentos, profesionales y consultorios, edificios. La
            propuesta de cada servicio incluye un cartel con QR. Confirmamos
            precio, vigencia y funciones antes de contratar.
          </p>
        </div>
      </section>
      <InquiryForm key={interest} initial={interest} />
      <section className="av-card av-stack" id="mis-consultas">
        <h2>Mis consultas</h2>
        <p>
          Las respuestas aparecen acá. Enviar una consulta no realiza cobros ni
          activa un plan.
        </p>
        {requests === undefined ? (
          <Loading />
        ) : requests.length === 0 ? (
          <p>Todavía no enviaste consultas.</p>
        ) : (
          requests.map((row) => (
            <article className="ta-request" key={row._id}>
              <div className="ta-request-top">
                <strong>{offerName(row.interest)}</strong>
                <span>{statuses[row.status]}</span>
              </div>
              <p>
                {row.message ||
                  "Consulta sobre funciones y condiciones del servicio."}
              </p>
              <small>
                {new Date(row.createdAt).toLocaleDateString("es-AR")}
              </small>
              {row.response && (
                <div className="ta-request-response">
                  <strong>Respuesta de Te Aviso</strong>
                  <p>{row.response}</p>
                </div>
              )}
            </article>
          ))
        )}
      </section>
      <TimbreCommercial accountOnly />
    </div>
  );
}
function InquiryForm({ initial }: { initial: TeavisoInterest | "" }) {
  const [interest, setInterest] = useState<TeavisoInterest | "">(initial),
    [message, setMessage] = useState(""),
    [key, setKey] = useState(randomToken),
    [sent, setSent] = useState(false),
    task = useTask(),
    request = useMutation(api.teaviso_plan_requests.request);
  const offer = interest ? teavisoOffers[interest] : null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!interest) return;
    void task.run(async () => {
      await request({ interest, message, requestKey: key });
      setSent(true);
    }, "Tu consulta quedó registrada. Podés seguirla en Mis consultas.");
  };
  return (
    <section className="av-card ta-plan-inquiry">
      <header>
        <span className="av-eyebrow">CONDICIONES ANTES DE CONTRATAR</span>
        <h2>Consultar una opción</h2>
        <p>
          Te confirmamos las funciones, el precio, la vigencia y los detalles de
          tu cartel incluido.
        </p>
      </header>
      <form onSubmit={submit}>
        <label>
          Me interesa
          <select
            aria-label="Me interesa"
            value={interest}
            required
            disabled={task.busy}
            onChange={(e) => {
              setInterest(e.target.value as TeavisoInterest);
              setKey(randomToken());
              setSent(false);
            }}
          >
            <option value="">Elegir una opción</option>
            {servicePlans.map(({ id, title }) => (
              <option value={id} key={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
        {offer && (
          <div className="ta-offer-summary">
            <strong>{offer.name}</strong>
            <span>
              {offer.amount
                ? `$ ${offer.amount.toLocaleString("es-AR")} ARS · referencia`
                : "A cotizar"}
            </span>
            <small>
              Precio, vigencia, cartel e instalación se confirman en la
              propuesta. Esta consulta no es una compra.
            </small>
          </div>
        )}
        <label>
          Contanos qué necesitás <span>(opcional)</span>
          <textarea
            value={message}
            maxLength={1500}
            disabled={task.busy || sent}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Por ejemplo: una casa con tres integrantes, un consultorio o un edificio con diez unidades."
            rows={3}
          />
        </label>
        <Feedback task={task} />
        <button className="av-button" disabled={!interest || task.busy || sent}>
          {sent ? (
            <>
              <Check size={16} /> Consulta enviada
            </>
          ) : task.busy ? (
            "Enviando…"
          ) : (
            "Enviar consulta"
          )}
        </button>
        {sent && (
          <a className="ta-consultations-link" href="#mis-consultas">
            Ver Mis consultas →
          </a>
        )}
      </form>
      <p className="ta-inquiry-note">
        Podés <Link to="/panel/carteles">elegir el diseño de tu cartel</Link>.
        El puente WhatsApp de hogares y la apertura de puertas requieren validar
        su integración antes de habilitarse.
      </p>
    </section>
  );
}
type AdminRow = FunctionReturnType<
  typeof api.teaviso_plan_requests.directory
>["page"][number];
export function AdminPlanRequests() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.teaviso_plan_requests.directory,
    {},
    { initialNumItems: 20 },
  );
  return (
    <div className="av-stack ta-plan-account">
      <header className="av-panel-heading">
        <div>
          <span className="av-eyebrow">ADMINISTRACIÓN TE AVISO</span>
          <h1>Consultas de planes</h1>
          <p>
            Revisá y respondé solicitudes. La respuesta se muestra en la cuenta
            del cliente.
          </p>
        </div>
      </header>
      {status === "LoadingFirstPage" ? (
        <Loading />
      ) : results.length === 0 ? (
        <section className="av-card">
          <p>Todavía no hay consultas de planes.</p>
        </section>
      ) : (
        results.map((row) => (
          <AdminRequest key={`${row._id}:${row.updatedAt}`} row={row} />
        ))
      )}
      {status === "CanLoadMore" && (
        <button className="av-button av-outline" onClick={() => loadMore(20)}>
          Ver más consultas
        </button>
      )}
    </div>
  );
}
function AdminRequest({ row }: { row: AdminRow }) {
  const [response, setResponse] = useState(row.response),
    [status, setStatus] = useState<"reviewing" | "answered" | "closed">(
      row.status === "new" ? "reviewing" : row.status,
    ),
    task = useTask(),
    respond = useMutation(api.teaviso_plan_requests.respond);
  return (
    <section className="av-card ta-admin-inquiry">
      <div className="ta-request-top">
        <h2>{offerName(row.interest)}</h2>
        <span>{statuses[row.status]}</span>
      </div>
      <p>
        <strong>{row.name || row.email}</strong> · {row.email}
      </p>
      <p>{row.message || "Consulta sobre condiciones del servicio."}</p>
      <small>{new Date(row.createdAt).toLocaleString("es-AR")}</small>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void task.run(
            () =>
              respond({
                id: row._id,
                expectedUpdatedAt: row.updatedAt,
                response,
                status,
              }),
            "Consulta actualizada.",
          );
        }}
      >
        <label>
          Estado
          <select
            aria-label="Estado"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="reviewing">En revisión</option>
            <option value="answered">Con respuesta</option>
            <option value="closed">Finalizada</option>
          </select>
        </label>
        <label>
          Respuesta visible para el cliente
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            maxLength={2000}
            required={status === "answered"}
            rows={4}
          />
        </label>
        <Feedback task={task} />
        <button className="av-button" disabled={task.busy}>
          {task.busy ? "Guardando…" : "Guardar respuesta"}
        </button>
      </form>
    </section>
  );
}
