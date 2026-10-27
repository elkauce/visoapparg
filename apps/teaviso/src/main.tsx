import { ArrowRight, BellRing, Check, QrCode } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { PublicLayout, SolutionCards } from "./ui-v2";
import { solutions } from "./v2-model";
import "./v2.css";
export { MarketingHome as default, MarketingPlans as Plans } from "./marketing";
export function Solutions() {
  const { solution } = useParams();
  const selected = solutions.find((s) => s.id === solution);
  return (
    <PublicLayout>
      <main className="av-page">
        <header className="av-page-heading">
          <span className="av-eyebrow">Te Aviso, a tu medida</span>
          <h1>{selected?.title ?? "Tu entrada. Tus opciones."}</h1>
          <p>
            {selected?.description ??
              "Para tu casa, departamento, negocio, oficina o edificio."}
          </p>
        </header>
        {selected ? (
          <section className="av-solution-detail">
            <selected.icon size={44} />
            <ul>
              {selected.features.map((f) => (
                <li key={f}>
                  <Check />
                  {f}
                </li>
              ))}
            </ul>
            {selected.id === "whatsapp" && (
              <p>
                Conservá tu número con la opción gratuita. Podés sumar mensajes
                por empresa o tipo de visita y solicitar un número dedicado como
                mejoras independientes.
              </p>
            )}
            {selected.id === "negocios" && (
              <p>
                Configurá los servicios, su duración y los profesionales. Tus
                clientes eligen un horario disponible desde tu enlace. Vos
                gestionás la agenda y los avisos desde tu panel.
              </p>
            )}
            {selected.id === "edificios" && (
              <p>
                El responsable configura las unidades y las invitaciones. Cada
                residente atiende las visitas de sus departamentos. El abono y
                la asistencia se definen antes de contratar.
              </p>
            )}
            <Link
              className="av-button"
              to={
                selected.id === "hardware"
                  ? "/equipos"
                  : `/panel/nuevo?mode=${selected.id}`
              }
            >
              Configurar mi entrada <ArrowRight size={18} />
            </Link>
          </section>
        ) : (
          <SolutionCards expanded />
        )}
        <div className="av-callout">
          <QrCode />
          <p>
            Una placa QR, un enlace estable y una forma sencilla de atender a
            quienes llegan.
          </p>
          <Link to="/planes">Comparar opciones ↗</Link>
        </div>
      </main>
    </PublicLayout>
  );
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
