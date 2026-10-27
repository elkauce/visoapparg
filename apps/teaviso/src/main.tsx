import { ArrowRight, BellRing, Check, QrCode } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { PublicLayout, SolutionCards } from "./ui-v2";
import { solutions } from "./v2-model";
import { FeatureCards } from "./feature-previews";
import { SignCards } from "./sign-pages";
import "./v2.css";
const groups = [
  {
    title: "Personal",
    text: "QR WhatsApp básico. Adicionales de pago.",
    to: "/soluciones/whatsapp",
    detail:
      "Tu número, un mensaje general y QR descargable sin cargo. Podés sumar mensajes por motivo, llamadas o solicitar un número dedicado según contratación.",
    action: "Empezar",
    create: "/panel/nuevo?mode=whatsapp",
  },
  {
    title: "Negocio",
    text: "Horarios, reservas y atención.",
    to: "/soluciones/negocios",
    detail:
      "Servicios, profesionales y agenda para que tus clientes reserven. Configurá cómo recibir visitas en tu negocio o consultorio.",
    action: "Ver funciones",
    create: "/panel/nuevo?mode=negocios",
  },
  {
    title: "Edificio",
    text: "Unidades y asistencia.",
    to: "/soluciones/edificios",
    detail:
      "Timbres por unidad, residentes y responsables. Abono mensual con configuración asistida; condiciones e importe antes de contratar.",
    action: "Conocer la opción",
    create: "/panel/nuevo?mode=edificios",
  },
];
export default function Landing() {
  return (
    <PublicLayout>
      <main className="sb-home">
        <section className="sb-hero">
          <div>
            <span className="sb-eyebrow">Timbre digital</span>
            <h1>
              Tu timbre,
              <br />
              en un QR.
            </h1>
            <p>Escanean en tu puerta y te avisan al celular.</p>
            <div className="sb-actions">
              <Link className="av-button" to="/panel/nuevo">
                Crear mi timbre
              </Link>
              <Link className="sb-text-link" to="/carteles">
                Elegir un cartel
              </Link>
            </div>
          </div>
          <figure>
            <img
              src="/images/cartel-instalado.png"
              width="1448"
              height="1086"
              fetchPriority="high"
              alt="Visualización de una placa vertical Te Aviso instalada junto a una puerta"
            />
            <figcaption>
              Dirección + timbre · Formato vertical compacto · Imagen
              ilustrativa
            </figcaption>
          </figure>
        </section>
        <div className="sb-steps">
          {["Creá tu timbre", "Colocá el QR", "Recibí visitas"].map(
            (label, i) => (
              <div key={label}>
                <span>0{i + 1}</span>
                {label}
              </div>
            ),
          )}
        </div>
        <section className="sb-section" id="como-funciona">
          <header>
            <h2>Así funciona Te Aviso</h2>
            <p>Agenda, llamadas y mensajes, desde tu panel.</p>
          </header>
          <FeatureCards />
          <p className="sb-note">Funciones disponibles según el plan.</p>
        </section>
        <section className="sb-section">
          <header>
            <h2>Un cartel para tu entrada</h2>
            <p>Acrílico o aluminio, con tus datos y tu QR.</p>
          </header>
          <SignCards />
          <p className="sb-note">
            El cartel se compra por separado del plan digital. También podés
            imprimir tu QR.
          </p>
        </section>
        <section className="sb-section">
          <header className="sb-heading-row">
            <h2>Elegí según tu espacio</h2>
            <Link className="sb-text-link" to="/planes">
              Consultar planes →
            </Link>
          </header>
          <div className="sb-plan-cards">
            {groups.map((g) => (
              <Link key={g.title} to={g.to}>
                <h3>{g.title}</h3>
                <p>{g.text}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}
export function Plans() {
  return (
    <PublicLayout>
      <main className="sb-page">
        <header>
          <span className="sb-eyebrow">Planes del servicio</span>
          <h1>Elegí tu timbre</h1>
          <p>Una opción para cada lugar.</p>
        </header>
        <div className="sb-plan-details">
          {groups.map((g) => (
            <article key={g.title} className="av-card">
              <h2>{g.title}</h2>
              <p>{g.detail}</p>
              <Link className="av-button av-outline" to={g.create}>
                {g.action}
              </Link>
              <Link className="sb-text-link" to={g.to}>
                Qué incluye →
              </Link>
            </article>
          ))}
        </div>
        <section className="av-card sb-contract-info">
          <h2>Antes de contratar</h2>
          <p>
            El QR WhatsApp básico es gratuito. Las funciones adicionales
            requieren una licencia compatible; las tarifas, límites y
            condiciones se muestran antes de confirmar la contratación.
          </p>
          <p>El cartel físico y el envío se presupuestan por separado.</p>
          <Link className="av-button" to="/panel/plan">
            Ver ofertas de mi cuenta
          </Link>
        </section>
      </main>
    </PublicLayout>
  );
}
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
