import {
  ArrowRight,
  BellRing,
  Check,
  ChevronDown,
  Download,
  QrCode,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { makeQrPlate, qrTemplates } from "./qr-templates";
import { PublicLayout, SolutionCards } from "./ui-v2";
import { solutions } from "./v2-model";
import "./v2.css";
const sampleUrl = "https://teaviso-manuelhaguilar8-4981s-projects.vercel.app";
export default function Landing() {
  return (
    <PublicLayout>
      <main className="av-home">
        <section className="av-hero">
          <div className="av-hero-copy">
            <span className="av-eyebrow">Para tu casa, negocio o edificio</span>
            <h1>
              Tu timbre digital.
              <br />
              Fácil de <em>instalar.</em>
            </h1>
            <p>
              Poné un QR en tu puerta y recibí a tus visitas desde el celular.
              Ellas escanean. Vos elegís cómo atender.
            </p>
            <div className="av-actions">
              <Link className="av-button" to="/panel/nuevo">
                Crear mi timbre <ArrowRight size={18} />
              </Link>
              <a className="av-button av-outline" href="#como-funciona">
                Ver cómo se instala <ArrowRight size={18} />
              </a>
            </div>
            <small className="av-hero-note">
              <Check size={16} /> La opción con QR no requiere cableado.
            </small>
          </div>
          <div className="av-hero-image">
            <img
              src="/images/timbre-qr.png"
              alt="Ejemplo de placa QR junto a una puerta y aviso de timbre en un celular"
              width="1122"
              height="1402"
              fetchPriority="high"
            />
            <span>Imagen ilustrativa · personalizá tu QR</span>
          </div>
        </section>
        <section className="av-home-solutions" aria-label="Elegí tu timbre">
          <SolutionCards />
        </section>
        <section id="como-funciona" className="av-section">
          <span className="av-eyebrow">Así de simple</span>
          <h2>Tu timbre, listo en tres pasos.</h2>
          <div className="av-steps">
            {[
              {
                title: "Creá tu entrada",
                text: "Elegí cómo querés recibir visitas.",
                icon: Smartphone,
              },
              {
                title: "Pegá tu QR",
                text: "Descargalo y colocalo en la puerta.",
                icon: QrCode,
              },
              {
                title: "Recibí el aviso",
                text: "Tu visita escanea y vos atendés.",
                icon: BellRing,
              },
            ].map((s, i) => (
              <article key={s.title}>
                <span className={`av-step-number step-${i}`}>{i + 1}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
                <s.icon />
              </article>
            ))}
          </div>
          <p className="av-muted">
            WhatsApp requiere que la visita confirme el envío. Para recibir
            llamadas en la web, mantené el panel abierto; en Android usá la APK
            VISO compatible y sus permisos.
          </p>
        </section>
        <section className="av-section av-qr-section">
          <div>
            <span className="av-eyebrow">Una entrada con tu estilo</span>
            <h2>
              Elegí el diseño.
              <br />
              El QR sigue siendo tuyo.
            </h2>
            <p>
              Actualizá el contacto sin volver a imprimir. Elegí entre cuatro
              diseños y descargá tu placa para colocarla donde quieras.
            </p>
            <Link className="av-button" to="/panel/nuevo">
              Crear mi entrada <Download size={17} />
            </Link>
          </div>
          <div className="av-plate-grid">
            {qrTemplates.map((q) => (
              <article key={q.id}>
                <div
                  dangerouslySetInnerHTML={{
                    __html: makeQrPlate(sampleUrl, "Tu entrada", q.id).svg,
                  }}
                />
                <strong>{q.name}</strong>
              </article>
            ))}
          </div>
        </section>
        <section className="av-section av-ecosystem">
          <Sparkles />
          <div>
            <span className="av-eyebrow">Tu espacio, conectado</span>
            <h2>Sumá luz y equipos VISO.</h2>
            <p>
              Conocé el beneficio Timbre de los equipos participantes y las
              opciones de luz y acceso en validación.
            </p>
          </div>
          <Link className="av-button av-outline" to="/equipos">
            Conocer los equipos <ArrowRight size={18} />
          </Link>
        </section>
        <section className="av-section av-faq">
          <span className="av-eyebrow">Antes de empezar</span>
          <h2>Todo un poco más simple.</h2>
          {[
            [
              "¿La visita tiene que instalar una app?",
              "No. Escanea el QR y abre tu entrada desde el navegador. Si elegís WhatsApp, continúa allí para enviarte el mensaje.",
            ],
            [
              "¿Necesito comprar un timbre físico?",
              "La opción con QR funciona con una placa o impresión. Las luces, controladores y cerraduras son adicionales y requieren compatibilidad e instalación propias.",
            ],
            [
              "¿Puedo usarlo en una casa o departamento?",
              "Sí. Podés crear una entrada individual. Los edificios también tienen una opción con departamentos, residentes y asistencia.",
            ],
            [
              "¿Qué es gratuito?",
              "El QR a tu propio WhatsApp, su mensaje general y los diseños descargables. Mensajes preguardados y número dedicado son mejoras de pago. Reservas y edificios requieren el plan correspondiente.",
            ],
            [
              "¿Qué pasa con mi cuenta VISO?",
              "Es la misma cuenta. Conservás tus timbres y las licencias vigentes; no hace falta registrarte otra vez.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <ChevronDown size={18} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
        <section className="av-final">
          <h2>La próxima visita empieza acá.</h2>
          <Link className="av-button" to="/panel/nuevo">
            Crear mi timbre <ArrowRight size={18} />
          </Link>
        </section>
      </main>
    </PublicLayout>
  );
}
export function Plans() {
  return (
    <PublicLayout>
      <main className="av-page">
        <header className="av-page-heading">
          <span className="av-eyebrow">Elegí cómo recibir</span>
          <h1>
            Un timbre digital para
            <br />
            tu forma de <em>recibir.</em>
          </h1>
          <p>Empezá con tu QR y elegí las funciones que necesitás.</p>
        </header>
        <SolutionCards expanded />
        <section className="av-callout">
          <BellRing />
          <div>
            <h2>Una cuenta, tus espacios conectados.</h2>
            <p>
              Los importes, límites y condiciones de cada oferta se muestran
              antes de contratar. El número dedicado tiene configuración y
              mantenimiento según las condiciones del servicio.
            </p>
          </div>
          <Link className="av-button" to="/panel/plan">
            Ver ofertas disponibles <ArrowRight size={17} />
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
  return (
    <PublicLayout>
      <main className="av-page">
        <header className="av-page-heading">
          <span className="av-eyebrow">Tu entrada, conectada</span>
          <h1>
            Equipos elegidos.
            <br />
            Tu espacio, <em>conectado.</em>
          </h1>
          <p>
            El catálogo de equipos oficiales se habilita cuando cada combinación
            está validada. Consultá el estado antes de comprar.
          </p>
        </header>
        <div className="av-equipment-grid">
          <article className="av-card">
            <QrCode size={38} />
            <span className="av-tag">Disponible</span>
            <h2>Tu placa QR</h2>
            <p>
              Creala y descargala desde tu cuenta. La instalación de la placa no
              requiere cableado.
            </p>
            <Link className="av-button" to="/panel/nuevo">
              Crear mi placa
            </Link>
          </article>
          <article className="av-card">
            <Sparkles size={38} />
            <span className="av-tag">En evaluación</span>
            <h2>Indicador de luz RGB</h2>
            <p>
              Tapo L535E con Matter es una candidata para pruebas. Su
              compatibilidad con VISO y la variante regional todavía deben
              validarse.
            </p>
            <Link to="/panel/dispositivos">Ver estado de dispositivos ↗</Link>
          </article>
          <article className="av-card">
            <BellRing size={38} />
            <span className="av-tag">Selección pendiente</span>
            <h2>Kit de apertura</h2>
            <p>
              Controlador, cerradura y sensor elegidos según la puerta. Requiere
              validación e instalación; escanear el QR no autoriza la apertura.
            </p>
            <Link to="/panel/dispositivos">Consultar el kit ↗</Link>
          </article>
        </div>
        <div className="av-callout">
          <p>
            El beneficio Timbre de un equipo VISO depende de una compra elegible
            y de las condiciones publicadas. Comprar cualquier luz o producto
            afiliado no lo activa.
          </p>
          <a
            className="av-button av-outline"
            href="https://viso-deck-android.vercel.app/marketplace?category=hardware"
            target="_blank"
            rel="noopener noreferrer"
          >
            Explorar hardware VISO ↗
          </a>
        </div>
      </main>
    </PublicLayout>
  );
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
