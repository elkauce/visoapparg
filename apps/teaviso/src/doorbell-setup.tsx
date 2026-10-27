import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import {
  QrCode,
  Phone,
  MessageCircle,
  ArrowLeft,
  ArrowRight,
  Check,
} from "lucide-react";
import { Empty, Feedback, Loading } from "./ui-v2";
import { QrDownload } from "./qr";
import { publicOrigin } from "./config";
import { useTask } from "./use-teaviso-task";
import { randomToken } from "./v2-model";
type Kind = "home" | "business" | "office" | "building";
type Space = FunctionReturnType<typeof api.teaviso_spaces.get>;
const kinds = {
  home: "Casa o departamento",
  business: "Negocio o consultorio",
  office: "Oficina",
  building: "Edificio",
};
export function DoorbellList({ showEmpty = true }: { showEmpty?: boolean }) {
  const rows = useQuery(api.teaviso_setup.list, {}),
    adopt = useMutation(api.teaviso_setup.adoptDigital),
    adoptWhatsapp = useMutation(api.teaviso_spaces.create),
    navigate = useNavigate(),
    task = useTask();
  if (rows === undefined) return <Loading />;
  return (
    <section className="av-stack" aria-label="Tus timbres">
      <div className="gd-list">
        {rows.map((r) => (
          <article className="av-card gd-bell-card" key={r.source + r.id}>
            <QrCode size={21} />
            <div>
              <h2>{r.name}</h2>
              <p>{r.method}</p>
              <small>{r.enabled ? "Activo" : "Pausado"}</small>
            </div>
            {r.source === "space" ? (
              <Link
                className="av-button av-outline"
                to={`/panel/entradas/${r.id}`}
              >
                Configurar
              </Link>
            ) : !r.owner ? (
              <Link
                className="av-button av-outline"
                to={`/panel/llamadas?site=${r.id}`}
              >
                Ver timbre
              </Link>
            ) : (
              <button
                className="av-button av-outline"
                disabled={task.busy}
                onClick={() =>
                  void task.run(async () => {
                    const id =
                      r.source === "site"
                        ? await adopt({ siteId: r.id as Id<"timbreSites"> })
                        : await adoptWhatsapp({
                            name: r.name,
                            kind: "home",
                            timezone:
                              Intl.DateTimeFormat().resolvedOptions()
                                .timeZone || "America/Argentina/Buenos_Aires",
                            consent: false,
                            existingQrId: r.id as Id<"teavisoWhatsappQrs">,
                          });
                    navigate(`/panel/entradas/${id}`);
                  })
                }
              >
                Configurar
              </button>
            )}
          </article>
        ))}
      </div>
      {!rows.length && showEmpty && (
        <Empty title="Todavía no tenés timbres">
          <p>Creá uno y elegí cómo querés recibir a tus visitas.</p>
          <Link className="av-button" to="/panel/nuevo">
            Crear mi timbre
          </Link>
        </Empty>
      )}
      <Feedback task={task} />
    </section>
  );
}
export function SetupWizard() {
  const [params] = useSearchParams(),
    [step, setStep] = useState(1),
    [method, setMethod] = useState<"whatsapp" | "calls">(
      params.get("modo") === "llamadas" ? "calls" : "whatsapp",
    ),
    [kind, setKind] = useState<Kind>(
      params.get("mode") === "edificios"
        ? "building"
        : params.get("mode") === "negocios"
          ? "business"
          : "home",
    ),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [alsoWhatsapp, setAlsoWhatsapp] = useState(false),
    [consent, setConsent] = useState(false),
    [plan, setPlan] = useState(""),
    [result, setResult] = useState<Id<"teavisoSpaces"> | null>(null),
    [key] = useState(randomToken);
  const options = useQuery(api.teaviso_setup.options, { kind }),
    create = useMutation(api.teaviso_setup.create),
    task = useTask(),
    chosen =
      options?.plans.find((p) => p.id === plan && p.remaining > 0) ??
      options?.plans.find((p) => p.remaining > 0),
    wantsWhatsapp = method === "whatsapp" || alsoWhatsapp;
  if (result) return <CreatedDoorbell id={result} />;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
      return;
    }
    void task.run(async () => {
      const id = await create({
        key,
        name,
        kind,
        method: method === "calls" && alsoWhatsapp ? "both" : method,
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          "America/Argentina/Buenos_Aires",
        phone: wantsWhatsapp ? phone : undefined,
        consent,
        licenseId: method === "calls" ? chosen?.id : undefined,
      });
      setResult(id);
    });
  };
  return (
    <div className="gd-wizard av-card">
      <Link className="av-back" to="/panel/timbres">
        <ArrowLeft size={16} />
        Mis timbres
      </Link>
      <ol className="gd-steps" aria-label="Configuración del timbre">
        <li className={step === 1 ? "current" : "done"}>1. Cómo te avisan</li>
        <li className={step === 2 ? "current" : ""}>2. Tus datos</li>
        <li>3. Tu QR</li>
      </ol>
      <h1>Crear un timbre</h1>
      <form className="av-form" onSubmit={submit}>
        <fieldset disabled={task.busy}>
          {step === 1 ? (
            <>
              <h2>¿Cómo querés recibir a tus visitas?</h2>
              <div className="gd-methods">
                <button
                  type="button"
                  aria-pressed={method === "whatsapp"}
                  className={method === "whatsapp" ? "selected" : ""}
                  onClick={() => setMethod("whatsapp")}
                >
                  <MessageCircle size={21} />
                  <span>
                    <strong>Por WhatsApp</strong>
                    <small>Tu número, un mensaje y QR. Sin cargo.</small>
                  </span>
                </button>
                <button
                  type="button"
                  aria-pressed={method === "calls"}
                  className={method === "calls" ? "selected" : ""}
                  onClick={() => setMethod("calls")}
                >
                  <Phone size={21} />
                  <span>
                    <strong>Por llamada en Te Aviso</strong>
                    <small>Audio o video, según tu plan.</small>
                  </span>
                </button>
              </div>
              {method === "calls" && options !== undefined && !chosen && (
                <div className="gd-plan-notice">
                  <p>
                    {options.plans.length
                      ? "Tus planes tienen todos sus timbres en uso."
                      : "Necesitás un plan que incluya llamadas."}
                  </p>
                  <Link className="sb-text-link" to="/panel/plan">
                    Ver mis planes
                  </Link>
                  <p>
                    También podés empezar con WhatsApp y sumar llamadas después.
                  </p>
                </div>
              )}
              <p className="sb-note">
                Podés agregar reservas y mensajes personalizados después.
              </p>
            </>
          ) : (
            <>
              <h2>
                {method === "whatsapp"
                  ? "Tu timbre por WhatsApp"
                  : "Tu timbre con llamadas"}
              </h2>
              <label>
                Nombre del timbre
                <input
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Mi casa o Consultorio"
                />
              </label>
              <label>
                Tipo de lugar
                <select
                  aria-label="Tipo de lugar"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as Kind)}
                >
                  {Object.entries(kinds).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {method === "calls" && (
                <>
                  {options === undefined ? (
                    <Loading />
                  ) : chosen ? (
                    <>
                      <p className="gd-plan-selected">
                        Llamadas incluidas en <strong>{chosen.name}</strong>.
                      </p>
                      {options.plans.filter((p) => p.remaining > 0).length >
                        1 && (
                        <label>
                          Plan para este timbre
                          <select
                            aria-label="Plan para este timbre"
                            value={chosen.id}
                            onChange={(e) => setPlan(e.target.value)}
                          >
                            {options.plans
                              .filter((p) => p.remaining > 0)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                          </select>
                        </label>
                      )}
                    </>
                  ) : (
                    <p role="alert">
                      No hay un plan con llamadas disponible para este tipo de
                      lugar. <Link to="/panel/plan">Ver mis planes</Link>
                    </p>
                  )}
                  <label className="av-check">
                    <input
                      type="checkbox"
                      checked={alsoWhatsapp}
                      onChange={(e) => setAlsoWhatsapp(e.target.checked)}
                    />
                    También quiero recibir por WhatsApp
                  </label>
                </>
              )}
              {wantsWhatsapp && (
                <>
                  <label>
                    Número de WhatsApp
                    <input
                      required
                      type="tel"
                      maxLength={30}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+54 9 11 1234 5678"
                      autoComplete="tel"
                    />
                  </label>
                  <p className="sb-note">
                    Incluí el código de país. En Argentina: +54 9, área y
                    número, sin 0 ni 15.
                  </p>
                  <label className="av-check">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      required
                    />
                    Puedo usar este número y acepto que sea visible en WhatsApp.
                  </label>
                </>
              )}
              {kind === "building" && method === "calls" && (
                <p className="sb-note">
                  Empezamos con una unidad Recepción. Después podés agregar los
                  departamentos y residentes.
                </p>
              )}
              <p className="sb-note">
                Vinculamos el timbre y preparamos el QR por vos.
              </p>
            </>
          )}
          <div className="av-form-actions">
            {step === 2 && (
              <button
                className="av-button av-outline"
                type="button"
                onClick={() => setStep(1)}
              >
                Atrás
              </button>
            )}
            <button
              className="av-button"
              type="submit"
              disabled={
                method === "calls" && (!chosen || options === undefined)
              }
            >
              {task.busy
                ? "Preparando tu timbre…"
                : step === 1
                  ? "Continuar"
                  : "Crear timbre y obtener QR"}
              <ArrowRight size={16} />
            </button>
          </div>
        </fieldset>
        <Feedback task={task} />
      </form>
    </div>
  );
}
function CreatedDoorbell({ id }: { id: Id<"teavisoSpaces"> }) {
  const space = useQuery(api.teaviso_spaces.get, { spaceId: id });
  if (!space) return <Loading />;
  return (
    <div className="av-stack gd-ready">
      <ol className="gd-steps">
        <li className="done">1. Cómo te avisan</li>
        <li className="done">2. Tus datos</li>
        <li className="current">3. Tu QR</li>
      </ol>
      <header>
        <span className="sb-eyebrow">
          <Check size={16} />
          Configuración completada
        </span>
        <h1>Tu timbre está listo</h1>
        <p>
          {space.name} ·{" "}
          {space.phone && space.timbreQrId
            ? "WhatsApp y llamadas"
            : space.phone
              ? "WhatsApp"
              : "Llamadas Te Aviso"}
        </p>
      </header>
      <QuickQr space={space} />
      <div className="gd-next">
        <h2>Ahora, probalo</h2>
        <p>
          Abrí el QR desde otro celular y comprobá cómo te llega el aviso antes
          de imprimirlo.
        </p>
        {space.timbreQrId && (
          <p>
            Para atender llamadas desde la web, mantené el panel abierto y
            permití las notificaciones.
          </p>
        )}
        <Link
          className="av-button av-outline"
          to={`/panel/entradas/${space._id}`}
        >
          Configurar mi timbre
        </Link>
        <Link className="sb-text-link" to="/panel/timbres">
          Ver mis timbres
        </Link>
      </div>
    </div>
  );
}
function QuickQr({ space }: { space: Space }) {
  const saveTemplate = useMutation(api.teaviso.saveQrTemplate);
  return (
    <section className="av-card gd-qr">
      <h2>El QR de tu timbre</h2>
      <QrDownload
        url={`${publicOrigin()}/w/${space.token}`}
        label={space.name}
        compact
      />
      <details>
        <summary>Otros diseños y formatos</summary>
        <QrDownload
          url={`${publicOrigin()}/w/${space.token}`}
          label={space.name}
          onSaveTemplate={
            space.whatsappQrId
              ? (template) =>
                  saveTemplate({
                    kind: "personal",
                    id: space.whatsappQrId!,
                    template,
                  })
              : undefined
          }
        />
      </details>
      <Link
        className="sb-text-link"
        to={`/panel/carteles/address?space=${space._id}`}
      >
        Quiero un cartel con mi QR →
      </Link>
    </section>
  );
}
export function BasicDoorbellEditor({ space }: { space: Space }) {
  const [name, setName] = useState(space.name),
    [phone, setPhone] = useState(space.phone ?? ""),
    [message, setMessage] = useState(space.message),
    [consent, setConsent] = useState(false),
    [enabled, setEnabled] = useState(space.enabled),
    [version, setVersion] = useState(space.revision),
    [showWhatsapp, setShowWhatsapp] = useState(!!space.phone),
    save = useMutation(api.teaviso_setup.saveBasics),
    task = useTask();
  const changedPhone = phone.replace(/[^0-9]/g, "") !== (space.phone ?? "");
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void task.run(async () => {
      await save({
        spaceId: space._id,
        revision: version,
        name,
        phone: showWhatsapp ? phone : "",
        message,
        enabled,
        consent,
      });
      setVersion((v) => v + 1);
    }, "Tu timbre se actualizó. El QR sigue siendo el mismo.");
  };
  return (
    <div className="av-stack">
      <Link className="sb-text-link" to="/panel/timbres">
        ← Mis timbres
      </Link>
      <header className="av-panel-heading">
        <div>
          <span className="sb-eyebrow">Configurar timbre</span>
          <h1>{space.name}</h1>
          <p>Tu contacto y tu QR, en un solo lugar.</p>
        </div>
      </header>
      {space.revision > version && (
        <div className="av-warning">
          Este timbre cambió en otra ventana.{" "}
          <button onClick={() => window.location.reload()}>
            Cargar la versión guardada
          </button>
        </div>
      )}
      <div className="gd-editor-layout">
        <div className="av-stack">
          <form className="av-card av-form" onSubmit={submit}>
            <h2>Datos principales</h2>
            <fieldset disabled={task.busy}>
              <label>
                Nombre del timbre
                <input
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="av-check">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                Timbre activo
              </label>
              {showWhatsapp ? (
                <>
                  <label>
                    Número de WhatsApp
                    <input
                      required
                      type="tel"
                      maxLength={30}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+54 9 11 1234 5678"
                    />
                  </label>
                  <label>
                    Mensaje que te envía la visita
                    <textarea
                      aria-label="Mensaje que te envía la visita"
                      maxLength={500}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </label>
                  {changedPhone && phone.trim() && (
                    <label className="av-check">
                      <input
                        type="checkbox"
                        required
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                      />
                      Confirmo que puedo usar este número y mostrarlo en
                      WhatsApp.
                    </label>
                  )}
                  <p className="sb-note">
                    La visita confirma el envío desde WhatsApp.
                  </p>
                </>
              ) : (
                <button
                  className="av-button av-outline"
                  type="button"
                  onClick={() => setShowWhatsapp(true)}
                >
                  Agregar WhatsApp
                </button>
              )}
              <button className="av-button" type="submit">
                {task.busy ? "Guardando…" : "Guardar timbre"}
              </button>
            </fieldset>
            <Feedback task={task} />
          </form>
          <CallsSetup
            space={space}
            onConnected={(revision) =>
              setVersion((v) => (v === revision ? revision + 1 : v))
            }
          />
          <section className="av-card gd-extras">
            <h2>¿Querés sumar otras funciones?</h2>
            <Link to={`/panel/agenda?space=${space._id}`}>
              Agenda y reservas →
            </Link>
            <Link
              to={`/panel/entradas/${space._id}?advanced=1&section=messages`}
            >
              Mensajes personalizados →
            </Link>
            <Link to={`/panel/entradas/${space._id}?advanced=1`}>
              Ajustes avanzados →
            </Link>
          </section>
        </div>
        <QuickQr space={space} />
      </div>
    </div>
  );
}
function CallsSetup({
  space,
  onConnected,
}: {
  space: Space;
  onConnected: (revision: number) => void;
}) {
  const options = useQuery(api.teaviso_setup.options, {
      kind: space.kind,
      spaceId: space._id,
    }),
    activate = useMutation(api.teaviso_setup.activateCalls),
    [plan, setPlan] = useState(""),
    task = useTask();
  const chosen =
    options?.plans.find((p) => p.id === plan && p.remaining > 0) ??
    options?.plans.find((p) => p.remaining > 0);
  return (
    <section className="av-card av-stack">
      <h2>Llamadas Te Aviso</h2>
      {options?.calls.configured && options.calls.enabled ? (
        <>
          <p>Las llamadas están listas. Usá tu mismo QR para recibirlas.</p>
          <Link
            className="av-button av-outline"
            to={`/panel/llamadas?site=${space.timbreSiteId ?? ""}`}
          >
            Notificaciones e integrantes
          </Link>
        </>
      ) : options === undefined ? (
        <Loading />
      ) : chosen ? (
        <>
          <p>
            Podés activar llamadas con tu plan <strong>{chosen.name}</strong>.
          </p>
          {options.plans.filter((p) => p.remaining > 0).length > 1 && (
            <label>
              Plan para las llamadas
              <select
                aria-label="Plan para las llamadas"
                value={chosen.id}
                onChange={(e) => setPlan(e.target.value)}
              >
                {options.plans
                  .filter((p) => p.remaining > 0)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <button
            className="av-button av-outline"
            disabled={task.busy}
            onClick={() =>
              void task.run(async () => {
                await activate({
                  spaceId: space._id,
                  revision: space.revision,
                  licenseId: chosen.id,
                });
                onConnected(space.revision);
              }, "Llamadas vinculadas a tu timbre.")
            }
          >
            {task.busy ? "Vinculando…" : "Activar llamadas en este timbre"}
          </button>
        </>
      ) : (
        <>
          <p>
            {options.plans.length
              ? "Tu plan ya tiene todos sus timbres en uso."
              : "Las llamadas requieren un plan compatible."}
          </p>
          <Link className="sb-text-link" to="/panel/plan">
            Ver opciones para mi cuenta →
          </Link>
        </>
      )}
      <Feedback task={task} />
    </section>
  );
}
