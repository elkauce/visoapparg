import {
  ArrowRight,
  BellRing,
  Check,
  LockKeyhole,
  MapPin,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { MarketingLayout } from "./marketing-layout";
import { servicePlans } from "./service-plans";
import { SignPreview } from "./sign-pages";

export function ServiceCards() {
  return (
    <div className="pc-plans">
      {servicePlans.map((plan, i) => (
        <article
          className={`pc-plan ${i === 0 ? "featured" : ""}`}
          key={plan.id}
        >
          <div className="pc-plan-top">
            <span className="pc-icon">
              <plan.icon size={24} />
            </span>
            <span>0{i + 1}</span>
          </div>
          <h3>{plan.title}</h3>
          <p>{plan.description}</p>
          <ul>
            {plan.features.map((feature) => (
              <li key={feature}>
                <Check size={16} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <div className="pc-included">
            <QrCode size={17} />
            Cartel con QR incluido en la propuesta
          </div>
          <Link
            className="pc-button secondary"
            to={`/panel/plan?interes=${plan.id}`}
          >
            Solicitar propuesta <ArrowRight size={17} />
          </Link>
          <small>{plan.availability}</small>
        </article>
      ))}
    </div>
  );
}
export function SignShowcase() {
  const fields = {
    street: "Las Acacias",
    number: "1250",
    name: "",
    profession: "",
    registration: "",
    details: "",
  };
  return (
    <div className="pc-signs">
      {(["address", "qr"] as const).map((model) => (
        <Link key={model} to={`/carteles/${model}`} className="pc-sign-choice">
          <div className="pc-sign-photo">
            <SignPreview
              model={model}
              material="aluminum"
              fields={fields}
              url="https://teaviso-ejemplo.invalid/entrada"
            />
          </div>
          <div>
            <h3>{model === "address" ? "Con dirección" : "Sin dirección"}</h3>
            <ArrowRight size={18} />
            <p>
              {model === "address"
                ? "Calle y número visibles."
                : "Un formato compacto para identificar tu entrada."}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
export function MarketingHome() {
  return (
    <MarketingLayout>
      <main id="inicio" className="pc-marketing">
        <div className="pc-wrap">
          <section className="pc-hero" aria-labelledby="hero-title">
            <div className="pc-hero-copy">
              <p className="pc-eyebrow">
                Un cartel. Un QR. Tu puerta conectada.
              </p>
              <h1 id="hero-title">
                Atendé tu puerta.
                <br />
                <em>Desde tu celular.</em>
              </h1>
              <p className="pc-description">
                Escanean tu cartel y te avisan. Elegí la solución para tu casa,
                tu consultorio o tu edificio.
              </p>
              <div className="pc-actions">
                <Link className="pc-button" to="/planes">
                  Encontrar mi plan <ArrowRight size={18} />
                </Link>
                <a className="pc-button secondary" href="#como-funciona">
                  Ver cómo funciona
                </a>
              </div>
              <div className="pc-trust">
                <span>
                  <Check size={15} />
                  Cartel incluido en la propuesta
                </span>
                <span>
                  <ShieldCheck size={15} />
                  Vos decidís cómo atender
                </span>
              </div>
            </div>
            <figure className="pc-hero-visual">
              <img
                src="/images/cartel-instalado.png"
                width="1448"
                height="1086"
                alt="Ejemplo ilustrativo de un cartel Te Aviso con QR en una entrada"
              />
              <div className="pc-arrival">
                <span className="pc-icon">
                  <BellRing size={25} />
                </span>
                <div>
                  <small>TE AVISO · TU PUERTA</small>
                  <strong>Hay alguien en la entrada</strong>
                  <p>Hola, tengo una entrega para vos.</p>
                </div>
                <span className="pc-live-dot" />
              </div>
              <figcaption>Ilustración de cartel y aviso.</figcaption>
            </figure>
          </section>
          <section className="pc-section" id="planes">
            <SectionHeading
              eyebrow="Una solución para cada lugar"
              title="Elegí dónde lo vas a usar."
              text="Tres servicios pagos. En todos, la propuesta incluye tu cartel con QR."
            />
            <ServiceCards />
          </section>
          <section className="pc-section" id="como-funciona">
            <SectionHeading
              eyebrow="Así de simple"
              title="De tu puerta a tu celular."
              text="La visita escanea. Vos elegís cómo seguir la conversación."
            />
            <div className="pc-steps">
              {[
                [
                  "01",
                  "Elegí tu plan",
                  "Casa, consultorio o edificio. Cada lugar tiene su forma de recibir.",
                ],
                [
                  "02",
                  "Personalizá tu cartel",
                  "Con dirección o sin dirección. Revisás los datos antes de fabricarlo.",
                ],
                [
                  "03",
                  "Atendé a tu manera",
                  "Consultas, turnos o llamadas según el servicio contratado.",
                ],
              ].map(([n, t, d]) => (
                <article key={n}>
                  <span>{n}</span>
                  <div>
                    <h3>{t}</h3>
                    <p>{d}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="pc-section">
            <div className="pc-demo">
              <div>
                <p className="pc-eyebrow">Para tu casa · En preparación</p>
                <h2>
                  Te escriben en la web.
                  <br />
                  Respondés en tu WhatsApp.
                </h2>
                <p>
                  Tu número no aparece en el QR. Si querés pasar a un contacto
                  directo, primero lo autorizás vos.
                </p>
                <Link className="pc-button" to="/planes#hogares">
                  Conocer la propuesta <ArrowRight size={17} />
                </Link>
              </div>
              <div
                className="pc-chat-example"
                aria-label="Ejemplo ilustrativo de conversación"
              >
                <small>UNA VISITA EN TU PUERTA · EJEMPLO</small>
                <p className="outgoing">Hola, estoy en la entrada.</p>
                <p>¡Hola! Ya te atiendo.</p>
                <span>
                  <LockKeyhole size={15} />
                  Tu número permanece privado
                </span>
              </div>
            </div>
            <p className="pc-note">
              El puente con WhatsApp requiere validar la integración antes de
              habilitarlo. No se envían mensajes desde este ejemplo.
            </p>
          </section>
          <section className="pc-section" id="carteles">
            <SectionHeading
              eyebrow="Hecho para tu entrada"
              title="Tu cartel, como lo necesitás."
              text="Con dirección o sin dirección. Para profesionales, con especialidad y matrícula."
            />
            <SignShowcase />
            <div className="pc-actions">
              <Link className="pc-button secondary" to="/carteles">
                Personalizar mi cartel <ArrowRight size={17} />
              </Link>
            </div>
          </section>
          <section className="pc-cta">
            <div>
              <h2>Tu próxima visita empieza acá.</h2>
              <p>Elegí tu lugar y conocé la propuesta para vos.</p>
            </div>
            <Link className="pc-button" to="/planes">
              Ver los planes <ArrowRight size={17} />
            </Link>
          </section>
        </div>
      </main>
    </MarketingLayout>
  );
}
function SectionHeading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="pc-section-heading">
      <div>
        <p className="pc-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <p>{text}</p>
    </div>
  );
}
export function MarketingPlans() {
  return (
    <MarketingLayout plans>
      <main className="pc-marketing pc-wrap pc-plans-page">
        <header className="pc-page-heading">
          <p className="pc-eyebrow">Planes Te Aviso</p>
          <h1>Un plan para tu lugar.</h1>
          <p>
            Elegí cómo querés recibir. Tu cartel con QR forma parte de la
            propuesta de cada servicio.
          </p>
        </header>
        <ServiceCards />
        <section className="pc-section">
          <SectionHeading
            eyebrow="Antes de contratar"
            title="Claro desde el principio."
            text="Confirmamos precio, vigencia, funciones y detalles del cartel en tu propuesta. Enviar una consulta no activa servicios ni realiza cobros."
          />
          <div className="pc-service-details">
            {servicePlans.map((plan) => (
              <article key={plan.id} id={plan.id}>
                <span className="pc-icon">
                  <plan.icon size={24} />
                </span>
                <div>
                  <h2>{plan.title}</h2>
                  <p>{plan.detail}</p>
                  <small>{plan.availability}</small>
                </div>
                <Link
                  className="pc-button secondary"
                  to={`/panel/plan?interes=${plan.id}`}
                >
                  Consultar <ArrowRight size={16} />
                </Link>
              </article>
            ))}
          </div>
        </section>
        <section className="pc-section">
          <SectionHeading
            eyebrow="Privacidad y uso"
            title="Vos decidís cómo atender."
            text="Las condiciones de cada lugar quedan definidas antes de activar el servicio."
          />
          <div className="pc-clarity-grid">
            <article>
              <LockKeyhole />
              <h3>Tu número, a tu manera</h3>
              <p>
                La propuesta de hogares mantiene el número privado hasta que
                autorizás compartirlo. El WhatsApp profesional se usa como
                contacto público del consultorio.
              </p>
            </article>
            <article>
              <MapPin />
              <h3>Llamadas cerca del lugar</h3>
              <p>
                El control de cercanía propuesto es de unos 15 m y todavía está
                por implementar. Depende de permisos y precisión. Las reservas
                se pueden hacer a distancia.
              </p>
            </article>
            <article>
              <ShieldCheck />
              <h3>Apertura autorizada</h3>
              <p>
                Un QR o la ubicación no autorizan una puerta. La apertura en
                edificios requiere implementar el control, validar el equipo y
                dar permiso al residente.
              </p>
            </article>
          </div>
          <p className="pc-note">
            Si el contacto pasa a WhatsApp o al teléfono, Te Aviso no puede
            limitar las llamadas posteriores por distancia. Abrir un chat de
            WhatsApp no inicia automáticamente una llamada de audio o video.
          </p>
        </section>
      </main>
    </MarketingLayout>
  );
}
