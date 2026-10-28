import { Link, Navigate, useParams } from "react-router-dom";
import { PublicLayout } from "./ui-v2";
import "./v2.css";
export { MarketingHome as default, MarketingPlans as Plans } from "./marketing";
export function Solutions() {
  const { solution } = useParams();
  const target =
    solution === "edificios"
      ? "edificios"
      : solution === "negocios"
        ? "negocios"
        : solution === "whatsapp" || solution === "hogares"
          ? "hogares"
          : "";
  return <Navigate to={`/planes${target ? `#${target}` : ""}`} replace />;
}
export function Equipment() {
  return <Navigate to="/carteles" replace />;
}
export function Privacy() {
  return (
    <PublicLayout>
      <main className="av-page av-reading">
        <h1>Privacidad y uso de tu entrada</h1>
        <p>
          Tu visita puede comunicarse mediante las opciones que habilites. El QR
          público no es una credencial para abrir puertas ni para administrar tu
          cuenta.
        </p>
        <h2>WhatsApp y mensajes</h2>
        <p>
          Al continuar en WhatsApp se muestra el número de contacto y se prepara
          el mensaje. El visitante decide enviarlo. La empresa o motivo
          seleccionado lo declara la visita; no verifica su identidad.
        </p>
        <h2>Reservas</h2>
        <p>
          El nombre y contacto se usan para gestionar el turno y son visibles al
          responsable del espacio. La disponibilidad pública no muestra los
          datos de otras reservas. Conservá tu enlace privado de gestión y no lo
          compartas.
        </p>
        <h2>Cuenta y notificaciones</h2>
        <p>
          Te Aviso comparte tu cuenta con VISO. Para recibir desde la web, el
          panel debe estar abierto. Las llamadas Android requieren una APK
          compatible, permisos y condiciones de recepción del dispositivo.
        </p>
        <h2>Servicios y equipos</h2>
        <p>
          Antes de contratar se muestran los importes, vigencia y condiciones de
          la oferta. Las prestaciones físicas requieren equipo compatible y
          validado. Los datos del prestador y las condiciones comerciales
          completas se informan al habilitar cada oferta.
        </p>
        <Link className="av-button" to="/panel">
          Ir a mi cuenta
        </Link>
      </main>
    </PublicLayout>
  );
}
