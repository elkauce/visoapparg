import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
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
import "./style.css";

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
const panel = "/panel";

export default function Landing() {
  const [phone, setPhone] = useState("");
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const qrRef = useRef<HTMLDivElement>(null);
  function generate(event: React.FormEvent) {
    event.preventDefault();
    const digits = phone.replace(/[\s()+-]/g, "");
    if (!/^[1-9]\d{7,14}$/.test(digits)) {
      setError(
        "Ingresá el número internacional completo, sin 0 ni 15. Para celulares de Argentina: 549 + característica + número.",
      );
      setQr("");
      return;
    }
    setError("");
    setQr(
      `https://wa.me/${digits}?text=${encodeURIComponent("Hola, estoy en la puerta. ¿Podés atenderme?")}`,
    );
  }
  function download() {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(svg)], {
        type: "image/svg+xml",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "te-a-viso-whatsapp.svg";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <header className="header">
        <a className="brand" href="/" aria-label="Te a Viso, inicio">
          <img src="/symbol.svg" alt="" />
          te a viso<span>POR VISO</span>
        </a>
        <nav aria-label="Principal">
          <a href="#opciones">Cómo funciona</a>
          <a className="button small" href={panel}>
            Mi cuenta <ArrowUpRight size={16} />
          </a>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div>
            <span className="eyebrow">
              <span className="dot" /> UNA NUEVA FORMA DE RECIBIR
            </span>
            <h1>
              Tu puerta.
              <br />
              Estés donde
              <br />
              <em>estés.</em>
            </h1>
            <p>
              Un QR para que tus visitas se comuniquen con vos. Elegí cómo
              atender: por WhatsApp o con tu timbre conectado a VISO.
            </p>
            <div className="actions">
              <a className="button" href="/panel/whatsapp">
                Crear mi QR gratis <ChevronRight size={18} />
              </a>
              <a className="text-link" href={panel}>
                Ya tengo un timbre <ArrowUpRight size={16} />
              </a>
            </div>
            <div className="trust">
              <ShieldCheck size={18} /> El visitante escanea. No necesita
              instalar una app.
            </div>
          </div>
          <div className="scene">
            <span className="scene-label">MENOS DISTANCIA. MÁS CONEXIÓN.</span>
            <div className="door">
              <span className="door-number">24</span>
              <div className="door-handle" />
              <div className="plaque">
                <img src="/symbol.svg" alt="" />
                <strong>¿Llegaste?</strong>
                <div className="sample-qr">
                  <DoorOpen size={58} />
                </div>
                <span>Escaneá para avisarme</span>
                <small>te a viso</small>
              </div>
            </div>
            <div className="notice">
              <span>
                <BellRing size={22} />
              </span>
              <div>
                <strong>Alguien está en tu puerta</strong>
                <small>Tu timbre, conectado con vos.</small>
              </div>
            </div>
            <span className="scene-foot">PARA TU CASA · OFICINA · NEGOCIO</span>
          </div>
        </section>
        <section id="opciones" className="options">
          <div className="section-heading">
            <span className="eyebrow">VOS ELEGÍS CÓMO ATENDER</span>
            <h2>
              Una puerta.
              <br />
              Distintas formas de conectar.
            </h2>
          </div>
          <div className="cards">
            <article>
              <MessageCircle />
              <span className="tag">GRATIS</span>
              <h3>Tu WhatsApp</h3>
              <p>
                Usá tu número y descargá un QR que abre tu chat con un mensaje
                preparado.
              </p>
              <ul>
                <li>
                  <Check /> Sin instalar otra app
                </li>
                <li>
                  <Check /> QR listo para imprimir
                </li>
              </ul>
              <a href="/panel/whatsapp">
                Crear QR <ArrowUpRight size={18} />
              </a>
            </article>
            <article className="featured">
              <Smartphone />
              <span className="tag">CONECTADO A VISO</span>
              <h3>Tu timbre digital</h3>
              <p>
                Administrá tus inmuebles y QR desde tu cuenta. Recibí llamadas
                desde tu panel Te a Viso y la app VISO compatible.
              </p>
              <ul>
                <li>
                  <Check /> Audio y video según tu plan
                </li>
                <li>
                  <Check /> Sin mostrar tu teléfono al visitante
                </li>
              </ul>
              <a href={panel}>
                Abrir mi panel <ArrowUpRight size={18} />
              </a>
            </article>
            <article>
              <DoorOpen />
              <span className="tag">SERVICIO PAGO</span>
              <h3>WhatsApp dedicado</h3>
              <p>
                Un número exclusivo para tu puerta o negocio, con configuración
                y acompañamiento.
              </p>
              <ul>
                <li>
                  <Check /> Separado de tu número personal
                </li>
                <li>
                  <Check /> Número, QR y configuración inicial
                </li>
              </ul>
              <a href="/panel/business">
                Solicitar configuración <ArrowUpRight size={18} />
              </a>
            </article>
          </div>
        </section>
        <section id="crear" className="generator">
          <div>
            <span className="eyebrow">EMPEZÁ SIMPLE</span>
            <h2>
              Tu WhatsApp.
              <br />
              Tu QR. Listo.
            </h2>
            <p>
              Generalo gratis desde acá. El número se procesa en este navegador
              y no se guarda en tu cuenta.
            </p>
            <p className="fine">
              El QR abre un chat, no inicia una llamada automáticamente. Quien
              lo escanee podrá ver tu número. Este QR directo conserva el
              número: si lo cambiás, necesitás imprimir otro.
            </p>
          </div>
          <div className="qr-form">
            <form onSubmit={generate}>
              <label htmlFor="phone">Tu WhatsApp con código de país</label>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="Ej.: +54 9 11 1234 5678"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setQr("");
                  setError("");
                }}
                aria-describedby="phone-help"
                required
              />
              <small id="phone-help">
                Argentina: 549 + característica + número, sin 0 ni 15.
              </small>
              <button className="button" type="submit">
                Generar mi QR <ChevronRight size={18} />
              </button>
              {error && <p role="alert">{error}</p>}
            </form>
            {qr && (
              <div className="qr-result" aria-live="polite">
                <div ref={qrRef}>
                  <QRCodeSVG
                    value={qr}
                    size={220}
                    marginSize={4}
                    level="M"
                    title="QR para abrir tu WhatsApp"
                  />
                </div>
                <button className="button" onClick={download}>
                  Descargar QR
                </button>
                <a href={qr} target="_blank" rel="noopener noreferrer">
                  Probar mi enlace <ArrowUpRight size={16} />
                </a>
              </div>
            )}
          </div>
        </section>
        <section className="ecosystem">
          <span className="eyebrow">
            IDENTIDAD PROPIA. EL MISMO ECOSISTEMA.
          </span>
          <h2>Te a Viso, conectado con VISO.</h2>
          <p>
            Administrá tu timbre desde Te a Viso con tu cuenta del ecosistema
            VISO. Tus inmuebles y permisos se mantienen vinculados.
          </p>
          <a className="button" href={panel}>
            Ingresar con mi cuenta VISO <ArrowUpRight size={18} />
          </a>
        </section>
      </main>
      <footer>
        <a className="brand" href="/">
          <img src="/symbol.svg" alt="" />
          te a viso
        </a>
        <span>Tu puerta, conectada.</span>
        <a href={visoOrigin.href}>
          Conocé VISO <ArrowUpRight size={16} />
        </a>
      </footer>
    </>
  );
}
