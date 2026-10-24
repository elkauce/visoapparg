import {
  ArrowUpRight,
  BellRing,
  Check,
  ChevronRight,
  DoorOpen,
  MessageCircle,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { makeQrPlate, qrTemplates } from "./qr-templates";
import "./style.css";
import StatusScene from "./status-scene";

const configuredViso =
  import.meta.env.VITE_VISO_ORIGIN || "https://viso-deck-android.vercel.app";
const visoOrigin = new URL(configuredViso);
if (
  !["https:", "http:"].includes(visoOrigin.protocol) ||
  visoOrigin.username ||
  visoOrigin.password ||
  visoOrigin.pathname !== "/" ||
  visoOrigin.search ||
  visoOrigin.hash
)
  throw new Error("VITE_VISO_ORIGIN debe ser un origen web válido.");
const sampleUrl = "https://teaviso-manuelhaguilar8-4981s-projects.vercel.app/";
export default function Landing() {
  return (
    <>
      <header className="header">
        <a className="brand" href="/" aria-label="Te a Viso, inicio">
          <span className="tea-original-symbol" aria-hidden="true">
            <img src="/brand/viso-logo.png" alt="" />
          </span>
          Te a Viso<span>POR VISO</span>
        </a>
        <nav aria-label="Principal">
          <a href="#opciones">La experiencia</a>
          <a href="#disenos">Diseños</a>
          <a className="button small" href="/panel">
            Mi cuenta <ArrowUpRight size={16} />
          </a>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div>
            <span className="eyebrow">
              <span className="dot" /> TU ENTRADA, CONECTADA CON VOS
            </span>
            <h1>
              Estés donde
              <br />
              estés.
              <br />
              <em>Te a Viso.</em>
            </h1>
            <p>
              Recibí a tus visitas con una experiencia simple, cuidada y a tu
              medida. Para tu casa, oficina o negocio.
            </p>
            <div className="actions">
              <a className="button" href="/panel/whatsapp">
                Crear mi entrada <ChevronRight size={18} />
              </a>
              <a className="text-link" href="#opciones">
                Conocer las opciones <ArrowUpRight size={16} />
              </a>
            </div>
            <div className="trust">
              <ShieldCheck size={18} /> Tu visita escanea. Vos elegís cómo
              atender.
            </div>
          </div>
          <StatusScene>
            <span className="scene-label">
              <span className="dot" /> TU ENTRADA YA ESTÁ CONECTADA
            </span>
            <div
              className="hero-plate"
              dangerouslySetInnerHTML={{
                __html: makeQrPlate(
                  sampleUrl,
                  "Tu casa · Tu oficina",
                  "minimal",
                ).svg,
              }}
            />
            <div className="notice">
              <span>
                <BellRing size={22} />
              </span>
              <div>
                <strong>Tenés una visita.</strong>
                <small>Tu puerta, siempre cerca.</small>
              </div>
              <span className="notice-time">ahora</span>
            </div>
            <span className="scene-foot">DISEÑADO PARA RECIBIR MEJOR</span>
          </StatusScene>
        </section>
        <section id="opciones" className="options">
          <div className="section-heading">
            <span className="eyebrow">
              UNA EXPERIENCIA. TU FORMA DE RECIBIR.
            </span>
            <h2>Más cerca de quien llega.</h2>
            <p>Elegí la opción que acompaña tu espacio.</p>
          </div>
          <div className="cards">
            <article>
              <MessageCircle />
              <span className="tag">ESENCIAL</span>
              <h3>Tu entrada, a tu estilo.</h3>
              <p>
                Una placa personalizada para que tus visitas te avisen cuando
                llegan.
              </p>
              <ul>
                <li>
                  <Check /> Diseños listos para elegir
                </li>
                <li>
                  <Check /> Administrá tus entradas desde tu cuenta
                </li>
              </ul>
              <a href="/panel/whatsapp">
                Crear mi entrada <ArrowUpRight size={18} />
              </a>
            </article>
            <article className="featured">
              <Smartphone />
              <span className="tag">DIGITAL</span>
              <h3>Atendé desde donde estés.</h3>
              <p>
                Audio y video para recibir con comodidad y cuidar tu privacidad.
              </p>
              <ul>
                <li>
                  <Check /> Lugares, integrantes y permisos
                </li>
                <li>
                  <Check /> Llamadas según tu plan
                </li>
              </ul>
              <a href="/timbre">
                Conocer el timbre digital <ArrowUpRight size={18} />
              </a>
            </article>
            <article>
              <DoorOpen />
              <span className="tag">ASISTIDO</span>
              <h3>Nos ocupamos del inicio.</h3>
              <p>
                Una solución dedicada para tu espacio, con configuración y
                acompañamiento.
              </p>
              <ul>
                <li>
                  <Check /> Puesta en marcha con nuestro equipo
                </li>
                <li>
                  <Check /> Condiciones antes de contratar
                </li>
              </ul>
              <a href="/panel/business">
                Consultar el servicio <ArrowUpRight size={18} />
              </a>
            </article>
          </div>
        </section>
        <section id="disenos" className="plate-showcase">
          <div className="section-heading">
            <span className="eyebrow">EL PRIMER DETALLE DE TU ENTRADA</span>
            <h2>Elegí cómo dar la bienvenida.</h2>
            <p>
              Cuatro diseños, una misma experiencia. Listos para tu espacio.
            </p>
          </div>
          <div className="plate-showcase-grid">
            {qrTemplates.map((template) => (
              <article key={template.id}>
                <div
                  className="plate-sample"
                  dangerouslySetInnerHTML={{
                    __html: makeQrPlate(sampleUrl, "Tu espacio", template.id)
                      .svg,
                  }}
                />
                <span>{template.name}</span>
                <small>{template.description}</small>
              </article>
            ))}
          </div>
          <div className="showcase-footer">
            <small>
              Vistas de muestra. Personalizá tu placa desde tu cuenta.
            </small>
            <a className="button" href="/panel/whatsapp">
              Elegir mi diseño <ArrowUpRight size={16} />
            </a>
          </div>
        </section>
        <section className="ecosystem">
          <span className="eyebrow">
            TU ESPACIO. UNA MEJOR FORMA DE RECIBIR.
          </span>
          <h2>La próxima visita empieza acá.</h2>
          <p>
            Creá tu cuenta y encontrá la opción para tu casa, oficina o negocio.
          </p>
          <a className="button" href="/panel">
            Empezar <ArrowUpRight size={18} />
          </a>
        </section>
      </main>
      <footer>
        <a className="brand" href="/">
          <span className="tea-original-symbol" aria-hidden="true">
            <img src="/brand/viso-logo.png" alt="" />
          </span>
          Te a Viso
        </a>
        <span>Tu puerta, conectada.</span>
        <a href={visoOrigin.href}>
          Un producto del ecosistema VISO <ArrowUpRight size={16} />
        </a>
      </footer>
    </>
  );
}
