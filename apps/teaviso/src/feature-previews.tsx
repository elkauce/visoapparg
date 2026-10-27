import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PublicLayout } from "./ui-v2";
export function AgendaPreview() {
  return (
    <div className="sb-preview">
      <div className="sb-preview-title">
        <strong>Martes, 27 de octubre</strong>
        <span>Ejemplo</span>
      </div>
      <div className="sb-agenda-row">
        <time>09:00</time>
        <span>Lucía Torres · Consulta</span>
        <small>Confirmado</small>
      </div>
      <div className="sb-agenda-row">
        <time>11:00</time>
        <span>Juan Pérez · Control</span>
        <small className="pending">Pendiente</small>
      </div>
    </div>
  );
}
export function CallPreview() {
  const [answered, setAnswered] = useState(false);
  return (
    <div className="sb-preview">
      <div className="sb-preview-title">
        <strong>
          {answered ? "Ejemplo de llamada atendida" : "Llamada entrante"}
        </strong>
        <span>Ejemplo</span>
      </div>
      <strong>Puerta principal</strong>
      <p>Motivo indicado: Entrega</p>
      <div className="sb-call-actions">
        <button
          className="sb-small-button red"
          onClick={() => setAnswered(false)}
        >
          Rechazar
        </button>
        <button
          className="sb-small-button green"
          onClick={() => setAnswered(true)}
        >
          Atender
        </button>
      </div>
    </div>
  );
}
export function MessagesPreview() {
  const [reason, setReason] = useState("Entrega");
  const messages: Record<string, string> = {
    Entrega: "Estoy en la entrada con una entrega.",
    Turno: "Hola, ya llegué para mi turno.",
    Visita: "Hola, estoy en la entrada. ¿Podés atenderme?",
  };
  return (
    <div className="sb-preview">
      <div className="sb-chips">
        {Object.keys(messages).map((r) => (
          <button
            key={r}
            className={reason === r ? "selected" : ""}
            onClick={() => setReason(r)}
          >
            {r}
          </button>
        ))}
      </div>
      <p className="sb-message-example">{messages[reason]}</p>
    </div>
  );
}
const topics = {
  agenda: {
    title: "Organizá tus turnos",
    description:
      "Definí servicios, profesionales y horarios. Tus clientes reservan desde el enlace de tu timbre.",
    to: "/panel/agenda",
    action: "Abrir mi agenda",
    Preview: AgendaPreview,
  },
  llamadas: {
    title: "Atendé tu timbre",
    description:
      "La visita solicita la llamada. Vos ves el lugar y el motivo que indicó, y decidís cuándo atender.",
    to: "/panel/llamadas",
    action: "Configurar mis llamadas",
    Preview: CallPreview,
  },
  mensajes: {
    title: "Sabé por qué llegaron",
    description:
      "Elegí los motivos y mensajes de tu entrada. La visita revisa qué te va a avisar antes de confirmar.",
    to: "/panel/portal",
    action: "Configurar mis mensajes",
    Preview: MessagesPreview,
  },
} as const;
export function FeatureCards() {
  return (
    <div className="sb-features">
      {Object.entries(topics).map(([id, t]) => (
        <article key={id} className="sb-feature">
          <h3>{t.title}</h3>
          <t.Preview />
          <p>
            {id === "agenda"
              ? "Horarios, reservas y disponibilidad."
              : id === "llamadas"
                ? "Elegís cuándo responder a tus visitas."
                : "Mensajes que podés personalizar."}
          </p>
          <Link to={`/funciones/${id}`}>
            {id === "agenda"
              ? "Ver la agenda"
              : id === "llamadas"
                ? "Ver una llamada"
                : "Ver los mensajes"}{" "}
            →
          </Link>
        </article>
      ))}
    </div>
  );
}
export function FeaturePage() {
  const { feature } = useParams();
  const t = topics[feature as keyof typeof topics];
  return (
    <PublicLayout>
      <main className="sb-page sb-feature-page">
        <Link className="sb-text-link" to="/#como-funciona">
          ← Cómo funciona
        </Link>
        <header>
          <span className="sb-eyebrow">Te Aviso</span>
          <h1>{t?.title ?? "Cómo funciona"}</h1>
          <p>{t?.description ?? "Conocé las opciones de tu timbre."}</p>
        </header>
        {t ? (
          <>
            <div className="sb-demo">
              <t.Preview />
            </div>
            <p className="sb-note">
              Demostración con datos de ejemplo. No envía avisos ni inicia
              llamadas reales.
            </p>
            <Link className="av-button" to={t.to}>
              {t.action}
            </Link>
            <p className="sb-note">
              Funciones disponibles según tu plan y configuración.
            </p>
            {feature === "llamadas" && (
              <p>
                Para recibir en la web, mantené el panel abierto. En el celular,
                la recepción en segundo plano requiere la APK compatible y sus
                permisos.
              </p>
            )}
            {feature === "mensajes" && (
              <p>
                Continuar en WhatsApp prepara el mensaje. La visita confirma su
                envío allí.
              </p>
            )}
          </>
        ) : (
          <FeatureCards />
        )}
      </main>
    </PublicLayout>
  );
}
