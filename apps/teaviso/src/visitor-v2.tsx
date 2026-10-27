import { useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Clock,
  MessageCircle,
  Package,
  Phone,
  User,
} from "lucide-react";
import { Brand, Empty, Feedback, Loading } from "./ui-v2";
import { WhatsappVisitor } from "./qr";

import { randomToken, visitorNonce } from "./v2-model";
import { useTask, useTeavisoNow } from "./use-teaviso-task";
type PublicEntry = NonNullable<
  FunctionReturnType<typeof api.teaviso_spaces.publicEntry>
>;
export function EntryPortal() {
  const { token = "" } = useParams(),
    data = useQuery(api.teaviso_spaces.publicEntry, { token }),
    [params] = useSearchParams(),
    location = useLocation();
  const [action, setAction] = useState<
    "home" | "arrival" | "hours" | "booking"
  >(params.has("reservar") ? "booking" : "home");
  if (data === undefined)
    return (
      <div className="av-visitor">
        <Loading />
      </div>
    );
  if (!data)
    return location.pathname.startsWith("/w/") ? (
      <WhatsappVisitor />
    ) : (
      <div className="av-visitor">
        <Brand />
        <Empty title="Esta entrada no está disponible">
          <p>
            Puede estar pausada o pendiente de configuración. Contactá al lugar
            por otro medio.
          </p>
        </Empty>
      </div>
    );
  return (
    <div className="av-visitor">
      <header className="av-visitor-header">
        {action !== "home" && (
          <button
            onClick={() => setAction("home")}
            aria-label="Volver a la entrada"
          >
            <ArrowLeft />
          </button>
        )}
        <Brand />
      </header>
      <main>
        {action === "booking" ? (
          <BookingForm data={data} token={token} />
        ) : action === "arrival" ? (
          <Arrival data={data} token={token} />
        ) : action === "hours" ? (
          <>
            <span className="av-eyebrow">{data.name}</span>
            <h1>Horarios de atención</h1>
            <p className="av-muted">Zona horaria: {data.timezone}</p>
            <div className="av-card">
              {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                <div className="av-hours-public" key={day}>
                  <strong>
                    {
                      [
                        "Domingo",
                        "Lunes",
                        "Martes",
                        "Miércoles",
                        "Jueves",
                        "Viernes",
                        "Sábado",
                      ][day]
                    }
                  </strong>
                  <span>
                    {data.schedule
                      .filter((h) => h.day === day)
                      .map(
                        (h) =>
                          `${String(Math.floor(h.start / 60)).padStart(2, "0")}:${String(h.start % 60).padStart(2, "0")} – ${h.end === 1440 ? "00:00" : `${String(Math.floor(h.end / 60)).padStart(2, "0")}:${String(h.end % 60).padStart(2, "0")}`}`,
                      )
                      .join(" / ") || "Sin atención"}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <span className="av-eyebrow">{data.name}</span>
            <h1>Hola, ¿qué necesitás?</h1>
            <p>Tu visita empieza acá.</p>
            <div className="av-visitor-actions">
              {data.portal && (
                <button onClick={() => setAction("arrival")}>
                  <Package />
                  <span>Avisar que llegué</span>
                  <ArrowRight />
                </button>
              )}
              {data.bookings && (
                <button onClick={() => setAction("booking")}>
                  <CalendarDays />
                  <span>Reservar un turno</span>
                  <ArrowRight />
                </button>
              )}
              <button onClick={() => setAction("hours")}>
                <Clock />
                <span>Ver horarios</span>
                <ArrowRight />
              </button>
              {data.callToken && (
                <Link to={`/t/${data.callToken}`}>
                  <Phone />
                  <span>
                    {data.kind === "building"
                      ? "Elegir departamento y llamar"
                      : "Tocar el timbre"}
                  </span>
                  <ArrowRight />
                </Link>
              )}
              {data.whatsappUrl && (
                <a href={data.whatsappUrl} rel="noreferrer">
                  <MessageCircle />
                  <span>Escribir por WhatsApp</span>
                  <ArrowRight />
                </a>
              )}
            </div>
            {!data.callToken && !data.whatsappUrl && !data.bookings && (
              <p className="av-muted">
                El contacto de esta entrada todavía se está configurando.
              </p>
            )}
            <div className="av-visitor-foot">
              <Phone />
              <div>
                <strong>Sin instalar una app</strong>
                <span>Escaneá, elegí cómo avisar y continuá.</span>
              </div>
            </div>
          </>
        )}
      </main>
      <footer>Te Aviso · por VISO</footer>
    </div>
  );
}
function Arrival({ data, token }: { data: PublicEntry; token: string }) {
  const [selected, setSelected] = useState(data.templates[0]?.id ?? ""),
    record = useMutation(api.teaviso_spaces.recordVisit),
    task = useTask();
  const template = data.templates.find((t) => t.id === selected);
  const message = template?.message ?? data.message;
  const wa = data.phone
    ? `https://wa.me/${data.phone}?text=${encodeURIComponent(message)}`
    : null;
  return (
    <>
      <span className="av-eyebrow">{data.name}</span>
      <h1>Avisá tu llegada</h1>
      <p>Elegí el motivo de tu visita.</p>
      <div className="av-visit-options">
        {data.templates.map((t) => (
          <button
            key={t.id}
            className={selected === t.id ? "selected" : ""}
            aria-pressed={selected === t.id}
            onClick={() => setSelected(t.id)}
          >
            {t.imageUrl ? (
              <img src={t.imageUrl} alt="" />
            ) : t.id.includes("visita") ? (
              <User />
            ) : (
              <Package />
            )}
            <strong>{t.label}</strong>
          </button>
        ))}
      </div>
      {template && (
        <div className="av-message-preview">
          <small>Mensaje preparado</small>
          <p>{message}</p>
        </div>
      )}
      {wa && (
        <>
          <a className="av-button av-wide" href={wa} rel="noreferrer">
            <MessageCircle /> Continuar en WhatsApp
          </a>
          <p className="av-muted">
            Revisá y enviá el mensaje en WhatsApp. El número de contacto será
            visible.
          </p>
        </>
      )}
      {data.callToken && (
        <Link
          className="av-button av-wide"
          to={`/t/${data.callToken}?portal=${encodeURIComponent(token)}&motivo=${encodeURIComponent(selected)}`}
        >
          <BellRing />{" "}
          {data.kind === "building"
            ? "Elegir departamento y tocar timbre"
            : "Tocar el timbre"}
        </Link>
      )}
      {data.kind !== "building" && (
        <button
          className={`av-button av-wide ${wa || data.callToken ? "av-outline" : ""}`}
          disabled={!template || task.busy || !!task.notice}
          onClick={() =>
            void task.run(
              () =>
                record({
                  token,
                  templateId: selected,
                  nonce: visitorNonce(token),
                }),
              "Tu aviso quedó registrado en el panel del lugar.",
            )
          }
        >
          <BellRing /> Enviar aviso al panel
        </button>
      )}
      <Feedback task={task} />
      <p className="av-muted">
        La empresa o motivo los indica la visita. Los avisos al panel se
        consultan con la web abierta.
      </p>
    </>
  );
}
function BookingForm({ data, token }: { data: PublicEntry; token: string }) {
  const now = useTeavisoNow();
  const [step, setStep] = useState(1),
    [serviceId, setServiceId] = useState<string>(data.services[0]?.id ?? ""),
    [professionalId, setProfessionalId] = useState(""),
    [date, setDate] = useState(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: data.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now),
    ),
    [selected, setSelected] = useState<{
      startsAt: number;
      professionalId: Id<"teavisoProfessionals">;
    } | null>(null),
    [name, setName] = useState(""),
    [contact, setContact] = useState(""),
    [consent, setConsent] = useState(false);
  const slots = useQuery(
    api.teaviso_spaces.slots,
    data.bookings && serviceId && date
      ? {
          token,
          date,
          serviceId: serviceId as Id<"teavisoServices">,
          professionalId: professionalId
            ? (professionalId as Id<"teavisoProfessionals">)
            : undefined,
        }
      : "skip",
  );
  const book = useMutation(api.teaviso_spaces.book),
    task = useTask(),
    navigate = useNavigate();
  const intent = useRef<{
    signature: string;
    requestKey: string;
    manageToken: string;
  } | null>(null);
  if (!data.bookings)
    return (
      <Empty title="Las reservas no están habilitadas">
        <p>Contactá al lugar para coordinar tu visita.</p>
      </Empty>
    );
  if (!data.services.length || !data.professionals.length)
    return (
      <Empty title="La agenda se está preparando">
        <p>
          El lugar todavía no publicó servicios y profesionales para reservar.
        </p>
      </Empty>
    );
  const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: data.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now),
    maxDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: data.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now + data.horizonDays * 86400000);
  return (
    <>
      <span className="av-eyebrow">{data.name}</span>
      <h1>Reservá tu turno</h1>
      <div className="av-book-steps">
        {["Servicio", "Horario", "Tus datos"].map((s, i) => (
          <span className={step === i + 1 ? "active" : ""} key={s}>
            <b>{i + 1}</b>
            {s}
          </span>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 3) {
            if (step === 2 && !selected) return;
            setStep(step + 1);
            return;
          }
          if (!selected) return;
          void task.run(async () => {
            const signature = Array.from(
              new Uint8Array(
                await crypto.subtle.digest(
                  "SHA-256",
                  new TextEncoder().encode(
                    JSON.stringify({ serviceId, ...selected, name, contact }),
                  ),
                ),
              ),
              (b) => b.toString(16).padStart(2, "0"),
            ).join("");
            if (intent.current?.signature !== signature) {
              let saved = null;
              try {
                saved = JSON.parse(
                  sessionStorage.getItem(
                    `teaviso:booking:${token}:${signature}`,
                  ) ?? "null",
                );
              } catch {
                /* Storage is optional. */
              }
              intent.current =
                saved &&
                /^[a-f0-9]{64}$/.test(saved.requestKey) &&
                /^[a-f0-9]{64}$/.test(saved.manageToken)
                  ? {
                      signature,
                      requestKey: saved.requestKey,
                      manageToken: saved.manageToken,
                    }
                  : {
                      signature,
                      requestKey: randomToken(),
                      manageToken: randomToken(),
                    };
              try {
                sessionStorage.setItem(
                  `teaviso:booking:${token}:${signature}`,
                  JSON.stringify(intent.current),
                );
              } catch {
                /* Keep in memory. */
              }
            }
            const current = intent.current;
            const result = await book({
              token,
              serviceId: serviceId as Id<"teavisoServices">,
              startsAt:selected.startsAt,
              professionalId:selected.professionalId,
              name,
              contact,
              consent,
              requestKey: current.requestKey,
              manageToken: current.manageToken,
              nonce: visitorNonce(token),
            });
            navigate(`/reserva/${result.id}#${current.manageToken}`);
          }, "");
        }}
      >
        <fieldset disabled={task.busy}>
          {step === 1 ? (
            <>
              <label>
                Servicio
                <select
                  value={serviceId}
                  onChange={(e) => {
                    setServiceId(e.target.value);
                    setSelected(null);
                    setProfessionalId("");
                  }}
                >
                  {data.services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.duration} min
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Profesional
                <select
                  value={professionalId}
                  onChange={(e) => {
                    setProfessionalId(e.target.value);
                    setSelected(null);
                  }}
                >
                  <option value="">Cualquiera disponible</option>
                  {data.professionals
                    .filter((p) =>
                      p.serviceIds.includes(serviceId as Id<"teavisoServices">),
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
            </>
          ) : step === 2 ? (
            <>
              <label>
                Elegí un día
                <input
                  type="date"
                  value={date}
                  min={today}
                  max={maxDate}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setSelected(null);
                  }}
                  required
                />
              </label>
              <p className="av-muted">Horarios del lugar: {data.timezone}</p>
              <div className="av-slot-grid">
                {slots?.map((s) => (
                  <button
                    type="button"
                    key={s.startsAt}
                    className={
                      selected?.startsAt === s.startsAt ? "selected" : ""
                    }
                    aria-pressed={selected?.startsAt === s.startsAt}
                    onClick={() => setSelected({startsAt:s.startsAt,professionalId:s.professionalId})}
                  >
                    {new Intl.DateTimeFormat("es-AR", {
                      timeZone: data.timezone,
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(s.startsAt)}
                  </button>
                ))}
              </div>
              {slots === undefined ? (
                <Loading />
              ) : slots.length === 0 ? (
                <p>
                  No quedan horarios para ese día. Elegí otra fecha o
                  profesional.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <div className="av-summary">
                <strong>
                  {data.services.find((s) => s.id === serviceId)?.name}
                </strong>
                <p>
                  {selected &&
                    new Intl.DateTimeFormat("es-AR", {
                      timeZone: data.timezone,
                      dateStyle: "long",
                      timeStyle: "short",
                    }).format(selected.startsAt)}
                </p>
              </div>
              <label>
                Tu nombre
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={100}
                  autoComplete="name"
                />
              </label>
              <label>
                Correo o teléfono de contacto
                <input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  required
                  maxLength={140}
                  placeholder="Para gestionar tu turno"
                />
              </label>
              <p className="av-muted">
                {data.autoConfirm
                  ? "El turno se confirma si sigue disponible."
                  : "La solicitud queda pendiente hasta 30 minutos para que el negocio la confirme."}{" "}
                Podés cancelar desde tu enlace privado hasta {data.cancelHours}{" "}
                horas antes. Guardá el comprobante; no se envía un correo o SMS
                automático.
              </p>
              <label className="av-check">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  required
                />{" "}
                Acepto compartir estos datos con el lugar para gestionar la
                reserva y sus condiciones de cancelación.
              </label>
            </>
          )}
          <div className="av-form-actions">
            {step > 1 && (
              <button
                type="button"
                className="av-button av-outline"
                onClick={() => setStep(step - 1)}
              >
                Atrás
              </button>
            )}
            <button className="av-button" disabled={step === 2 && !selected}>
              {task.busy
                ? "Confirmando…"
                : step === 3
                  ? "Confirmar reserva"
                  : "Continuar"}
              <ArrowRight size={17} />
            </button>
          </div>
        </fieldset>
        <Feedback task={task} />
      </form>
    </>
  );
}
export function BookingReceipt() {
  const now = useTeavisoNow();
  const { id = "" } = useParams(),
    location = useLocation(),
    manageToken = location.hash.slice(1),
    valid = /^[a-f0-9]{64}$/.test(manageToken),
    booking = useQuery(
      api.teaviso_spaces.booking,
      valid ? { id: id as Id<"teavisoBookings">, manageToken } : "skip",
    ),
    cancel = useMutation(api.teaviso_spaces.cancelBooking),
    task = useTask();
  return (
    <div className="av-visitor">
      <header className="av-visitor-header">
        <Brand />
      </header>
      <main>
        {!valid ? (
          <Empty title="Necesitás el enlace privado de tu reserva">
            <p>Usá el enlace completo del comprobante o contactá al lugar.</p>
          </Empty>
        ) : booking === undefined ? (
          <Loading />
        ) : (
          <>
            <CheckCircle2 className="av-receipt-icon" />
            <span className="av-eyebrow">{booking.spaceName}</span>
            <h1>
              {booking.status === "confirmed"
                ? "Tu turno está confirmado"
                : booking.status === "pending"
                  ? "Tu solicitud está pendiente"
                  : booking.status === "cancelled"
                    ? "Tu reserva fue cancelada"
                    : booking.status === "expired"
                      ? "La solicitud venció"
                      : "Tu reserva"}
            </h1>
            <section className="av-card">
              <h2>{booking.serviceName}</h2>
              <p>
                {new Intl.DateTimeFormat("es-AR", {
                  timeZone: booking.timezone,
                  dateStyle: "long",
                  timeStyle: "short",
                }).format(booking.startsAt)}
              </p>
              <p>
                {booking.professionalName} · {booking.name}
              </p>
              <span className="av-tag">{booking.timezone}</span>
            </section>
            <p>
              Conservá este enlace privado para consultar el estado. No lo
              compartas con otras personas.
            </p>
            <button
              className="av-button av-wide"
              onClick={() =>
                void task.run(
                  () => navigator.clipboard.writeText(window.location.href),
                  "Enlace privado copiado.",
                )
              }
            >
              Copiar comprobante
            </button>
            {(booking.status === "pending" ||
              booking.status === "confirmed") && (
              <button
                className="av-button av-outline av-wide"
                disabled={
                  task.busy ||
                  now > booking.startsAt - booking.cancelHours * 3600000
                }
                onClick={() => {
                  if (window.confirm("¿Querés cancelar esta reserva?"))
                    void task.run(
                      () => cancel({ id: booking.id, manageToken }),
                      "Reserva cancelada.",
                    );
                }}
              >
                Cancelar reserva
              </button>
            )}
            <Feedback task={task} />
          </>
        )}
      </main>
      <footer>Te Aviso · por VISO</footer>
    </div>
  );
}
