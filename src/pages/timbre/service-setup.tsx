import { useState } from "react";
import { useQuery } from "convex/react";
import { CheckCircle2, Circle, Copy, ExternalLink } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  CLOUDFLARE_TURN_TEMPLATE,
  timbreEnvironmentDashboardUrl,
} from "./service-setup-config";
import "./service-setup.css";

export default function TimbreServiceSetup() {
  const configuration = useQuery(api.timbre_setup.configuration, {});
  const [feedback, setFeedback] = useState("");
  const dashboardUrl = timbreEnvironmentDashboardUrl(
    import.meta.env.VITE_CONVEX_URL,
  );
  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(CLOUDFLARE_TURN_TEMPLATE);
      setFeedback(
        "Plantilla copiada. Completá los valores privados en Convex.",
      );
    } catch {
      setFeedback(
        "No se pudo copiar. Podés seleccionar la plantilla y copiarla.",
      );
    }
  };

  if (!configuration)
    return <p role="status">Revisando la configuración del servidor…</p>;

  const { turn, push } = configuration;
  const providerName = {
    cloudflare: "Cloudflare TURN",
    coturn: "Coturn / TURN REST",
    unconfigured: "Sin proveedor configurado",
    unsupported: "Proveedor no compatible",
  }[turn.provider];

  return (
    <div className="vt-stack vt-service-setup">
      <section className="vt-card" aria-labelledby="vt-call-setup-title">
        <div className="vt-toolbar">
          <h2 id="vt-call-setup-title">Conexión de llamadas</h2>
          <span className="vta-status">{providerName}</span>
        </div>
        <p>
          {turn.configured
            ? "Configuración guardada en el servidor."
            : "Falta completar la configuración del servidor."}{" "}
          Este estado no comprueba la conexión con el proveedor ni una llamada
          real.
        </p>
        <ul className="vt-setup-checks" aria-label="Variables del servicio">
          {turn.checks.map((check) => (
            <li key={check.name}>
              {check.configured ? (
                <CheckCircle2 aria-hidden="true" />
              ) : (
                <Circle aria-hidden="true" />
              )}
              <code>{check.name}</code>
              <span>{check.configured ? "Configurada" : "Pendiente"}</span>
            </li>
          ))}
        </ul>
        <p className="vt-caption">
          Prueba de llamada real pendiente. Después de guardar las credenciales,
          probá audio y video entre dos dispositivos conectados a redes
          distintas.
        </p>
      </section>

      <section className="vt-card" aria-labelledby="vt-cloudflare-setup-title">
        <h2 id="vt-cloudflare-setup-title">Preparar Cloudflare</h2>
        <ol className="vt-setup-steps">
          <li>
            Abrí tu cuenta en{" "}
            <a
              href="https://dash.cloudflare.com/?to=/:account/calls"
              target="_blank"
              rel="noopener noreferrer"
            >
              Cloudflare Realtime / Calls
            </a>{" "}
            y creá una clave en el servicio TURN.
          </li>
          <li>
            Conservá el <strong>TURN Key ID</strong> y el{" "}
            <strong>API token de esa clave TURN</strong>. No uses el token
            global de la cuenta.
          </li>
          <li>
            En Convex, abrí <strong>Settings → Environment Variables</strong>{" "}
            del despliegue que usa esta web. Agregá las tres variables de la
            plantilla y completá los dos valores vacíos con tus credenciales.
          </li>
        </ol>
        <div className="vt-notice">
          Las credenciales privadas se guardan únicamente en Convex. Esta página
          solo muestra si están configuradas; no las solicita ni las recibe. No
          las pongas en Vercel, la APK, un QR ni variables con prefijo{" "}
          <code>VITE_</code>.
        </div>
        <pre
          className="vt-setup-template"
          aria-label="Plantilla de variables Cloudflare"
        >
          <code>{CLOUDFLARE_TURN_TEMPLATE}</code>
        </pre>
        <div className="vta-actions">
          <Button variant="outline" onClick={() => void copyTemplate()}>
            <Copy aria-hidden="true" /> Copiar plantilla
          </Button>
          {dashboardUrl ? (
            <Button asChild>
              <a href={dashboardUrl} target="_blank" rel="noopener noreferrer">
                Abrir variables en Convex <ExternalLink aria-hidden="true" />
              </a>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <a
                href="https://dashboard.convex.dev"
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir panel de Convex <ExternalLink aria-hidden="true" />
              </a>
            </Button>
          )}
        </div>
        {!dashboardUrl && (
          <p className="vt-caption">
            No se pudo identificar el despliegue desde esta web. Seleccionalo en
            el panel de Convex antes de agregar las variables.
          </p>
        )}
        <p role="status" className="vt-caption">
          {feedback}
        </p>
        <p className="vt-caption">
          Si ya usás coturn, mantené sus propias variables. Para cambiar a
          Cloudflare, seleccioná <code>cloudflare</code> en{" "}
          <code>TIMBRE_TURN_PROVIDER</code>. La configuración incompleta
          mantiene audio y video no disponibles.
        </p>
        <a
          href="https://developers.cloudflare.com/realtime/turn/generate-credentials/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Ver la guía oficial de Cloudflare
        </a>
      </section>

      <section className="vt-card" aria-labelledby="vt-push-setup-title">
        <h2 id="vt-push-setup-title">Notificaciones en Android</h2>
        <p>
          {push.configured
            ? "Servidor de notificaciones configurado."
            : "Configuración del servidor de notificaciones pendiente."}{" "}
          Cloudflare conecta el audio y el video. Los avisos en segundo plano
          requieren además Firebase Cloud Messaging y una APK preparada para ese
          proyecto.
        </p>
        <p className="vt-caption">
          Los avisos de Firebase Cloud Messaging son gratuitos. La cuenta de
          servicio se carga en <code>TIMBRE_FCM_SERVICE_ACCOUNT</code> dentro de
          Convex; el archivo Android se incorpora al compilar la APK nueva.
        </p>
        <a
          href="https://firebase.google.com/pricing"
          target="_blank"
          rel="noopener noreferrer"
        >
          Ver los precios oficiales de Firebase
        </a>
      </section>
    </div>
  );
}
