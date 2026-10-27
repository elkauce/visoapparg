import { useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowRight,
  ArrowUpRight,
  BellRing,
  BuildingComplex,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Clock3,
  DoorOpen,
  House,
  Layers2,
  MapPin,
  MapPinCheck,
  MessageCircle,
  Minus,
  Package,
  PanelsTopLeft,
  PersonStanding,
  Phone,
  PhoneForwarded,
  Play,
  PlugZap,
  Plus,
  QrCode,
  RotateCcwClock,
  Smartphone,
  Store,
  Users,
} from "lucide-react";
import { MarketingLayout } from "./marketing-layout";
function spaceKey(
  event: KeyboardEvent<HTMLButtonElement>,
  current: string,
  setSpace: (next: string) => void,
) {
  const spaces = ["home", "business", "building"];
  const index = spaces.indexOf(current);
  let next: number | undefined;
  if (event.key === "ArrowRight") next = (index + 1) % 3;
  if (event.key === "ArrowLeft") next = (index + 2) % 3;
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = 2;
  if (next !== undefined) {
    event.preventDefault();
    setSpace(spaces[next]);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>('[data-space="' + spaces[next] + '"]')
      ?.focus();
  }
}
export function MarketingHome() {
  const [space, setSpace] = useState("home");
  return (
    <MarketingLayout plans={false}>
      <main id="inicio">
        <section className="hero wrap" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="live-dot"></span>
              {" TIMBRE DIGITAL · QR + TU CELULAR"}
            </p>
            <h1 id="hero-title">
              {"Tu puerta."}
              <br />
              <span>{"En tu celular."}</span>
            </h1>
            <p className="hero-description">
              {
                "Escanean el QR y te avisan. Elegí mensajes por WhatsApp o llamadas en Te Aviso, y atendé desde donde estés."
              }
            </p>
            <div className="actions">
              <Link to="#modelos" className="button">
                {"Elegir mi timbre "}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link to="#como-funciona" className="text-link">
                {"Cómo funciona "}
                <Play size={14} aria-hidden="true" />
              </Link>
            </div>
            <div className="hero-facts">
              <span>
                <PlugZap size={17} aria-hidden="true" />
                {" Sin instalación eléctrica"}
              </span>
              <span>
                <Smartphone size={17} aria-hidden="true" />
                {" El visitante no instala apps"}
              </span>
            </div>
          </div>
          <figure className="hero-visual">
            <div className="photo-frame">
              <img
                src="/images/cartel-instalado.png"
                width="1448"
                height="1086"
                alt="Ejemplo ilustrativo de una placa Te Aviso con dirección y QR junto a una puerta"
              />
              <span className="image-label">{"TU DIRECCIÓN + TU TIMBRE"}</span>
            </div>
            <div className="arrival-card">
              <span className="arrival-icon">
                <BellRing size={24} aria-hidden="true" />
              </span>
              <div>
                <span className="arrival-kicker">{"TE AVISO · AHORA"}</span>
                <strong>{"Hay alguien en tu puerta"}</strong>
                <span>{"Vos elegís cómo atender."}</span>
              </div>
              <span className="notification-dot"></span>
            </div>
            <figcaption>
              {"Visualización ilustrativa de cartel y aviso."}
            </figcaption>
          </figure>
        </section>
        <div className="wrap">
          <section
            className="steps"
            id="como-funciona"
            aria-label="Cómo funciona"
          >
            <div>
              <span className="step-number">{"01"}</span>
              <span>
                <strong>{"Elegí cómo atender"}</strong>
                <small>{"WhatsApp o Te Aviso Digital."}</small>
              </span>
              <ArrowRight size={17} aria-hidden="true" />
            </div>
            <div>
              <span className="step-number">{"02"}</span>
              <span>
                <strong>{"Creá y colocá tu QR"}</strong>
                <small>{"Imprimilo o elegí un cartel."}</small>
              </span>
              <ArrowRight size={17} aria-hidden="true" />
            </div>
            <div>
              <span className="step-number">{"03"}</span>
              <span>
                <strong>{"Recibí tus visitas"}</strong>
                <small>{"Desde tu celular, estés donde estés."}</small>
              </span>
              <Check size={17} aria-hidden="true" />
            </div>
          </section>
        </div>
        <section className="section wrap models" id="modelos">
          <div className="section-head">
            <div>
              <p className="eyebrow">{"PRIMERO, CÓMO QUERÉS ATENDER"}</p>
              <h2>
                {"Dos formas de recibir."}
                <br />
                {"Elegí la tuya."}
              </h2>
            </div>
            <p>
              {"Mensajes en tu WhatsApp o atención"}
              <br className="desktop-only" />
              {" desde nuestra app. Bien simple."}
            </p>
          </div>
          <div className="model-grid">
            <article className="model-card whatsapp">
              <div className="model-top">
                <span className="model-icon">
                  <MessageCircle size={28} aria-hidden="true" />
                </span>
                <span className="tag">{"CON TU WHATSAPP"}</span>
              </div>
              <h3>{"Te Aviso WhatsApp"}</h3>
              <p className="model-summary">
                {"Un QR para que te escriban"}
                <br />
                {"al número que ya usás."}
              </p>
              <ul className="checks">
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>{"Tu QR para descargar e imprimir."}</span>
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>{"El visitante abre tu WhatsApp."}</span>
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>{"QR básico sin cargo."}</span>
                </li>
              </ul>
              <p className="model-detail">
                {
                  "Podés sumar mensajes preparados o solicitar un número dedicado, según contratación."
                }
              </p>
              <div className="model-end">
                <Link
                  to="/panel/nuevo?mode=whatsapp"
                  className="button outline"
                >
                  {"Elegir WhatsApp "}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
                <p>{"Tu número es visible al iniciar el chat."}</p>
              </div>
            </article>
            <article className="model-card digital">
              <div className="model-top">
                <span className="model-icon">
                  <BellRing size={28} aria-hidden="true" />
                </span>
                <span className="tag">{"CON LA APP TE AVISO"}</span>
              </div>
              <h3>{"Te Aviso Digital"}</h3>
              <p className="model-summary">
                {"Recibí el aviso y atendé"}
                <br />
                {"sin compartir tu número."}
              </p>
              <ul className="checks">
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>{"Avisos y mensajes dentro de Te Aviso."}</span>
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>{"Audio y video según el plan."}</span>
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>{"Compartí la atención con tu familia."}</span>
                </li>
              </ul>
              <p className="model-detail">
                {
                  "Elegí un plan de Avisos, Videollamada o Familia para atender desde nuestra app."
                }
              </p>
              <div className="model-end">
                <Link to="#planes" className="button">
                  {"Ver planes digitales "}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
                <p>{"El visitante contacta desde su navegador."}</p>
              </div>
            </article>
          </div>
          <div className="model-note">
            <Layers2 size={17} aria-hidden="true" />
            <p>
              {
                "Una misma cuenta para tus timbres. Cada modelo tiene su propia configuración."
              }
            </p>
          </div>
        </section>
        <section className="spaces-band" id="espacios">
          <div className="wrap">
            <div className="section-head">
              <div>
                <p className="eyebrow">{"DESPUÉS, DÓNDE LO VAS A USAR"}</p>
                <h2>
                  {"Una entrada."}
                  <br />
                  {"Distintas necesidades."}
                </h2>
              </div>
              <div
                className="space-tabs"
                role="tablist"
                aria-label="Tipo de espacio"
              >
                <button
                  role="tab"
                  id="tab-home"
                  aria-controls="space-home"
                  data-space="home"
                  aria-selected={space === "home"}
                  tabIndex={space === "home" ? 0 : -1}
                  onClick={() => setSpace("home")}
                  onKeyDown={(event) => spaceKey(event, "home", setSpace)}
                >
                  <House size={18} aria-hidden="true" />
                  {" Hogares"}
                </button>
                <button
                  role="tab"
                  id="tab-business"
                  aria-controls="space-business"
                  data-space="business"
                  aria-selected={space === "business"}
                  tabIndex={space === "business" ? 0 : -1}
                  onClick={() => setSpace("business")}
                  onKeyDown={(event) => spaceKey(event, "business", setSpace)}
                >
                  <Store size={18} aria-hidden="true" />
                  {" Negocios"}
                </button>
                <button
                  role="tab"
                  id="tab-building"
                  aria-controls="space-building"
                  data-space="building"
                  aria-selected={space === "building"}
                  tabIndex={space === "building" ? 0 : -1}
                  onClick={() => setSpace("building")}
                  onKeyDown={(event) => spaceKey(event, "building", setSpace)}
                >
                  <BuildingComplex size={18} aria-hidden="true" />
                  {" Edificios"}
                </button>
              </div>
            </div>
            <article
              id="space-home"
              role="tabpanel"
              aria-labelledby="tab-home"
              className="space-panel"
              hidden={space !== "home"}
            >
              <div className="space-copy">
                <span className="small-label">
                  {"HOGARES · CERCANÍA EN PREPARACIÓN"}
                </span>
                <h3>
                  {"Para tocar timbre,"}
                  <br />
                  {"habrá que estar cerca."}
                </h3>
                <p>
                  {
                    "Estamos preparando la verificación de ubicación. Al habilitarla, el contacto desde el QR requerirá estar cerca de la entrada."
                  }
                </p>
                <div className="space-benefit">
                  <MapPinCheck size={21} aria-hidden="true" />
                  <span>
                    <strong>{"Visitas desde tu puerta."}</strong>
                    <br />
                    {"Vos atendés desde cualquier lugar."}
                  </span>
                </div>
                <small>
                  {
                    "La verificación necesita permiso de ubicación y contempla su precisión."
                  }
                </small>
                <Link to="/planes#digital" className="text-link">
                  {"Ver opciones para mi casa "}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </div>
              <div
                className="location-demo"
                aria-label="Ejemplo de verificación de cercanía"
              >
                <div className="location-top">
                  <span>
                    <MapPin size={16} aria-hidden="true" />
                    {" TU ENTRADA"}
                  </span>
                  <span className="location-status">
                    <i></i>
                    {" Cercanía"}
                  </span>
                </div>
                <div className="map-surface">
                  <div className="map-road road-one"></div>
                  <div className="map-road road-two"></div>
                  <div className="map-road road-three"></div>
                  <div className="map-block block-one"></div>
                  <div className="map-block block-two"></div>
                  <div className="map-block block-three"></div>
                  <div className="map-block block-four"></div>
                  <div className="radius radius-two"></div>
                  <div className="radius"></div>
                  <div className="home-pin">
                    <House size={24} aria-hidden="true" />
                  </div>
                  <div className="visitor-pin">
                    <PersonStanding size={20} aria-hidden="true" />
                  </div>
                  <span className="map-home-label">{"Tu casa"}</span>
                </div>
                <div className="location-result">
                  <CircleCheck size={20} aria-hidden="true" />
                  <span>
                    <strong>{"Estás cerca de la entrada"}</strong>
                    <small>{"Podés tocar el timbre."}</small>
                  </span>
                  <span className="demo-label">{"EJEMPLO"}</span>
                </div>
              </div>
            </article>
            <article
              id="space-business"
              role="tabpanel"
              aria-labelledby="tab-business"
              className="space-panel alternate"
              hidden={space !== "business"}
            >
              <div className="space-copy">
                <span className="small-label">{"NEGOCIOS Y CONSULTORIOS"}</span>
                <h3>
                  {"Tus visitas y tus turnos."}
                  <br />
                  {"En el mismo lugar."}
                </h3>
                <p>
                  {
                    "Mostrá tus horarios y servicios. Organizá las reservas y elegí cómo recibir a tus clientes."
                  }
                </p>
                <ul className="checks">
                  <li>
                    <Check size={16} aria-hidden="true" />
                    <span>{"Agenda, servicios y profesionales."}</span>
                  </li>
                  <li>
                    <Check size={16} aria-hidden="true" />
                    <span>{"Mensajes según el motivo de la visita."}</span>
                  </li>
                  <li>
                    <Check size={16} aria-hidden="true" />
                    <span>{"QR y cartel con la identidad de tu negocio."}</span>
                  </li>
                </ul>
                <Link to="/panel/plan?interes=negocios" className="text-link">
                  {"Consultar solución para mi negocio "}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </div>
              <div className="business-demo">
                <div className="demo-header">
                  <CalendarDays size={22} aria-hidden="true" />
                  <strong>{"Agenda de tu negocio"}</strong>
                  <span>{"EJEMPLO"}</span>
                </div>
                <p className="demo-date">{"JUEVES · TU AGENDA"}</p>
                <div className="appointment">
                  <time>{"09:00"}</time>
                  <div>
                    <strong>{"Consulta"}</strong>
                    <small>{"30 minutos · Profesional 1"}</small>
                  </div>
                  <span>{"Confirmado"}</span>
                </div>
                <div className="appointment">
                  <time>{"10:30"}</time>
                  <div>
                    <strong>{"Control"}</strong>
                    <small>{"30 minutos · Profesional 1"}</small>
                  </div>
                  <span>{"Confirmado"}</span>
                </div>
                <div className="appointment available">
                  <time>{"11:00"}</time>
                  <div>
                    <strong>{"Horario disponible"}</strong>
                    <small>{"Tus clientes pueden reservar."}</small>
                  </div>
                  <Plus size={19} aria-hidden="true" />
                </div>
                <div className="demo-footer">
                  <Clock3 size={18} aria-hidden="true" />
                  {" Tus horarios. Tus servicios. Tu atención."}
                </div>
              </div>
            </article>
            <article
              id="space-building"
              role="tabpanel"
              aria-labelledby="tab-building"
              className="space-panel alternate"
              hidden={space !== "building"}
            >
              <div className="space-copy">
                <span className="small-label">{"EDIFICIOS"}</span>
                <h3>
                  {"Cada visita,"}
                  <br />
                  {"al departamento correcto."}
                </h3>
                <p>
                  {
                    "Un acceso claro para las visitas y un panel para administrar unidades, residentes e integrantes."
                  }
                </p>
                <ul className="checks">
                  <li>
                    <Check size={16} aria-hidden="true" />
                    <span>{"Directorio de departamentos."}</span>
                  </li>
                  <li>
                    <Check size={16} aria-hidden="true" />
                    <span>{"Atención por los residentes de cada unidad."}</span>
                  </li>
                  <li>
                    <Check size={16} aria-hidden="true" />
                    <span>
                      {
                        "Abono con configuración y asistencia según contratación."
                      }
                    </span>
                  </li>
                </ul>
                <Link to="/panel/plan?interes=edificios" className="text-link">
                  {"Pedir propuesta para mi edificio "}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </div>
              <div className="building-demo">
                <div className="demo-header">
                  <BuildingComplex size={23} aria-hidden="true" />
                  <strong>{"Elegí un departamento"}</strong>
                  <span>{"EJEMPLO"}</span>
                </div>
                <div className="unit">
                  <span>
                    <DoorOpen size={19} aria-hidden="true" />
                    {" Recepción"}
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </div>
                <div className="unit">
                  <span>
                    <DoorOpen size={19} aria-hidden="true" />
                    {" 1.º A"}
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </div>
                <div className="unit">
                  <span>
                    <DoorOpen size={19} aria-hidden="true" />
                    {" 1.º B"}
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </div>
                <div className="unit">
                  <span>
                    <DoorOpen size={19} aria-hidden="true" />
                    {" 2.º A"}
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </div>
                <div className="demo-footer">
                  <Users size={18} aria-hidden="true" />
                  {" Cada unidad recibe sus propias visitas."}
                </div>
              </div>
            </article>
          </div>
        </section>
        <section className="section wrap plans" id="planes">
          <div className="section-head centered">
            <p className="eyebrow">{"PLANES DE TE AVISO DIGITAL · HOGARES"}</p>
            <h2>{"Elegí cómo querés atender."}</h2>
            <p>{"Avisos, videollamadas o atención en familia."}</p>
            <Link to="/planes#digital" className="all-plans-link text-link">
              {"Ver todo lo que incluye "}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="plans-grid">
            <article className="plan ">
              <h3>{"Avisos"}</h3>
              <p className="plan-description">
                {"Para saber quién llegó y responder."}
              </p>
              <div className="price">
                <span>{"$"}</span>
                {"36.000"}
              </div>
              <p className="price-label">{"ARS · precio de referencia"}</p>
              <ul className="checks">
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>{"Avisos y mensajes en Te Aviso."}</span>
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>{"Historial de visitas."}</span>
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>{"Hasta 3 integrantes."}</span>
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>{"1 placa estándar a confirmar."}</span>
                </li>
              </ul>
              <Link to="/panel/plan?interes=avisos" className="button outline">
                {"Elegir Avisos "}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
            <article className="plan featured">
              <span className="plan-recommend">{"PARA VER Y HABLAR"}</span>
              <h3>{"Videollamada"}</h3>
              <p className="plan-description">
                {"Mirá y hablá con quien está en tu puerta."}
              </p>
              <div className="price">
                <span>{"$"}</span>
                {"48.000"}
              </div>
              <p className="price-label">{"ARS · precio de referencia"}</p>
              <ul className="checks">
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>{"Todo lo incluido en Avisos."}</span>
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>{"Conversación por audio y video."}</span>
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>{"Tu número personal permanece privado."}</span>
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>{"1 placa estándar a confirmar."}</span>
                </li>
              </ul>
              <Link to="/panel/plan?interes=videollamada" className="button ">
                {"Elegir Videollamada "}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
            <article className="plan ">
              <h3>{"Familia"}</h3>
              <p className="plan-description">
                {"Compartí la atención de tu casa."}
              </p>
              <div className="price">
                <span>{"$"}</span>
                {"80.000"}
              </div>
              <p className="price-label">{"ARS · precio de referencia"}</p>
              <ul className="checks">
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>{"Todo lo incluido en Videollamada."}</span>
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>{"Hasta 6 integrantes."}</span>
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>{"Atención compartida desde sus celulares."}</span>
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>{"2 placas estándar a confirmar."}</span>
                </li>
              </ul>
              <Link to="/panel/plan?interes=familia" className="button outline">
                {"Elegir Familia "}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
          </div>
          <p className="pricing-review">
            {
              "Precios de referencia. Vigencia, integrantes, placas y envío se confirman en la propuesta antes de contratar."
            }
          </p>
          <div className="whatsapp-strip">
            <div>
              <span className="whatsapp-mini">
                <MessageCircle size={22} aria-hidden="true" />
              </span>
              <span>
                <strong>{"¿Preferís tu WhatsApp?"}</strong>
                <small>
                  {"El QR básico se configura por separado, sin cargo."}
                </small>
              </span>
            </div>
            <Link to="#modelos" className="text-link">
              {"Ver esta opción "}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="business-strip">
            <span>
              <Store size={19} aria-hidden="true" />
              {" Negocios y consultorios"}
            </span>
            <span>
              <BuildingComplex size={19} aria-hidden="true" />
              {" Edificios"}
            </span>
            <Link to="/planes#negocios" className="text-link">
              {"Ver Negocios y Edificios "}
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
        <section className="section wrap signs" id="carteles">
          <div className="section-head">
            <div>
              <p className="eyebrow">{"TU QR, CON TU IDENTIDAD"}</p>
              <h2>
                {"Un cartel que también"}
                <br />
                {"queda bien en tu puerta."}
              </h2>
            </div>
            <p>
              {"Elegí un diseño o imprimí tu QR."}
              <br className="desktop-only" />
              {" El cartel físico se cotiza por separado."}
            </p>
          </div>
          <div className="signs-grid">
            <article>
              <div className="sign-stage">
                <div className="plate simple">
                  <span className="plate-brand">
                    <img
                      src="/brand/viso-icon.png"
                      alt=""
                      width="17"
                      height="17"
                    />
                    {"Te Aviso"}
                  </span>
                  <QRCodeSVG
                    value="https://example.invalid/te-aviso-diseno"
                    marginSize={0}
                  />
                  <strong>{"Escaneá para avisar"}</strong>
                </div>
                <span className="stage-label">{"EJEMPLO DE DISEÑO"}</span>
              </div>
              <div className="sign-copy">
                <h3>{"Timbre QR"}</h3>
                <p>{"Compacto. Tu acceso directo."}</p>
                <Link to="/carteles/qr" className="text-link">
                  {"Ver diseño "}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </article>
            <article>
              <div className="sign-stage">
                <div className="plate address">
                  <span className="plate-brand">
                    <img
                      src="/brand/viso-icon.png"
                      alt=""
                      width="17"
                      height="17"
                    />
                    {"Te Aviso"}
                  </span>
                  <span>{"San Martín"}</span>
                  <b>{"1234"}</b>
                  <QRCodeSVG
                    value="https://example.invalid/te-aviso-diseno"
                    marginSize={0}
                  />
                  <strong>{"Escaneá para avisar"}</strong>
                </div>
                <span className="stage-label">{"EJEMPLO DE DISEÑO"}</span>
              </div>
              <div className="sign-copy">
                <h3>{"Dirección + timbre"}</h3>
                <p>{"Vertical y compacto. Calle, número y QR."}</p>
                <Link to="/carteles/address" className="text-link">
                  {"Ver diseño "}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </article>
            <article>
              <div className="sign-stage">
                <div className="plate professional">
                  <span className="plate-brand">
                    <img
                      src="/brand/viso-icon.png"
                      alt=""
                      width="17"
                      height="17"
                    />
                    {"Te Aviso"}
                  </span>
                  <span className="plate-profession">{"ODONTOLOGÍA"}</span>
                  <b>{"Dra. Laura Méndez"}</b>
                  <span>{"M.P. 00000 · Datos de ejemplo"}</span>
                  <div className="professional-qr">
                    <QRCodeSVG
                      value="https://example.invalid/te-aviso-diseno"
                      marginSize={0}
                    />
                    <span>
                      {"Escaneá para"}
                      <br />
                      {"anunciar tu llegada"}
                    </span>
                  </div>
                </div>
                <span className="stage-label">{"EJEMPLO DE DISEÑO"}</span>
              </div>
              <div className="sign-copy">
                <h3>{"Profesional"}</h3>
                <p>{"Nombre, profesión, matrícula y timbre."}</p>
                <Link to="/carteles/professional" className="text-link">
                  {"Ver diseño "}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </article>
          </div>
          <p className="small-note">
            {
              "Acrílico o aluminio. Material, medidas, fabricación y entrega sujetos a presupuesto."
            }
          </p>
        </section>
        <section className="section wrap faq">
          <div>
            <p className="eyebrow">{"ANTES DE EMPEZAR"}</p>
            <h2>{"Lo que necesitás saber."}</h2>
          </div>
          <div className="faq-items">
            <details>
              <summary>
                {"¿Necesito instalar un timbre eléctrico? "}
                <Plus size={18} aria-hidden="true" />
              </summary>
              <p>
                {
                  "No. Usás un QR impreso o un cartel. El celular del visitante necesita cámara y conexión a Internet para abrirlo."
                }
              </p>
            </details>
            <details>
              <summary>
                {"¿Quién necesita la app? "}
                <Plus size={18} aria-hidden="true" />
              </summary>
              <p>
                {
                  "En Te Aviso Digital, quien atiende utiliza la app compatible. El visitante contacta desde el navegador. En la opción WhatsApp, el contacto se abre en WhatsApp."
                }
              </p>
            </details>
            <details>
              <summary>
                {"¿Se ve mi número personal? "}
                <Plus size={18} aria-hidden="true" />
              </summary>
              <p>
                {
                  "Con Te Aviso Digital atendés sin publicar tu número. En WhatsApp propio, el visitante ve el número al iniciar el chat."
                }
              </p>
            </details>
            <details>
              <summary>
                {"¿Cómo funciona la cercanía en Hogares? "}
                <Plus size={18} aria-hidden="true" />
              </summary>
              <p>
                {
                  "Esta función está en preparación. Requerirá permiso de ubicación para habilitar el contacto desde el QR. La ubicación es aproximada; quien ya conoce tu WhatsApp puede escribirte por fuera de este acceso."
                }
              </p>
            </details>
            <details>
              <summary>
                {"¿El cartel físico y el servicio son lo mismo? "}
                <Plus size={18} aria-hidden="true" />
              </summary>
              <p>
                {
                  "Son conceptos separados. Las placas indicadas en los planes son una propuesta por confirmar. También podés descargar tu QR e imprimirlo. El presupuesto debe detallar materiales, fabricación, envío y cualquier servicio incluido."
                }
              </p>
            </details>
          </div>
        </section>
        <section className="wrap final-cta" id="empezar">
          <div>
            <p className="eyebrow">{"TU ENTRADA, CONECTADA"}</p>
            <h2>
              {"Empezá por elegir"}
              <br />
              {"cómo querés atender."}
            </h2>
          </div>
          <Link to="#modelos" className="button">
            {"Elegir mi timbre "}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </section>
      </main>
    </MarketingLayout>
  );
}
export function MarketingPlans() {
  return (
    <MarketingLayout plans={true}>
      <main>
        <header className="plans-intro wrap">
          <p className="eyebrow">{"PLANES Y SERVICIOS"}</p>
          <h1>
            {"Elegí cómo atender."}
            <br />
            <span>{"Sumá lo que necesitás."}</span>
          </h1>
          <p>
            {
              "WhatsApp o Te Aviso Digital. Funciones claras para tu casa, negocio o edificio."
            }
          </p>
        </header>
        <nav className="services-nav wrap" aria-label="Servicios del catálogo">
          <Link to="#whatsapp">
            <MessageCircle size={18} aria-hidden="true" />
            {" WhatsApp"}
          </Link>
          <Link to="#digital">
            <BellRing size={18} aria-hidden="true" />
            {" Timbre Digital"}
          </Link>
          <Link to="#negocios">
            <Store size={18} aria-hidden="true" />
            {" Negocios"}
          </Link>
          <Link to="#edificios">
            <BuildingComplex size={18} aria-hidden="true" />
            {" Edificios"}
          </Link>
          <Link to="#complementos">
            <Package size={18} aria-hidden="true" />
            {" Complementos"}
          </Link>
        </nav>
        <section className="catalog-section wrap" id="whatsapp">
          <header className="catalog-heading">
            <div>
              <p className="eyebrow">{"01 · CONTACTO EN TU WHATSAPP"}</p>
              <h2>
                {"Tu número de siempre."}
                <br />
                {"Una entrada más práctica."}
              </h2>
            </div>
            <p>
              {"El visitante escanea y abre un chat."}
              <br />
              {"Tu número es visible en WhatsApp."}
            </p>
          </header>
          <div className="wa-plans">
            <article className="wa-basic">
              <div className="catalog-card-heading">
                <span className="catalog-icon green">
                  <MessageCircle size={24} aria-hidden="true" />
                </span>
                <span className="service-pill">{"BÁSICO"}</span>
              </div>
              <h3>{"WhatsApp propio"}</h3>
              <div className="wa-price">{"Sin cargo"}</div>
              <p>{"Para que te escriban al número que ya usás."}</p>
              <ul className="checks">
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>{"QR para descargar en PNG o SVG."}</span>
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>{"Diseños y nombre de tu timbre editables."}</span>
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>{"Mensaje general al iniciar el chat."}</span>
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>
                    {"Cambio de contacto conservando el enlace del QR."}
                  </span>
                </li>
              </ul>
              <Link to="/panel/nuevo?mode=whatsapp" className="button ">
                {"Elegir WhatsApp "}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <p className="card-footnote">
                {"El visitante confirma el envío desde WhatsApp."}
              </p>
            </article>
            <article className="wa-plus">
              <div className="catalog-card-heading">
                <span className="catalog-icon green">
                  <PanelsTopLeft size={24} aria-hidden="true" />
                </span>
                <span className="service-pill">{"MEJORA DE PAGO"}</span>
              </div>
              <h3>{"Portal de visitas"}</h3>
              <div className="quote-price">{"Consultar"}</div>
              <p>{"Mensajes preparados según quién llega o qué necesita."}</p>
              <ul className="checks">
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>{"Motivos de visita y opciones personalizadas."}</span>
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>
                    {"Mensajes distintos para entregas, visitas o consultas."}
                  </span>
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>
                    {"Edición del portal y sus textos desde tu panel."}
                  </span>
                </li>
                <li>
                  <Check size={16} aria-hidden="true" />
                  <span>{"Acceso desde el mismo QR de tu entrada."}</span>
                </li>
              </ul>
              <Link to="/panel/plan?interes=portal" className="button outline">
                {"Consultar portal de visitas "}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <p className="card-footnote">
                {"Requiere una contratación con mensajes preparados incluidos."}
              </p>
            </article>
          </div>
          <div className="number-callout">
            <Phone size={21} aria-hidden="true" />
            <div>
              <strong>{"¿Querés un número dedicado?"}</strong>
              <p>
                {
                  "Se cotiza y prepara por separado. La propuesta informa el número, la configuración y las condiciones del servicio."
                }
              </p>
            </div>
            <Link to="/panel/business" className="text-link">
              {"Consultar "}
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
        <section className="catalog-section digital-catalog" id="digital">
          <div className="wrap">
            <div className="digital-top">
              <header className="catalog-heading">
                <div>
                  <p className="eyebrow">{"02 · ATENCIÓN EN NUESTRA APP"}</p>
                  <h2>
                    {"Te Aviso Digital."}
                    <br />
                    {"Tu número permanece privado."}
                  </h2>
                </div>
                <p>
                  {"El visitante usa el navegador."}
                  <br />
                  {"Vos atendés en la app compatible o en la web abierta."}
                </p>
              </header>
              <div className="plans-grid detailed-plan-cards">
                <article className="plan ">
                  <h3>{"Avisos"}</h3>
                  <p className="plan-description">
                    {"Para recibir a las visitas por mensajes."}
                  </p>
                  <div className="price">
                    <span>{"$"}</span>
                    {"36.000"}
                  </div>
                  <p className="price-label">{"ARS · precio de referencia"}</p>
                  <ul className="checks">
                    <li>
                      <Check size={16} aria-hidden="true" />
                      <span>{"Chat con la visita dentro de Te Aviso."}</span>
                    </li>
                    <li>
                      <Check size={16} aria-hidden="true" />
                      <span>{"Mensajes cuando no podés atender."}</span>
                    </li>
                    <li>
                      <Check size={16} aria-hidden="true" />
                      <span>{"Historial de comunicaciones."}</span>
                    </li>
                    <li>
                      <Check size={16} aria-hidden="true" />
                      <span>{"Hasta 3 integrantes."}</span>
                    </li>
                  </ul>
                  <div className="plate-in-plan">
                    <QrCode size={17} aria-hidden="true" />
                    {" 1 placa estándar · a confirmar"}
                  </div>
                  <Link
                    to="/panel/plan?interes=avisos"
                    className="button outline"
                  >
                    {"Elegir Avisos "}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </article>
                <article className="plan featured">
                  <span className="plan-recommend">{"PARA VER Y HABLAR"}</span>
                  <h3>{"Videollamada"}</h3>
                  <p className="plan-description">
                    {"Para ver y hablar con quien llega."}
                  </p>
                  <div className="price">
                    <span>{"$"}</span>
                    {"48.000"}
                  </div>
                  <p className="price-label">{"ARS · precio de referencia"}</p>
                  <ul className="checks">
                    <li>
                      <Check size={16} aria-hidden="true" />
                      <span>{"Todo lo incluido en Avisos."}</span>
                    </li>
                    <li>
                      <Check size={16} aria-hidden="true" />
                      <span>{"Llamadas de audio y video."}</span>
                    </li>
                    <li>
                      <Check size={16} aria-hidden="true" />
                      <span>{"Atención desde la app Android compatible."}</span>
                    </li>
                    <li>
                      <Check size={16} aria-hidden="true" />
                      <span>{"Hasta 3 integrantes."}</span>
                    </li>
                  </ul>
                  <div className="plate-in-plan">
                    <QrCode size={17} aria-hidden="true" />
                    {" 1 placa estándar · a confirmar"}
                  </div>
                  <Link
                    to="/panel/plan?interes=videollamada"
                    className="button "
                  >
                    {"Elegir Videollamada "}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </article>
                <article className="plan ">
                  <h3>{"Familia"}</h3>
                  <p className="plan-description">
                    {"Para compartir la atención de tu hogar."}
                  </p>
                  <div className="price">
                    <span>{"$"}</span>
                    {"80.000"}
                  </div>
                  <p className="price-label">{"ARS · precio de referencia"}</p>
                  <ul className="checks">
                    <li>
                      <Check size={16} aria-hidden="true" />
                      <span>{"Todo lo incluido en Videollamada."}</span>
                    </li>
                    <li>
                      <Check size={16} aria-hidden="true" />
                      <span>{"Hasta 6 integrantes en total."}</span>
                    </li>
                    <li>
                      <Check size={16} aria-hidden="true" />
                      <span>{"Invitaciones y permisos por integrante."}</span>
                    </li>
                    <li>
                      <Check size={16} aria-hidden="true" />
                      <span>{"Contacto alternativo si no atendés."}</span>
                    </li>
                  </ul>
                  <div className="plate-in-plan">
                    <QrCode size={17} aria-hidden="true" />
                    {" 2 placas estándar · a confirmar"}
                  </div>
                  <Link
                    to="/panel/plan?interes=familia"
                    className="button outline"
                  >
                    {"Elegir Familia "}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </article>
              </div>
              <p className="pricing-review">
                {
                  "Precios de referencia. Vigencia, integrantes, placas y envío se confirman en la propuesta antes de contratar."
                }
              </p>
            </div>
            <section
              className="digital-included"
              aria-labelledby="included-title"
            >
              <header>
                <span className="included-badge">
                  {"TAMBIÉN EN TIMBRE DIGITAL"}
                </span>
                <h3 id="included-title">{"Más funciones de tu timbre."}</h3>
                <p>
                  {
                    "Se habilitan y configuran según las prestaciones de la licencia contratada."
                  }
                </p>
              </header>
              <div className="feature-grid">
                <article className="feature-item">
                  <span>
                    <QrCode size={21} aria-hidden="true" />
                  </span>
                  <div>
                    <h4>{"Tu QR y tus diseños"}</h4>
                    <p>
                      {
                        "Editá el diseño sin cambiar el enlace del QR. Descargá, pausá o reactivá tu timbre."
                      }
                    </p>
                  </div>
                </article>
                <article className="feature-item">
                  <span>
                    <Clock3 size={21} aria-hidden="true" />
                  </span>
                  <div>
                    <h4>{"Horarios y silencio"}</h4>
                    <p>
                      {
                        "Definí cuándo atender y silenciá temporalmente los avisos."
                      }
                    </p>
                  </div>
                </article>
                <article className="feature-item">
                  <span>
                    <PhoneForwarded size={21} aria-hidden="true" />
                  </span>
                  <div>
                    <h4>{"Cuando no atendés"}</h4>
                    <p>
                      {
                        "Configurá un mensaje de ausencia y un contacto alternativo habilitado."
                      }
                    </p>
                  </div>
                </article>
                <article className="feature-item">
                  <span>
                    <RotateCcwClock size={21} aria-hidden="true" />
                  </span>
                  <div>
                    <h4>{"Historial y mensajes"}</h4>
                    <p>
                      {
                        "Consultá las comunicaciones y los mensajes dejados por las visitas."
                      }
                    </p>
                  </div>
                </article>
                <article className="feature-item">
                  <span>
                    <Users size={21} aria-hidden="true" />
                  </span>
                  <div>
                    <h4>{"Integrantes y permisos"}</h4>
                    <p>
                      {
                        "Invitá a quienes atienden y administrá sus accesos desde tu cuenta."
                      }
                    </p>
                  </div>
                </article>
                <article className="feature-item">
                  <span>
                    <Smartphone size={21} aria-hidden="true" />
                  </span>
                  <div>
                    <h4>{"Atención en Android y web"}</h4>
                    <p>
                      {
                        "App Android compatible; para atender desde la web mantené el panel abierto."
                      }
                    </p>
                  </div>
                </article>
              </div>
              <details className="catalog-details">
                <summary>
                  {"Comparar todas las funciones de los planes "}
                  <ChevronDown size={18} aria-hidden="true" />
                </summary>
                <div
                  className="comparison-scroll"
                  tabIndex={0}
                  aria-label="Comparación de planes Digital"
                >
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">{"Qué incluye"}</th>
                        <th scope="col">{"Avisos"}</th>
                        <th scope="col">{"Videollamada"}</th>
                        <th scope="col">{"Familia"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th scope="row">
                          {"QR descargable y diseño editable"}
                        </th>
                        <td>
                          <span
                            className="table-state yes"
                            aria-label="Incluido"
                          >
                            <Check size={17} aria-hidden="true" />
                          </span>
                        </td>
                        <td>
                          <span
                            className="table-state yes"
                            aria-label="Incluido"
                          >
                            <Check size={17} aria-hidden="true" />
                          </span>
                        </td>
                        <td>
                          <span
                            className="table-state yes"
                            aria-label="Incluido"
                          >
                            <Check size={17} aria-hidden="true" />
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <th scope="row">{"Chat dentro de Te Aviso"}</th>
                        <td>
                          <span
                            className="table-state yes"
                            aria-label="Incluido"
                          >
                            <Check size={17} aria-hidden="true" />
                          </span>
                        </td>
                        <td>
                          <span
                            className="table-state yes"
                            aria-label="Incluido"
                          >
                            <Check size={17} aria-hidden="true" />
                          </span>
                        </td>
                        <td>
                          <span
                            className="table-state yes"
                            aria-label="Incluido"
                          >
                            <Check size={17} aria-hidden="true" />
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <th scope="row">{"Mensajes de visitas sin atender"}</th>
                        <td>
                          <span
                            className="table-state yes"
                            aria-label="Incluido"
                          >
                            <Check size={17} aria-hidden="true" />
                          </span>
                        </td>
                        <td>
                          <span
                            className="table-state yes"
                            aria-label="Incluido"
                          >
                            <Check size={17} aria-hidden="true" />
                          </span>
                        </td>
                        <td>
                          <span
                            className="table-state yes"
                            aria-label="Incluido"
                          >
                            <Check size={17} aria-hidden="true" />
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <th scope="row">{"Registro de comunicaciones"}</th>
                        <td>
                          <span
                            className="table-state yes"
                            aria-label="Incluido"
                          >
                            <Check size={17} aria-hidden="true" />
                          </span>
                        </td>
                        <td>
                          <span
                            className="table-state yes"
                            aria-label="Incluido"
                          >
                            <Check size={17} aria-hidden="true" />
                          </span>
                        </td>
                        <td>
                          <span
                            className="table-state yes"
                            aria-label="Incluido"
                          >
                            <Check size={17} aria-hidden="true" />
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <th scope="row">{"Horarios, silencio y ausencia"}</th>
                        <td>
                          <span
                            className="table-state yes"
                            aria-label="Incluido"
                          >
                            <Check size={17} aria-hidden="true" />
                          </span>
                        </td>
                        <td>
                          <span
                            className="table-state yes"
                            aria-label="Incluido"
                          >
                            <Check size={17} aria-hidden="true" />
                          </span>
                        </td>
                        <td>
                          <span
                            className="table-state yes"
                            aria-label="Incluido"
                          >
                            <Check size={17} aria-hidden="true" />
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <th scope="row">
                          {"Contactos de atención y alternativos"}
                        </th>
                        <td>
                          <span
                            className="table-state yes"
                            aria-label="Incluido"
                          >
                            <Check size={17} aria-hidden="true" />
                          </span>
                        </td>
                        <td>
                          <span
                            className="table-state yes"
                            aria-label="Incluido"
                          >
                            <Check size={17} aria-hidden="true" />
                          </span>
                        </td>
                        <td>
                          <span
                            className="table-state yes"
                            aria-label="Incluido"
                          >
                            <Check size={17} aria-hidden="true" />
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <th scope="row">{"Llamadas de audio y video"}</th>
                        <td>
                          <span
                            className="table-state no"
                            aria-label="No incluido"
                          >
                            <Minus size={17} aria-hidden="true" />
                          </span>
                        </td>
                        <td>
                          <span
                            className="table-state yes"
                            aria-label="Incluido"
                          >
                            <Check size={17} aria-hidden="true" />
                          </span>
                        </td>
                        <td>
                          <span
                            className="table-state yes"
                            aria-label="Incluido"
                          >
                            <Check size={17} aria-hidden="true" />
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <th scope="row">{"Integrantes totales propuestos"}</th>
                        <td>{"3"}</td>
                        <td>{"3"}</td>
                        <td>{"6"}</td>
                      </tr>
                      <tr>
                        <th scope="row">{"Placas estándar propuestas"}</th>
                        <td>{"1"}</td>
                        <td>{"1"}</td>
                        <td>{"2"}</td>
                      </tr>
                      <tr>
                        <th scope="row">{"Agenda y reservas"}</th>
                        <td>{"Solución Negocios"}</td>
                        <td>{"Solución Negocios"}</td>
                        <td>{"Solución Negocios"}</td>
                      </tr>
                      <tr>
                        <th scope="row">{"Unidades y residentes"}</th>
                        <td>{"Solución Edificios"}</td>
                        <td>{"Solución Edificios"}</td>
                        <td>{"Solución Edificios"}</td>
                      </tr>
                      <tr>
                        <th scope="row">{"Número WhatsApp dedicado"}</th>
                        <td>{"Adicional"}</td>
                        <td>{"Adicional"}</td>
                        <td>{"Adicional"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="comparison-note">
                  {
                    "La tabla distribuye funciones existentes en paquetes propuestos. Los cupos y condiciones finales se confirman al contratar."
                  }
                </p>
              </details>
              <details className="catalog-details">
                <summary>
                  {"Aplicaciones, notificaciones y conservación del historial "}
                  <ChevronDown size={18} aria-hidden="true" />
                </summary>
                <div className="detail-copy">
                  <p>
                    <strong>{"Android:"}</strong>
                    {
                      " requiere la app compatible, los permisos correspondientes y registrar ese celular para recibir avisos. El audio y video necesitan micrófono y cámara."
                    }
                  </p>
                  <p>
                    <strong>{"Web:"}</strong>
                    {
                      " el propietario mantiene abierto el panel para recibir y atender. El visitante no necesita cuenta ni instalar nuestra app."
                    }
                  </p>
                  <p>
                    <strong>{"Historial:"}</strong>
                    {
                      " el panel consulta hasta las últimas 100 comunicaciones de los últimos 90 días; los mensajes se conservan hasta 30 días. No incluye grabación de llamadas."
                    }
                  </p>
                </div>
              </details>
            </section>
            <aside className="proximity-pending">
              <MapPinCheck size={23} aria-hidden="true" />
              <div>
                <span className="pending-label">
                  {"HOGARES · EN PREPARACIÓN"}
                </span>
                <h3>{"Solo tocar timbre estando cerca de la casa."}</h3>
                <p>
                  {
                    "La verificación de ubicación forma parte de la propuesta nueva. Se implementará y probará antes de ofrecerla como función activa."
                  }
                </p>
              </div>
            </aside>
          </div>
        </section>
        <section className="catalog-section wrap" id="negocios">
          <header className="catalog-heading">
            <div>
              <p className="eyebrow">{"03 · NEGOCIOS Y CONSULTORIOS"}</p>
              <h2>
                {"Visitas y reservas."}
                <br />
                {"En el mismo lugar."}
              </h2>
            </div>
            <p>
              {"Una propuesta según tu actividad,"}
              <br />
              {"tu forma de atender y tu equipo."}
            </p>
          </header>
          <article className="solution-offer business-offer">
            <div className="solution-price">
              <span className="catalog-icon">
                <CalendarDays size={25} aria-hidden="true" />
              </span>
              <h3>{"Negocios"}</h3>
              <strong>{"A cotizar"}</strong>
              <p>{"Servicios, profesionales y agenda."}</p>
              <Link to="/panel/plan?interes=negocios" className="button ">
                {"Pedir propuesta para mi negocio "}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <small>
                {
                  "La cotización define precio, período y prestaciones incluidas."
                }
              </small>
            </div>
            <div className="solution-functions">
              <div className="included-line">
                <strong>{"Agenda de reservas"}</strong>
                <span>
                  {
                    "Horarios disponibles, duración de servicios y profesionales."
                  }
                </span>
              </div>
              <div className="included-line">
                <strong>{"Gestión de turnos"}</strong>
                <span>
                  {"Confirmación, reprogramación y cancelación de reservas."}
                </span>
              </div>
              <div className="included-line">
                <strong>{"Horarios y bloqueos"}</strong>
                <span>
                  {"Definí días de atención, excepciones y disponibilidad."}
                </span>
              </div>
              <div className="included-line">
                <strong>{"Portal de visitas"}</strong>
                <span>
                  {
                    "Motivos y mensajes preparados para clientes, consultas y entregas."
                  }
                </span>
              </div>
              <div className="included-line">
                <strong>{"Cómo atender"}</strong>
                <span>
                  {
                    "Elegí WhatsApp o Te Aviso Digital. Las llamadas requieren su prestación incluida."
                  }
                </span>
              </div>
              <div className="included-line">
                <strong>{"Tu marca en la entrada"}</strong>
                <span>
                  {
                    "QR y posibilidad de cartel con nombre, profesión y matrícula, presupuestado aparte."
                  }
                </span>
              </div>
              <p className="offer-clarification">
                {
                  "La propuesta detalla espacios, profesionales, integrantes y modalidad de atención incluidos."
                }
              </p>
            </div>
          </article>
        </section>
        <section className="catalog-section wrap" id="edificios">
          <header className="catalog-heading">
            <div>
              <p className="eyebrow">{"04 · DEPARTAMENTOS Y RESIDENTES"}</p>
              <h2>
                {"Un edificio organizado."}
                <br />
                {"Cada visita, a su unidad."}
              </h2>
            </div>
            <p>
              {"Administración del timbre digital"}
              <br />
              {"y ayuda para ponerlo en marcha."}
            </p>
          </header>
          <article className="solution-offer building-offer">
            <div className="solution-price">
              <span className="catalog-icon purple">
                <BuildingComplex size={25} aria-hidden="true" />
              </span>
              <h3>{"Edificios"}</h3>
              <strong>
                {"A cotizar "}
                <span>{"/ mes"}</span>
              </strong>
              <p>{"Abono por edificio, con asistencia."}</p>
              <Link to="/panel/plan?interes=edificios" className="button ">
                {"Pedir propuesta para mi edificio "}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <small>
                {
                  "Unidades, residentes, puesta en marcha y alcance de asistencia definidos en la cotización."
                }
              </small>
            </div>
            <div className="solution-functions">
              <div className="included-line">
                <strong>{"Directorio de unidades"}</strong>
                <span>
                  {
                    "Recepción, departamentos y selección de destino para la visita."
                  }
                </span>
              </div>
              <div className="included-line">
                <strong>{"Residentes por departamento"}</strong>
                <span>
                  {
                    "Cada integrante recibe las comunicaciones de sus unidades autorizadas."
                  }
                </span>
              </div>
              <div className="included-line">
                <strong>{"Responsables y permisos"}</strong>
                <span>
                  {
                    "Propietario, administradores e integrantes con accesos definidos."
                  }
                </span>
              </div>
              <div className="included-line">
                <strong>{"Invitaciones y contactos"}</strong>
                <span>
                  {
                    "Altas, bajas y organización de las personas que pueden atender."
                  }
                </span>
              </div>
              <div className="included-line">
                <strong>{"QR y comunicaciones"}</strong>
                <span>
                  {
                    "QR general o por unidad; chat, audio y video según la prestación contratada."
                  }
                </span>
              </div>
              <div className="included-line">
                <strong>{"Configuración asistida"}</strong>
                <span>
                  {
                    "Ayuda para la puesta en marcha y asistencia con el alcance acordado."
                  }
                </span>
              </div>
              <p className="offer-clarification">
                {
                  "El alcance, los canales y los horarios de asistencia se definen en la propuesta."
                }
              </p>
            </div>
          </article>
        </section>
        <section className="catalog-section extras-band" id="complementos">
          <div className="wrap">
            <header className="catalog-heading">
              <div>
                <p className="eyebrow">{"COMPLEMENTOS Y BENEFICIOS"}</p>
                <h2>
                  {"Todo en su lugar."}
                  <br />
                  {"Sin mezclar compras y planes."}
                </h2>
              </div>
              <p>
                {"Hardware, carteles y número dedicado"}
                <br />
                {"tienen sus propias condiciones."}
              </p>
            </header>
            <div className="extra-grid">
              <article className="extra-card">
                <span className="catalog-icon blue">
                  <PanelsTopLeft size={24} aria-hidden="true" />
                </span>
                <span className="service-pill">{"BENEFICIO DE COMPRA"}</span>
                <h3>{"Con hardware VISO"}</h3>
                <p>
                  {
                    "Si tu equipo indica Timbre incluido, activás el servicio de esa compra en tu cuenta."
                  }
                </p>
                <ul className="checks">
                  <li>
                    <Check size={16} aria-hidden="true" />
                    <span>
                      {"Prestaciones y vigencia indicadas en el producto."}
                    </span>
                  </li>
                  <li>
                    <Check size={16} aria-hidden="true" />
                    <span>{"Vinculación a la cuenta propietaria."}</span>
                  </li>
                  <li>
                    <Check size={16} aria-hidden="true" />
                    <span>
                      {"Señalización con estados VISO cuando esté configurada."}
                    </span>
                  </li>
                </ul>
                <p className="extra-note">
                  {
                    "No requiere otra contratación por las prestaciones ya incluidas. La compatibilidad de cada dispositivo se informa en su ficha."
                  }
                </p>
                <Link
                  to="/panel/plan?interes=hardware"
                  className="button outline"
                >
                  {"Consultar equipos con Timbre "}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </article>
              <article className="extra-card">
                <span className="catalog-icon">
                  <QrCode size={24} aria-hidden="true" />
                </span>
                <span className="service-pill">{"PRODUCTO FÍSICO"}</span>
                <h3>{"Carteles personalizados"}</h3>
                <p>
                  {
                    "Un diseño para tu puerta, tu dirección o tu actividad profesional."
                  }
                </p>
                <ul className="checks">
                  <li>
                    <Check size={16} aria-hidden="true" />
                    <span>
                      {"Timbre QR, dirección vertical o profesional."}
                    </span>
                  </li>
                  <li>
                    <Check size={16} aria-hidden="true" />
                    <span>{"Acrílico o aluminio, según presupuesto."}</span>
                  </li>
                  <li>
                    <Check size={16} aria-hidden="true" />
                    <span>{"Revisión de datos y QR antes de fabricar."}</span>
                  </li>
                </ul>
                <p className="extra-note">
                  {
                    "Las placas estándar indicadas en los planes son una propuesta. Personalización, materiales especiales y envío se detallan antes de confirmar."
                  }
                </p>
                <Link to="/#carteles" className="button outline">
                  {"Ver diseños de carteles "}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </article>
              <article className="extra-card">
                <span className="catalog-icon green">
                  <Phone size={24} aria-hidden="true" />
                </span>
                <span className="service-pill">{"SERVICIO ADICIONAL"}</span>
                <h3>{"Número dedicado"}</h3>
                <p>
                  {
                    "Solicitá un número separado de tu WhatsApp personal para recibir contactos."
                  }
                </p>
                <ul className="checks">
                  <li>
                    <Check size={16} aria-hidden="true" />
                    <span>
                      {"Preparación y asignación manual del servicio."}
                    </span>
                  </li>
                  <li>
                    <Check size={16} aria-hidden="true" />
                    <span>{"QR vinculado al número preparado."}</span>
                  </li>
                  <li>
                    <Check size={16} aria-hidden="true" />
                    <span>{"Precio y condiciones antes de contratar."}</span>
                  </li>
                </ul>
                <p className="extra-note">
                  {
                    "Se presupuesta aparte. No incluye una central ni transferencia de llamadas WhatsApp."
                  }
                </p>
                <Link to="/panel/business" className="button outline">
                  {"Consultar número dedicado "}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </article>
            </div>
          </div>
        </section>
        <section className="catalog-section wrap ownership">
          <div>
            <p className="eyebrow">{"CUANDO YA TENÉS TE AVISO"}</p>
            <h2>{"Tu servicio, bien claro."}</h2>
            <p>
              {
                "En tu cuenta, revisá el plan activo de cada timbre, lo que incluye, sus límites y cuándo vence."
              }
            </p>
          </div>
          <div className="ownership-details">
            <div className="included-line">
              <strong>{"Plan y prestaciones"}</strong>
              <span>{"Qué está activo y qué funciones podés configurar."}</span>
            </div>
            <div className="included-line">
              <strong>{"Importe y período"}</strong>
              <span>
                {
                  "Pago por un período determinado o abono, según lo contratado."
                }
              </span>
            </div>
            <div className="included-line">
              <strong>{"Cupos y vigencia"}</strong>
              <span>
                {"Timbres, QR, integrantes, unidades y fecha de vencimiento."}
              </span>
            </div>
            <div className="included-line">
              <strong>{"Compras y adicionales"}</strong>
              <span>
                {
                  "Hardware con beneficio, carteles y servicios contratados aparte."
                }
              </span>
            </div>
            <small>
              {
                "Cada timbre muestra sus prestaciones y las condiciones de su contratación."
              }
            </small>
          </div>
        </section>
        <section className="wrap final-cta">
          <div>
            <p className="eyebrow">{"EMPEZÁ POR CÓMO QUERÉS ATENDER"}</p>
            <h2>
              {"Elegí tu modelo."}
              <br />
              {"Configurá tu timbre."}
            </h2>
          </div>
          <Link to="/#modelos" className="button">
            {"Ver las opciones "}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </section>
      </main>
    </MarketingLayout>
  );
}
