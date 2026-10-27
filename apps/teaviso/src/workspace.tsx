import { useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuthToken } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageCircle,
  Plus,
  QrCode,
  Settings2,
  X,
} from "lucide-react";
import { getSiteUrl } from "@/lib/site-url";
import { Empty, Feedback, Loading } from "./ui-v2";
import {
  BasicDoorbellEditor,
  DoorbellList,
  SetupWizard,
} from "./doorbell-setup";

import { useSpaces } from "./use-spaces";
import { useTask, useTeavisoNow } from "./use-teaviso-task";
type Space = FunctionReturnType<typeof api.teaviso_spaces.get>;
const dayNames = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
const kindNames = {
  home: "Casa o departamento",
  business: "Negocio o consultorio",
  office: "Oficina",
  building: "Edificio",
};
const statuses = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Realizada",
  no_show: "No asistió",
  expired: "Solicitud vencida",
};
const dateText = (epoch: number, zone: string) =>
  new Intl.DateTimeFormat("es-AR", {
    timeZone: zone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(epoch);
export function SpacePicker() {
  const { rows, selected, choose } = useSpaces();
  return rows?.length ? (
    <label className="av-space-picker">
      <span>Tu espacio</span>
      <select
        aria-label="Elegir espacio"
        value={selected?._id ?? ""}
        onChange={(e) => choose(e.target.value)}
      >
        {rows.map((r) => (
          <option key={r._id} value={r._id}>
            {r.name}
          </option>
        ))}
      </select>
    </label>
  ) : null;
}
export function Overview() {
  const { rows, selected } = useSpaces();
  const doorbells = useQuery(api.teaviso_setup.list, {});
  if (rows === undefined || doorbells === undefined) return <Loading />;
  return (
    <div className="av-stack">
      <header className="av-panel-heading">
        <div>
          <span className="av-eyebrow">Tu timbre digital</span>
          <h1>Tu espacio, conectado.</h1>
          <p>Recibí visitas y organizá tu día desde un solo lugar.</p>
        </div>
        <Link className="av-button" to="/panel/nuevo">
          <Plus size={17} /> Agregar timbre
        </Link>
      </header>
      <SpacePicker />
      {selected ? (
        <OverviewSpace id={selected._id} />
      ) : doorbells.length ? null : (
        <Empty title="Creá tu primer timbre">
          <p>Elegí tu espacio, configurá cómo atender y descargá el QR.</p>
          <Link className="av-button" to="/panel/nuevo">
            Crear mi timbre <ArrowRight size={17} />
          </Link>
        </Empty>
      )}
      <DoorbellList />
      <div className="av-callout">
        <BellRing />
        <div>
          <h2>Atendé desde donde estés.</h2>
          <p>
            Para recibir avisos y llamadas en la web, mantené el panel abierto.
            En el celular, la recepción en segundo plano requiere la APK
            compatible y sus permisos.
          </p>
        </div>
        <Link to="/panel/llamadas">Mis llamadas y timbres ↗</Link>
      </div>
    </div>
  );
}
function OverviewSpace({ id }: { id: Id<"teavisoSpaces"> }) {
  const space = useQuery(api.teaviso_spaces.get, { spaceId: id }),
    visits = useQuery(api.teaviso_spaces.visits, { spaceId: id });
  const now = useTeavisoNow(60000);
  const range = useMemo(() => {
    const from = Math.floor(now / 3600000) * 3600000;
    return { from, to: from + 7 * 86400000 };
  }, [now]);
  const bookings = useQuery(api.teaviso_spaces.agenda, {
    spaceId: id,
    ...range,
  });
  if (!space) return <Loading />;
  return (
    <>
      <section
        className={`av-status-card ${space.enabled ? "available" : "paused"}`}
      >
        <span className="av-status-dot" />
        <div>
          <h2>{space.enabled ? "Entrada habilitada" : "Entrada pausada"}</h2>
          <p>
            {space.name} · {kindNames[space.kind]}
          </p>
        </div>
        <Link to={`/panel/entradas/${id}`} aria-label="Configurar esta entrada">
          <Settings2 />
        </Link>
      </section>
      <div className="av-dashboard-actions">
        <Link className="av-card" to={`/panel/entradas/${id}`}>
          <QrCode />
          <strong>Mi QR</strong>
          <span>Ver y configurar mi entrada</span>
          <ArrowRight />
        </Link>
        <Link className="av-card" to={`/panel/agenda?space=${id}`}>
          <CalendarDays />
          <strong>Reservas</strong>
          <span>
            {space.capabilities.bookings
              ? "Administrá tu agenda"
              : "Conocé la opción con reservas"}
          </span>
          <ArrowRight />
        </Link>
      </div>
      <div className="av-dashboard-grid">
        <section className="av-card">
          <header className="av-inline-heading">
            <h2>Próximas reservas</h2>
            <Link to={`/panel/agenda?space=${id}`}>Ver agenda</Link>
          </header>
          {bookings
            ?.filter((b) => b.status === "confirmed" || b.status === "pending")
            .slice(0, 5)
            .map((b) => (
              <article className="av-small-item" key={b._id}>
                <CalendarDays />
                <div>
                  <strong>{b.serviceName}</strong>
                  <span>
                    {dateText(b.startsAt, b.timezone)} · {b.name}
                  </span>
                </div>
                <span className="av-tag">{statuses[b.status]}</span>
              </article>
            ))}
          {bookings?.filter(
            (b) => b.status === "confirmed" || b.status === "pending",
          ).length === 0 && (
            <p className="av-muted">
              Todavía no hay turnos para los próximos días.
            </p>
          )}
        </section>
        <section className="av-card">
          <header className="av-inline-heading">
            <h2>Avisos de visitas</h2>
            <Link to={`/panel/portal?space=${id}`}>Ver todos</Link>
          </header>
          {visits?.slice(0, 5).map((v) => (
            <article className="av-small-item" key={v._id}>
              <BellRing />
              <div>
                <strong>{v.label}</strong>
                <span>{v.message}</span>
                <small>Motivo indicado por la visita</small>
              </div>
            </article>
          ))}
          {visits?.length === 0 && (
            <p className="av-muted">
              Acá aparecerán los avisos enviados desde tu portal.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
export function Entries() {
  return (
    <div className="av-stack">
      <header className="av-panel-heading">
        <div>
          <span className="av-eyebrow">Tus lugares</span>
          <h1>Mis timbres</h1>
          <p>Elegí el timbre que querés configurar.</p>
        </div>
        <Link className="av-button" to="/panel/nuevo">
          <Plus size={17} />
          Agregar timbre
        </Link>
      </header>
      <DoorbellList />
    </div>
  );
}
export function Onboarding() {
  return <SetupWizard />;
}
export function SpaceEditorPage() {
  const { rows, selected } = useSpaces();
  const [params] = useSearchParams();
  const space = useQuery(
    api.teaviso_spaces.get,
    selected ? { spaceId: selected._id } : "skip",
  );
  if (rows === undefined) return <Loading />;
  if (!selected)
    return (
      <Empty title="Elegí una entrada de tu cuenta">
        <Link to="/panel/entradas">Ver mis entradas</Link>
      </Empty>
    );
  if (!space) return <Loading />;
  return params.get("advanced") === "1" ? (
    <SpaceEditor key={space._id} space={space} />
  ) : (
    <BasicDoorbellEditor key={space._id} space={space} />
  );
}
function SpaceEditor({ space }: { space: Space }) {
  const [params] = useSearchParams();
  const [section, setSection] = useState(
    params.get("section") === "messages" ? "messages" : "general",
  );
  const configure = useMutation(api.teaviso_spaces.configure),
    connections = useQuery(api.teaviso_spaces.connections, {}),
    authToken = useAuthToken(),
    task = useTask();
  const [hours, setHours] = useState(space.schedule),
    [templates, setTemplates] = useState(space.templates),
    [version, setVersion] = useState(space.revision),
    [license, setLicense] = useState(space.licenseId ?? ""),
    [qr, setQr] = useState(space.timbreQrId ?? ""),
    [reset, setReset] = useState(0),
    [uploading, setUploading] = useState(false);
  const entitlement = connections?.licenses.find((l) => l.id === license),
    enabledBook = entitlement?.bookings ?? false,
    enabledTemplates = entitlement?.templates ?? false;
  const minutes = (value: string, end = false) =>
    value === "00:00" && end
      ? 1440
      : Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const time = (value: number) =>
    `${String(Math.floor(value / 60) % 24).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  const defaults = [
    {
      id: "mercado-libre",
      label: "Mercado Libre",
      message: "Hola, estoy en la entrada con una entrega de Mercado Libre.",
    },
    {
      id: "correo",
      label: "Correo",
      message: "Hola, estoy en la entrada con una entrega del correo.",
    },
    {
      id: "pedidosya",
      label: "PedidosYa",
      message: "Hola, estoy en la entrada con tu pedido.",
    },
    {
      id: "delivery",
      label: "Delivery",
      message: "Hola, llegué con una entrega.",
    },
    {
      id: "visita",
      label: "Visita",
      message: "Hola, estoy en la entrada. ¿Podés atenderme?",
    },
  ];
  function reload() {
    setHours(space.schedule);
    setTemplates(space.templates);
    setLicense(space.licenseId ?? "");
    setQr(space.timbreQrId ?? "");
    setVersion(space.revision);
    setReset((r) => r + 1);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    await task.run(async () => {
      await configure({
        spaceId: space._id,
        revision: version,
        name: String(d.get("name")),
        enabled: d.has("enabled"),
        timezone: String(d.get("timezone")),
        phone: String(d.get("phone") ?? ""),
        message: String(d.get("message")),
        consent: d.has("consent"),
        schedule: hours,
        bookingsEnabled: d.has("bookings"),
        portalEnabled: d.has("portal"),
        autoConfirm: d.has("autoConfirm"),
        leadMinutes: Number(d.get("leadMinutes")),
        horizonDays: Number(d.get("horizonDays")),
        cancelHours: Number(d.get("cancelHours")),
        licenseId: license ? (license as Id<"timbreLicenses">) : null,
        timbreQrId: qr ? (qr as Id<"timbreQrs">) : null,
        templates,
      });
      setVersion((v) => v + 1);
    });
  }
  return (
    <div className="av-stack">
      <header className="av-panel-heading">
        <div>
          <span className="av-eyebrow">Ajustes avanzados</span>
          <h1>{space.name}</h1>
          <p>El enlace se conserva al editar tus preferencias.</p>
        </div>
        <Link
          className="av-button av-outline"
          to={`/w/${space.token}`}
          target="_blank"
        >
          Probar mi entrada ↗
        </Link>
      </header>
      {space.revision > version && (
        <div className="av-warning">
          La configuración cambió en otra ventana. Tu edición se conserva.{" "}
          <button onClick={reload}>Cargar la versión guardada</button>
        </div>
      )}
      <Link className="sb-text-link" to={`/panel/entradas/${space._id}`}>
        ← Volver a la configuración simple
      </Link>
      <nav className="gd-advanced-tabs" aria-label="Ajustes avanzados">
        {[
          ["general", "Datos"],
          ["calls", "Plan y llamadas"],
          ["hours", "Horarios"],
          ["bookings", "Reservas"],
          ["messages", "Mensajes"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={section === id}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="av-editor-layout gd-focused-editor">
        <form key={reset} className="av-stack" onSubmit={submit}>
          <fieldset disabled={task.busy || uploading}>
            <section
              className="av-card av-stack"
              hidden={section !== "general"}
            >
              <h2>Tu entrada</h2>
              <div className="av-form-grid">
                <label>
                  Nombre
                  <input
                    name="name"
                    defaultValue={space.name}
                    required
                    maxLength={100}
                  />
                </label>
                <label>
                  Zona horaria
                  <input
                    name="timezone"
                    defaultValue={space.timezone}
                    required
                  />
                </label>
              </div>
              <label className="av-check">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={space.enabled}
                />{" "}
                Entrada habilitada
              </label>
              <label>
                WhatsApp con código de país
                <input
                  name="phone"
                  type="tel"
                  defaultValue={space.phone}
                  placeholder="5491112345678"
                  maxLength={30}
                />
              </label>
              <label>
                Mensaje general
                <textarea
                  name="message"
                  defaultValue={space.message}
                  maxLength={500}
                />
              </label>
              <label className="av-check">
                <input type="checkbox" name="consent" /> Autorizo publicar este
                contacto en WhatsApp.
              </label>
              <p className="av-muted">
                El visitante revisa y envía el mensaje desde WhatsApp. El número
                es visible allí.
              </p>
            </section>
            <section className="av-card av-stack" hidden={section !== "calls"}>
              <h2>Tu plan y tus llamadas</h2>
              <label>
                Licencia activa
                <select
                  value={license}
                  onChange={(e) => {
                    setLicense(e.target.value);
                    setQr("");
                  }}
                >
                  <option value="">Básico WhatsApp</option>
                  {connections?.licenses.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                QR de Timbre Digital
                <select
                  value={qr}
                  onChange={(e) => {
                    const match = connections?.qrs.find(
                      (q) => q.id === e.target.value,
                    );
                    setQr(e.target.value);
                    if (match) setLicense(match.licenseId);
                  }}
                >
                  <option value="">Sin vincular</option>
                  {connections?.qrs.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="av-muted">
                Las reservas y el portal requieren que la licencia incluya esas
                prestaciones. Los integrantes y unidades del timbre se
                conservan.
              </p>
              <div className="av-link-row">
                <Link to="/panel/plan">Ver mi plan ↗</Link>
                <Link
                  to={`/timbre?teavisoSpace=${space._id}&zona=${encodeURIComponent(space.timezone)}`}
                >
                  Crear o administrar un timbre digital ↗
                </Link>
              </div>
            </section>
            <section className="av-card av-stack" hidden={section !== "hours"}>
              <h2>Horarios de atención</h2>
              <p className="av-muted">
                Podés agregar más de una franja por día. Fin 00:00 indica el
                final de ese día.
              </p>
              {hours.map((h, i) => (
                <div className="av-hours-row" key={i}>
                  <select
                    aria-label={`Día de la franja ${i + 1}`}
                    value={h.day}
                    onChange={(e) =>
                      setHours((a) =>
                        a.map((r, n) =>
                          n === i ? { ...r, day: Number(e.target.value) } : r,
                        ),
                      )
                    }
                  >
                    {dayNames.map((name, n) => (
                      <option value={n} key={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    aria-label={`Desde franja ${i + 1}`}
                    value={time(h.start)}
                    onChange={(e) =>
                      setHours((a) =>
                        a.map((r, n) =>
                          n === i
                            ? { ...r, start: minutes(e.target.value) }
                            : r,
                        ),
                      )
                    }
                  />
                  <input
                    type="time"
                    aria-label={`Hasta franja ${i + 1}`}
                    value={time(h.end)}
                    onChange={(e) =>
                      setHours((a) =>
                        a.map((r, n) =>
                          n === i
                            ? { ...r, end: minutes(e.target.value, true) }
                            : r,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    aria-label={`Quitar franja ${i + 1}`}
                    onClick={() => setHours((a) => a.filter((_, n) => n !== i))}
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
              <button
                className="av-button av-outline"
                type="button"
                onClick={() =>
                  setHours((a) => [...a, { day: 1, start: 540, end: 1080 }])
                }
                disabled={hours.length >= 28}
              >
                <Plus size={16} /> Agregar franja
              </button>
            </section>
            <section
              className="av-card av-stack"
              hidden={section !== "bookings"}
            >
              <h2>Reservas</h2>
              <label className="av-check">
                <input
                  type="checkbox"
                  name="bookings"
                  defaultChecked={space.bookingsEnabled && enabledBook}
                  disabled={!enabledBook}
                />{" "}
                Habilitar reservas desde mi entrada
              </label>
              {!enabledBook && (
                <p className="av-muted">
                  Necesitás una licencia que incluya Agenda y reservas Te Aviso.
                </p>
              )}
              <label className="av-check">
                <input
                  type="checkbox"
                  name="autoConfirm"
                  defaultChecked={space.autoConfirm}
                />{" "}
                Confirmar automáticamente los turnos disponibles
              </label>
              <div className="av-form-grid">
                <label>
                  Anticipación mínima (minutos)
                  <input
                    name="leadMinutes"
                    type="number"
                    min={0}
                    max={10080}
                    defaultValue={space.leadMinutes}
                  />
                </label>
                <label>
                  Reservar hasta (días)
                  <input
                    name="horizonDays"
                    type="number"
                    min={1}
                    max={90}
                    defaultValue={space.horizonDays}
                  />
                </label>
                <label>
                  Cancelación hasta (horas antes)
                  <input
                    name="cancelHours"
                    type="number"
                    min={0}
                    max={168}
                    defaultValue={space.cancelHours}
                  />
                </label>
              </div>
              <p className="av-muted">
                Sin confirmación automática, la solicitud vence a los 30 minutos
                si no la aceptás. Los datos de contacto los proporciona el
                visitante.
              </p>
              <Link to={`/panel/agenda?space=${space._id}`}>
                Configurar servicios y profesionales ↗
              </Link>
            </section>
            <section
              className="av-card av-stack"
              hidden={section !== "messages"}
            >
              <h2>Portal de mensajes</h2>
              <label className="av-check">
                <input
                  type="checkbox"
                  name="portal"
                  defaultChecked={space.portalEnabled && enabledTemplates}
                  disabled={!enabledTemplates}
                />{" "}
                Mostrar opciones de visitas y entregas
              </label>
              {!enabledTemplates && (
                <p className="av-muted">
                  Podés preparar tus mensajes. Para publicarlos necesitás la
                  mejora Portal de mensajes Te Aviso.
                </p>
              )}
              <p className="av-muted">
                La empresa es indicada por la visita; seleccionar su nombre no
                verifica su identidad.
              </p>
              {templates.map((t, i) => (
                <article className="av-template-editor" key={t.id}>
                  <div className="av-form-grid">
                    <label>
                      Nombre
                      <input
                        value={t.label}
                        maxLength={50}
                        onChange={(e) =>
                          setTemplates((a) =>
                            a.map((r, n) =>
                              n === i ? { ...r, label: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Logo o imagen
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        disabled={uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploading(true);
                          void task
                            .run(async () => {
                              if (file.size > 2_000_000)
                                throw { data: "Usá una imagen de hasta 2 MB." };
                              if (!authToken)
                                throw {
                                  data: "Volvé a ingresar para subir imágenes.",
                                };
                              const response = await fetch(
                                `${getSiteUrl()}/teaviso/image`,
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": file.type,
                                    Authorization: `Bearer ${authToken}`,
                                  },
                                  body: file,
                                },
                              );
                              const result = await response.json();
                              if (
                                !response.ok ||
                                typeof result.imageId !== "string"
                              )
                                throw {
                                  data:
                                    result.error ??
                                    "No pudimos subir la imagen.",
                                };
                              const imageId =
                                result.imageId as Id<"teavisoImages">;
                              setTemplates((a) =>
                                a.map((r, n) =>
                                  n === i ? { ...r, imageId } : r,
                                ),
                              );
                            }, "Imagen preparada. Guardá los cambios para publicarla.")
                            .finally(() => setUploading(false));
                        }}
                      />
                    </label>
                  </div>
                  <label>
                    Mensaje preguardado
                    <textarea
                      value={t.message}
                      maxLength={500}
                      onChange={(e) =>
                        setTemplates((a) =>
                          a.map((r, n) =>
                            n === i ? { ...r, message: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </label>
                  <button
                    className="av-text-button"
                    type="button"
                    onClick={() =>
                      setTemplates((a) => a.filter((_, n) => n !== i))
                    }
                  >
                    Eliminar opción
                  </button>
                </article>
              ))}
              <div className="av-form-actions">
                <button
                  type="button"
                  className="av-button av-outline"
                  disabled={templates.length > 0}
                  onClick={() => setTemplates(defaults)}
                >
                  Cargar opciones iniciales
                </button>
                <button
                  type="button"
                  className="av-button av-outline"
                  disabled={templates.length >= 12}
                  onClick={() =>
                    setTemplates((a) => [
                      ...a,
                      {
                        id: `opcion-${crypto.randomUUID().slice(0, 8)}`,
                        label: "Nueva opción",
                        message: "Hola, estoy en la entrada.",
                      },
                    ])
                  }
                >
                  <Plus size={16} /> Agregar opción
                </button>
              </div>
            </section>
            <div className="av-save-bar">
              <button className="av-button" type="submit">
                {task.busy ? "Guardando…" : "Guardar cambios"}
                <Check size={17} />
              </button>
              <Feedback task={task} />
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
export function Agenda() {
  const { rows, selected } = useSpaces();
  if (rows === undefined) return <Loading />;
  return (
    <div className="av-stack">
      <header className="av-panel-heading">
        <div>
          <span className="av-eyebrow">Tu negocio, organizado</span>
          <h1>Tu agenda, en orden.</h1>
          <p>Gestioná tus turnos, servicios y profesionales.</p>
        </div>
        {selected && (
          <Link
            className="av-button"
            to={`/w/${selected.token}?reservar=1`}
            target="_blank"
          >
            <Plus size={17} /> Nueva reserva
          </Link>
        )}
      </header>
      <SpacePicker />
      {selected ? (
        <AgendaSpace key={selected._id} id={selected._id} />
      ) : (
        <Empty title="Primero creá tu espacio">
          <Link to="/panel/nuevo">Crear entrada ↗</Link>
        </Empty>
      )}
    </div>
  );
}
function AgendaSpace({ id }: { id: Id<"teavisoSpaces"> }) {
  const now = useTeavisoNow();
  const space = useQuery(api.teaviso_spaces.get, { spaceId: id }),
    [date, setDate] = useState(() => new Date().toISOString().slice(0, 10)),
    [view, setView] = useState<"day" | "week">("week"),
    task = useTask();
  const from = Date.parse(`${date}T00:00:00Z`) - 14 * 3600000,
    to = from + (view === "week" ? 8 : 2) * 86400000;
  const bookings = useQuery(api.teaviso_spaces.agenda, {
      spaceId: id,
      from,
      to,
    }),
    blocks = useQuery(api.teaviso_spaces.blocks, { spaceId: id }),
    update = useMutation(api.teaviso_spaces.updateBooking),
    removeBlock = useMutation(api.teaviso_spaces.removeBlock);
  if (!space) return <Loading />;
  const days = Array.from({ length: view === "week" ? 7 : 1 }, (_, i) =>
    new Date(Date.parse(`${date}T12:00:00Z`) + i * 86400000)
      .toISOString()
      .slice(0, 10),
  );
  const localDate = (time: number) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: space.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(time);
  const visible = bookings?.filter((b) => days.includes(localDate(b.startsAt)));
  return (
    <>
      {!space.capabilities.bookings && (
        <div className="av-warning">
          Tu licencia todavía no incluye reservas. Podés preparar servicios y
          horarios; las reservas públicas se habilitan con el plan
          correspondiente. <Link to="/panel/plan">Ver planes</Link>
        </div>
      )}
      <section className="av-card">
        <div className="av-agenda-toolbar">
          <button
            aria-label="Período anterior"
            onClick={() =>
              setDate(
                new Date(
                  Date.parse(`${date}T12:00:00Z`) -
                    (view === "week" ? 7 : 1) * 86400000,
                )
                  .toISOString()
                  .slice(0, 10),
              )
            }
          >
            <ChevronLeft />
          </button>
          <label>
            Desde
            <input
              type="date"
              value={date}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
            />
          </label>
          <button
            aria-label="Período siguiente"
            onClick={() =>
              setDate(
                new Date(
                  Date.parse(`${date}T12:00:00Z`) +
                    (view === "week" ? 7 : 1) * 86400000,
                )
                  .toISOString()
                  .slice(0, 10),
              )
            }
          >
            <ChevronRight />
          </button>
          <div className="av-segment">
            <button
              aria-pressed={view === "day"}
              onClick={() => setView("day")}
            >
              Día
            </button>
            <button
              aria-pressed={view === "week"}
              onClick={() => setView("week")}
            >
              Semana
            </button>
          </div>
        </div>
        <p className="av-muted">Zona horaria: {space.timezone}</p>
        <div
          className="av-week-grid"
          style={{
            gridTemplateColumns: `repeat(${days.length},minmax(140px,1fr))`,
          }}
        >
          {days.map((day) => (
            <section key={day}>
              <h3>
                {new Intl.DateTimeFormat("es-AR", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  timeZone: "UTC",
                }).format(new Date(`${day}T12:00Z`))}
              </h3>
              {visible
                ?.filter((b) => localDate(b.startsAt) === day)
                .map((b) => (
                  <article
                    className={`av-agenda-booking ${b.status}`}
                    key={b._id}
                  >
                    <strong>{b.serviceName}</strong>
                    <span>
                      {new Intl.DateTimeFormat("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: b.timezone,
                      }).format(b.startsAt)}
                    </span>
                    <span>{b.name}</span>
                    <small>{statuses[b.status]}</small>
                  </article>
                ))}
            </section>
          ))}
        </div>
        <div className="av-booking-list">
          {visible?.map((b) => (
            <article className="av-booking-row" key={b._id}>
              <CalendarDays />
              <div>
                <strong>
                  {b.serviceName} · {b.name}
                </strong>
                <span>
                  {dateText(b.startsAt, b.timezone)} · {b.professionalName}
                </span>
                <small>Contacto indicado: {b.contact}</small>
                <span className="av-tag">{statuses[b.status]}</span>
              </div>
              <div className="av-row-actions">
                <MoveBooking booking={b} space={space} />
                {b.status === "pending" && (
                  <button
                    disabled={task.busy}
                    onClick={() =>
                      void task.run(
                        () => update({ id: b._id, status: "confirmed" }),
                        "Reserva confirmada.",
                      )
                    }
                  >
                    Confirmar
                  </button>
                )}
                {(b.status === "confirmed" || b.status === "pending") && (
                  <button
                    disabled={task.busy}
                    onClick={() =>
                      void task.run(
                        () => update({ id: b._id, status: "cancelled" }),
                        "Reserva cancelada.",
                      )
                    }
                  >
                    Cancelar
                  </button>
                )}
                {b.status === "confirmed" && b.startsAt <= now && (
                  <>
                    <button
                      disabled={task.busy}
                      onClick={() =>
                        void task.run(() =>
                          update({ id: b._id, status: "completed" }),
                        )
                      }
                    >
                      Realizada
                    </button>
                    <button
                      disabled={task.busy}
                      onClick={() =>
                        void task.run(() =>
                          update({ id: b._id, status: "no_show" }),
                        )
                      }
                    >
                      No asistió
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
        {visible?.length === 0 && (
          <Empty title="Tu agenda tiene espacio">
            <p>No hay reservas en este período.</p>
          </Empty>
        )}
        <Feedback task={task} />
      </section>
      <div className="av-settings-grid">
        <ServiceSettings space={space} />
        <ProfessionalSettings space={space} />
      </div>
      <BlockSettings space={space} />
      {!!blocks?.length && (
        <section className="av-card">
          <h2>Bloqueos de agenda</h2>
          {blocks.map((b) => (
            <div className="av-small-item" key={b._id}>
              <Clock />
              <div>
                <strong>{b.note || "Horario bloqueado"}</strong>
                <span>
                  {dateText(b.startsAt, space.timezone)} —{" "}
                  {dateText(b.endsAt, space.timezone)}
                </span>
              </div>
              <button
                disabled={task.busy}
                onClick={() => void task.run(() => removeBlock({ id: b._id }))}
              >
                Eliminar
              </button>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
function ServiceSettings({ space }: { space: Space }) {
  const save = useMutation(api.teaviso_spaces.saveService),
    task = useTask();
  return (
    <section className="av-card av-stack">
      <h2>Servicios y duración</h2>
      {space.services.map((s) => (
        <div className="av-small-item" key={s._id}>
          <div>
            <strong>{s.name}</strong>
            <span>{s.duration} minutos</span>
          </div>
          <button
            disabled={task.busy}
            onClick={() =>
              void task.run(() =>
                save({
                  spaceId: space._id,
                  id: s._id,
                  name: s.name,
                  duration: s.duration,
                  enabled: !s.enabled,
                }),
              )
            }
          >
            {s.enabled ? "Pausar" : "Activar"}
          </button>
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget,
            d = new FormData(form);
          void task.run(async () => {
            await save({
              spaceId: space._id,
              name: String(d.get("service")),
              duration: Number(d.get("duration")),
              enabled: true,
            });
            form.reset();
          });
        }}
      >
        <fieldset disabled={task.busy}>
          <label>
            Nombre del servicio
            <input
              name="service"
              required
              maxLength={80}
              placeholder="Ej. Corte"
            />
          </label>
          <label>
            Duración en minutos
            <input
              type="number"
              name="duration"
              min={5}
              max={480}
              defaultValue={30}
              required
            />
          </label>
          <button className="av-button av-outline">
            <Plus size={16} /> Agregar servicio
          </button>
        </fieldset>
      </form>
      <Feedback task={task} />
    </section>
  );
}
function ProfessionalSettings({ space }: { space: Space }) {
  const save = useMutation(api.teaviso_spaces.saveProfessional),
    task = useTask();
  return (
    <section className="av-card av-stack">
      <h2>Profesionales</h2>
      {space.professionals.map((p) => (
        <div className="av-small-item" key={p._id}>
          <div>
            <strong>{p.name}</strong>
            <span>{p.serviceIds.length} servicios</span>
          </div>
          <button
            disabled={task.busy}
            onClick={() =>
              void task.run(() =>
                save({
                  spaceId: space._id,
                  id: p._id,
                  name: p.name,
                  serviceIds: p.serviceIds,
                  enabled: !p.enabled,
                }),
              )
            }
          >
            {p.enabled ? "Pausar" : "Activar"}
          </button>
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget,
            d = new FormData(form);
          void task.run(async () => {
            await save({
              spaceId: space._id,
              name: String(d.get("professional")),
              serviceIds: d.getAll("serviceId") as Id<"teavisoServices">[],
              enabled: true,
            });
            form.reset();
          });
        }}
      >
        <fieldset disabled={task.busy}>
          <label>
            Nombre
            <input
              name="professional"
              required
              maxLength={80}
              placeholder="Nombre para la agenda"
            />
          </label>
          <span>Servicios que atiende</span>
          {space.services
            .filter((s) => s.enabled)
            .map((s) => (
              <label className="av-check" key={s._id}>
                <input type="checkbox" name="serviceId" value={s._id} />
                {s.name}
              </label>
            ))}
          <button
            className="av-button av-outline"
            disabled={!space.services.length}
          >
            <Plus size={16} /> Agregar profesional
          </button>
        </fieldset>
      </form>
      <Feedback task={task} />
    </section>
  );
}
function BlockSettings({ space }: { space: Space }) {
  const block = useMutation(api.teaviso_spaces.blockTime),
    task = useTask();
  return (
    <section className="av-card">
      <h2>Bloquear un horario</h2>
      <p className="av-muted">
        Ingresá inicio y fin en la zona horaria de tu dispositivo. Los turnos
        existentes se conservan; revisalos si necesitás reubicarlos.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget,
            d = new FormData(form);
          void task.run(async () => {
            await block({
              spaceId: space._id,
              startsAt: new Date(String(d.get("start"))).getTime(),
              endsAt: new Date(String(d.get("end"))).getTime(),
              note: String(d.get("note")),
              professionalId: d.get("professional")
                ? (String(d.get("professional")) as Id<"teavisoProfessionals">)
                : undefined,
            });
            form.reset();
          });
        }}
      >
        <fieldset disabled={task.busy}>
          <div className="av-form-grid">
            <label>
              Desde
              <input type="datetime-local" name="start" required />
            </label>
            <label>
              Hasta
              <input type="datetime-local" name="end" required />
            </label>
            <label>
              Profesional
              <select name="professional">
                <option value="">Todo el espacio</option>
                {space.professionals.map((p) => (
                  <option value={p._id} key={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Motivo
              <input name="note" maxLength={150} placeholder="Ej. Vacaciones" />
            </label>
          </div>
          <button className="av-button av-outline">Bloquear horario</button>
        </fieldset>
        <Feedback task={task} />
      </form>
    </section>
  );
}
export function PortalSettings() {
  const { rows, selected } = useSpaces();
  const visits = useQuery(
      api.teaviso_spaces.visits,
      selected ? { spaceId: selected._id } : "skip",
    ),
    read = useMutation(api.teaviso_spaces.readVisit),
    task = useTask();
  if (rows === undefined) return <Loading />;
  return (
    <div className="av-stack">
      <header className="av-panel-heading">
        <div>
          <span className="av-eyebrow">Visitas y entregas</span>
          <h1>Tu portal de visitas</h1>
          <p>Mensajes claros para saber quién llegó y para qué.</p>
        </div>
        {selected && (
          <Link className="av-button" to={`/panel/entradas/${selected._id}`}>
            Configurar portal <Settings2 size={17} />
          </Link>
        )}
      </header>
      <SpacePicker />
      {selected ? (
        <section className="av-card">
          <h2>Avisos recibidos</h2>
          <p className="av-muted">
            Estos avisos se ven con el panel abierto. Las llamadas del timbre
            usan su circuito de notificaciones existente.
          </p>
          {visits?.map((v) => (
            <article className={`av-visit ${v.seen ? "seen" : ""}`} key={v._id}>
              <BellRing />
              <div>
                <strong>{v.label}</strong>
                <p>{v.message}</p>
                <small>
                  Motivo indicado por la visita ·{" "}
                  {dateText(v.createdAt, selected.timezone)}
                </small>
              </div>
              {!v.seen && (
                <button
                  disabled={task.busy}
                  onClick={() => void task.run(() => read({ id: v._id }))}
                >
                  Marcar leído
                </button>
              )}
            </article>
          ))}
          {visits?.length === 0 && (
            <Empty title="Todavía no recibiste avisos">
              <p>Configurá las opciones y compartí tu QR para empezar.</p>
            </Empty>
          )}
          <Feedback task={task} />
        </section>
      ) : (
        <Empty title="Creá una entrada para configurar tu portal">
          <Link to="/panel/nuevo">Crear mi timbre ↗</Link>
        </Empty>
      )}
    </div>
  );
}
export function Devices() {
  const account = useQuery(api.teaviso_accounts.profile, {});
  return (
    <div className="av-stack">
      <header className="av-panel-heading">
        <div>
          <span className="av-eyebrow">Tu entrada, conectada</span>
          <h1>Dispositivos</h1>
          <p>Conocé qué podés vincular y el estado de los kits.</p>
        </div>
      </header>
      {account?.deckLinked && (
        <section className="av-card">
          <h2>Google Home y tu Deck VISO</h2>
          <p>
            Conservás las luces que ya usás con VISO. Su selección y
            autorización se administran desde la APK compatible.
          </p>
          <a
            className="av-button av-outline"
            href="https://viso-deck-android.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir VISO ↗
          </a>
        </section>
      )}
      <div className="av-settings-grid">
        <section className="av-card">
          <span className="av-tag">En evaluación</span>
          <h2>Luz RGB del kit</h2>
          <p>
            Tapo L535E con Matter es candidata; falta validar la unidad y su
            funcionamiento antes de ofrecerla como equipo oficial.
          </p>
        </section>
        <section className="av-card">
          <span className="av-tag">Sin activar</span>
          <h2>Apertura de puerta</h2>
          <p>
            El controlador, cerradura y sensor se eligen y prueban según la
            puerta. El QR y las reservas no abren el acceso.
          </p>
          <p>
            La función se habilitará únicamente con equipo validado y permisos
            explícitos.
          </p>
        </section>
      </div>
      <Link to="/panel/plan">Ver beneficios de mi hardware ↗</Link>
    </div>
  );
}

function MoveBooking({
  booking,
  space,
}: {
  booking: FunctionReturnType<typeof api.teaviso_spaces.agenda>[number];
  space: Space;
}) {
  const move = useMutation(api.teaviso_spaces.reschedule),
    task = useTask();
  if (!["confirmed", "pending"].includes(booking.status)) return null;
  const local = new Date(
    booking.startsAt - new Date(booking.startsAt).getTimezoneOffset() * 60000,
  )
    .toISOString()
    .slice(0, 16);
  return (
    <details className="av-move">
      <summary>Reprogramar</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          void task.run(
            () =>
              move({
                id: booking._id,
                startsAt: new Date(String(d.get("start"))).getTime(),
                professionalId: String(
                  d.get("professional"),
                ) as Id<"teavisoProfessionals">,
              }),
            "Turno reprogramado.",
          );
        }}
      >
        <fieldset disabled={task.busy}>
          <label>
            Nuevo horario (zona de tu dispositivo)
            <input
              type="datetime-local"
              name="start"
              defaultValue={local}
              required
            />
          </label>
          <label>
            Profesional
            <select name="professional" defaultValue={booking.professionalId}>
              {space.professionals
                .filter(
                  (p) => p.enabled && p.serviceIds.includes(booking.serviceId),
                )
                .map((p) => (
                  <option value={p._id} key={p._id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <button className="av-button">Guardar nuevo horario</button>
        </fieldset>
        <Feedback task={task} />
      </form>
    </details>
  );
}
