import { useState, type FormEvent, type ReactNode } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BellRing,
  Plus,
  QrCode,
  Settings2,
  Users,
  History,
  Store,
} from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import PanelLayout from "../_components/panel-layout";
import { Button } from "@/components/ui/button";
import { SignInButton } from "@/components/ui/signin";
import TimbreQrEditor from "./qr-editor";
import { defaultTimbreQrDesign, type TimbreQrDesign } from "@/lib/timbre-qr";
import { timbreTask, useTimbreNow } from "./shared";
import { TimbreMessages } from "./call-session";
import { TimbreNotificationSettings } from "@/components/timbre-incoming";
import { TimbrePushSettings } from "@/components/timbre-push";
import { timbrePublicOrigin, timbrePublicQrUrl } from "@/lib/timbre-public-url";
import "./timbre.css";

type Site = FunctionReturnType<typeof api.timbre.workspace>["sites"][number];
function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="vt-card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="vt-toggle">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export default function TimbrePage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  return (
    <PanelLayout section="timbre" className="vt-management">
      <header className="viso-panel-header">
        <div>
          <h1>Timbre</h1>
          <p>Tu puerta, conectada con tu cuenta VISO.</p>
        </div>
        <BellRing aria-hidden="true" />
      </header>
      {isLoading ? (
        <p role="status">Cargando tu cuenta…</p>
      ) : isAuthenticated ? (
        <TimbreWorkspace />
      ) : (
        <Card title="Recibí tus visitas desde VISO">
          <p>
            Ingresá con tu cuenta para conocer los planes, administrar tus QR y
            atender llamadas.
          </p>
          <SignInButton signInText="Entrar o crear cuenta" />
        </Card>
      )}
    </PanelLayout>
  );
}

function TimbreWorkspace() {
  const workspace = useQuery(api.timbre.workspace, {});
  const license = useQuery(api.timbre_commerce.myLicense, {});
  const [params, setParams] = useSearchParams();
  const [selection, setSelection] = useState<string>("");
  const [view, setView] = useState<"site" | "offers" | "admin">("site");
  const session = useQuery(api.marketplace.session, {});
  const create = useMutation(api.timbre.createSite);
  const acceptInvite = useMutation(api.timbre.acceptInvite);
  const now = useTimbreNow();
  const invite = params.get("invite");
  const site =
    workspace?.sites.find((row) => row._id === selection) ??
    workspace?.sites[0];
  if (!workspace || !license) return <p role="status">Cargando tus timbres…</p>;
  return (
    <div className="vt-stack">
      <TimbreNotificationSettings />
      <TimbrePushSettings />
      {invite && (
        <Card title="Te invitaron a un Timbre">
          <p>
            Al aceptar podrás participar con los permisos de esta invitación.
            Usá la cuenta a la que está dirigida.
          </p>
          <Button
            onClick={() =>
              void timbreTask(async () => {
                const id = await acceptInvite({ token: invite });
                setSelection(id);
                setParams({});
              }, "Invitación aceptada")
            }
          >
            Aceptar invitación
          </Button>
          <Button variant="ghost" onClick={() => setParams({})}>
            Descartar
          </Button>
        </Card>
      )}
      <div className="vt-toolbar">
        <div className="vt-segmented" aria-label="Secciones de Timbre">
          <button
            aria-pressed={view === "site"}
            onClick={() => setView("site")}
          >
            <BellRing /> Mis timbres
          </button>
          <button
            aria-pressed={view === "offers"}
            onClick={() => setView("offers")}
          >
            <Store /> Planes y placas
          </button>
          {session?.isAdmin && (
            <button
              aria-pressed={view === "admin"}
              onClick={() => setView("admin")}
            >
              <Settings2 /> Administración
            </button>
          )}
        </div>
        <Link to="/marketplace">Marketplace VISO</Link>
      </div>
      {view === "offers" ? (
        <TimbreCommercial />
      ) : view === "admin" && session?.isAdmin ? (
        <TimbreAdmin />
      ) : (
        <>
          {!license.active && !site?.licenseActive && (
            <div className="vt-notice">
              <strong>
                Necesitás una licencia activa para crear y usar un Timbre.
              </strong>
              <p>
                Se obtiene con un plan pago o con una compra elegible que lo
                incluya expresamente.
              </p>
              <Button onClick={() => setView("offers")}>Ver opciones</Button>
            </div>
          )}
          <div className="vt-toolbar">
            <label>
              Elegí tu Timbre
              <select
                value={site?._id ?? ""}
                onChange={(e) => setSelection(e.target.value)}
              >
                <option value="" disabled>
                  Seleccionar
                </option>
                {workspace.sites.map((row) => (
                  <option key={row._id} value={row._id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {site && <SiteWorkspace key={site._id} site={site} />}
          {license.active && (
            <Card title="Crear un Timbre">
              <form
                className="vt-form vt-form-inline"
                onSubmit={(e: FormEvent<HTMLFormElement>) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  void timbreTask(async () => {
                    const id = await create({
                      name: String(form.get("name")),
                      kind: String(form.get("kind")) as Site["kind"],
                      licenseId: String(
                        form.get("license"),
                      ) as Id<"timbreLicenses">,
                      timezone:
                        Intl.DateTimeFormat().resolvedOptions().timeZone,
                    });
                    setSelection(id);
                  }, "Timbre creado");
                }}
              >
                <label>
                  Nombre
                  <input
                    name="name"
                    required
                    maxLength={100}
                    placeholder="Mi casa, oficina o edificio"
                  />
                </label>
                <label>
                  Tipo
                  <select name="kind">
                    <option value="home">Hogar</option>
                    <option value="office">Oficina</option>
                    <option value="building">Edificio</option>
                  </select>
                </label>
                <label>
                  Licencia
                  <select name="license">
                    {license.licenses
                      .filter(
                        (row) =>
                          row.status === "active" &&
                          row.startsAt <= now &&
                          (!row.expiresAt || row.expiresAt > now),
                      )
                      .map((row) => (
                        <option key={row._id} value={row._id}>
                          {row.planName}
                        </option>
                      ))}
                  </select>
                </label>
                <Button type="submit">
                  <Plus /> Crear
                </Button>
              </form>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// Commercial management uses the existing marketplace and verified checkout.
import TimbreCommercial from "./commercial";
import TimbreAdmin from "./admin";

function SiteWorkspace({ site }: { site: Site }) {
  const [tab, setTab] = useState<"qrs" | "settings" | "members" | "history">(
    "qrs",
  );
  const save = useMutation(api.timbre.saveSiteSettings);
  const manager = site.role !== "resident";
  return (
    <>
      <section className="vt-site-heading">
        <div>
          <span className="vt-eyebrow">
            {site.kind === "building"
              ? "EDIFICIO"
              : site.kind === "office"
                ? "OFICINA"
                : "HOGAR"}
          </span>
          <h2>{site.name}</h2>
          <p>
            {site.licenseActive
              ? "Licencia activa"
              : "Licencia vencida o no disponible"}{" "}
            · {site.enabled ? "Timbre habilitado" : "Timbre desactivado"}
          </p>
        </div>
        {manager && (
          <Button
            variant={site.enabled ? "outline" : "default"}
            onClick={() =>
              void timbreTask(
                () => save({ siteId: site._id, enabled: !site.enabled }),
                site.enabled
                  ? "Timbre desactivado. El QR impreso se conserva."
                  : "Timbre activado",
              )
            }
          >
            {site.enabled ? "Desactivar Timbre" : "Activar Timbre"}
          </Button>
        )}
      </section>
      <nav className="vt-segmented" aria-label="Administrar Timbre">
        {(
          [
            { id: "qrs", label: "Mis QR", icon: QrCode },
            ...(manager
              ? [
                  { id: "settings", label: "Disponibilidad", icon: Settings2 },
                  {
                    id: "members",
                    label: "Integrantes y unidades",
                    icon: Users,
                  },
                ]
              : []),
            { id: "history", label: "Historial", icon: History },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            aria-pressed={tab === id}
            onClick={() => setTab(id as typeof tab)}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>
      {tab === "qrs" ? (
        <SiteQrs site={site} manager={manager} />
      ) : tab === "settings" && manager ? (
        <SiteSettings site={site} />
      ) : tab === "members" && manager ? (
        <SiteMembers site={site} />
      ) : (
        <SiteHistory site={site} />
      )}
    </>
  );
}

function SiteQrs({ site, manager }: { site: Site; manager: boolean }) {
  const qrs = useQuery(api.timbre.listQrs, { siteId: site._id });
  const units = useQuery(api.timbre.listUnits, { siteId: site._id });
  const library = useQuery(api.marketplace.library, {});
  const create = useMutation(api.timbre.createQr);
  const save = useMutation(api.timbre.saveQr);
  const revoke = useMutation(api.timbre.revokeQr);
  const rotate = useMutation(api.timbre.rotateQr);
  const saveDesign = useMutation(api.timbre.saveQrDesign);
  const [selectedId, setSelectedId] = useState<string>("");
  const [confirmAction, setConfirmAction] = useState<
    "rotate" | "revoke" | null
  >(null);
  const [draft, setDraft] = useState<TimbreQrDesign | null>(null);
  const qr =
    qrs?.find((row) => row._id === selectedId) ??
    qrs?.find((row) => !row.revokedAt);
  const fullQr = useQuery(
    api.timbre.qrForExport,
    qr && manager && site.licenseActive && !qr.revokedAt
      ? { qrId: qr._id }
      : "skip",
  );
  const url = qr ? timbrePublicQrUrl(qr.token) : "";
  const images =
    library?.flatMap((entry) =>
      entry.assets
        .filter((asset) => asset.mediaType === "image")
        .flatMap((asset) => {
          const url = asset.url ?? asset.builtinPath;
          return url
            ? [
                {
                  id: `${entry.productId}:${asset.id}`,
                  name: `${entry.title} · ${asset.name}`,
                  url,
                },
              ]
            : [];
        }),
    ) ?? [];
  return (
    <div className="vt-stack">
      {manager && site.licenseActive && (
        <Card title="Un QR para cada acceso">
          <form
            className="vt-form vt-form-inline"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void timbreTask(async () => {
                const unitId = String(data.get("unit") ?? "");
                const id = await create({
                  siteId: site._id,
                  label: String(data.get("label")),
                  ...(unitId ? { unitId: unitId as Id<"timbreUnits"> } : {}),
                });
                setSelectedId(id);
                setDraft(null);
              }, "QR creado");
            }}
          >
            <label>
              Nombre del acceso
              <input
                name="label"
                required
                maxLength={100}
                placeholder="Entrada principal"
              />
            </label>
            {site.kind !== "home" && (
              <label>
                Unidad
                <select name="unit">
                  <option value="">Directorio general</option>
                  {units
                    ?.filter((row) => row.enabled)
                    .map((row) => (
                      <option key={row._id} value={row._id}>
                        {row.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <Button type="submit">
              <Plus /> Crear QR
            </Button>
          </form>
        </Card>
      )}
      {qrs === undefined ? (
        <p role="status">Cargando QR…</p>
      ) : qrs.length === 0 ? (
        <Card title="Todavía no hay QR">
          <p>
            Creá el primer acceso para que tus visitantes puedan comunicarse.
          </p>
        </Card>
      ) : (
        <Card title="Tus accesos">
          <div className="vt-chip-list">
            {qrs.map((row) => (
              <button
                key={row._id}
                aria-pressed={qr?._id === row._id}
                onClick={() => {
                  setSelectedId(row._id);
                  setDraft(null);
                  setConfirmAction(null);
                }}
              >
                {row.label}
                {row.revokedAt
                  ? " · Revocado"
                  : row.enabled
                    ? ""
                    : " · Desactivado"}
              </button>
            ))}
          </div>
          {qr && (
            <>
              <div className="vt-toolbar">
                <span>{qr.label}</span>
                {manager && !qr.revokedAt && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      void timbreTask(() =>
                        save({ qrId: qr._id, enabled: !qr.enabled }),
                      )
                    }
                  >
                    {qr.enabled ? "Pausar QR" : "Habilitar QR"}
                  </Button>
                )}
              </div>
              {!qr.revokedAt && (
                <div className="vt-toolbar">
                  <a href={url} target="_blank" rel="noreferrer">
                    Abrir página del visitante
                  </a>
                  <Button
                    variant="outline"
                    onClick={() =>
                      void timbreTask(
                        () => navigator.clipboard.writeText(url),
                        "Enlace copiado",
                      )
                    }
                  >
                    Copiar enlace
                  </Button>
                </div>
              )}
              {manager && !qr.revokedAt && (
                <details className="vt-details">
                  <summary>Seguridad del QR</summary>
                  <p>
                    Pausarlo conserva tu impresión. Cambiar el enlace o
                    revocarlo deja inutilizable el código impreso anterior.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmAction("rotate")}
                  >
                    Cambiar enlace
                  </Button>{" "}
                  <Button
                    variant="destructive"
                    onClick={() => setConfirmAction("revoke")}
                  >
                    Revocar QR
                  </Button>
                  {confirmAction && (
                    <div role="alert" className="vt-notice">
                      <p>
                        ¿Confirmás{" "}
                        {confirmAction === "rotate"
                          ? "cambiar el enlace"
                          : "revocar este QR"}
                        ? El QR anterior dejará de funcionar.
                      </p>
                      <Button
                        variant="destructive"
                        onClick={() =>
                          void timbreTask(async () => {
                            if (confirmAction === "rotate")
                              await rotate({ qrId: qr._id });
                            else await revoke({ qrId: qr._id });
                            setConfirmAction(null);
                          })
                        }
                      >
                        Confirmar
                      </Button>{" "}
                      <Button
                        variant="outline"
                        onClick={() => setConfirmAction(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
                </details>
              )}
            </>
          )}
        </Card>
      )}
      {manager && qr && fullQr && !qr.revokedAt && site.licenseActive && (
        <Card title="Diseñá y descargá tu QR">
          <TimbreQrEditor
            key={`${qr._id}:${qr.token}`}
            url={url}
            label={qr.label}
            initialDesign={fullQr.qr.design}
            onDesignChange={setDraft}
            libraryImages={images}
          />
          <Button
            onClick={() =>
              void timbreTask(
                () =>
                  saveDesign({
                    qrId: qr._id,
                    design:
                      draft ??
                      fullQr.qr.design ??
                      defaultTimbreQrDesign(qr.label),
                  }),
                "Diseño guardado en tu cuenta",
              )
            }
          >
            Guardar diseño en VISO
          </Button>
          <p className="vt-caption">
            Para encargar una placa, guardá el diseño y elegí una variante en
            Planes y placas.
          </p>
        </Card>
      )}
    </div>
  );
}

function SiteSettings({ site }: { site: Site }) {
  const save = useMutation(api.timbre.saveSiteSettings);
  const update = (
    patch: Partial<
      Pick<
        Doc<"timbreSites">,
        | "allowedAudio"
        | "allowedVideo"
        | "chatEnabled"
        | "messagesEnabled"
        | "notificationsEnabled"
      >
    >,
  ) => void timbreTask(() => save({ siteId: site._id, ...patch }));
  const [ranges, setRanges] = useState(site.schedule);
  const [day, setDay] = useState(1);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  return (
    <div className="vt-grid">
      <Card title="Cómo pueden comunicarse">
        <Toggle
          label="Llamadas de audio"
          checked={site.allowedAudio}
          disabled={!site.allowedAudio && !site.licensedFeatures?.audio}
          onChange={(allowedAudio) => update({ allowedAudio })}
        />
        <Toggle
          label="Videollamadas"
          checked={site.allowedVideo}
          disabled={!site.allowedVideo && !site.licensedFeatures?.video}
          onChange={(allowedVideo) => update({ allowedVideo })}
        />
        <Toggle
          label="Chat"
          checked={site.chatEnabled}
          disabled={!site.chatEnabled && !site.licensedFeatures?.chat}
          onChange={(chatEnabled) => update({ chatEnabled })}
        />
        <Toggle
          label="Mensajes cuando no atendés"
          checked={site.messagesEnabled}
          disabled={!site.messagesEnabled && !site.licensedFeatures?.messages}
          onChange={(messagesEnabled) => update({ messagesEnabled })}
        />
        <Toggle
          label="Avisos de llamadas entrantes"
          checked={site.notificationsEnabled}
          onChange={(notificationsEnabled) => update({ notificationsEnabled })}
        />
        <p className="vt-caption">
          Las funciones disponibles dependen de tu licencia. Las notificaciones
          del navegador requieren permiso y VISO abierto.
        </p>
        <div className="vt-toolbar">
          <Button
            variant="outline"
            onClick={() =>
              void timbreTask(
                () =>
                  save({ siteId: site._id, mutedUntil: Date.now() + 3600000 }),
                "Silenciado por una hora",
              )
            }
          >
            Silenciar una hora
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              void timbreTask(
                () => save({ siteId: site._id, mutedUntil: null }),
                "Silencio desactivado",
              )
            }
          >
            Quitar silencio
          </Button>
        </div>
      </Card>
      <Card title="Nombre y respuesta de ausencia">
        <form
          className="vt-form"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            void timbreTask(
              () =>
                save({
                  siteId: site._id,
                  name: String(data.get("name")),
                  timezone: String(data.get("timezone")),
                  absenceMessage: String(data.get("message")),
                  fallbackAfterSeconds: Number(data.get("fallback")),
                }),
              "Configuración guardada",
            );
          }}
        >
          <label>
            Nombre
            <input
              name="name"
              defaultValue={site.name}
              required
              maxLength={100}
            />
          </label>
          <label>
            Zona horaria
            <input name="timezone" defaultValue={site.timezone} required />
          </label>
          <label>
            Mensaje de ausencia
            <textarea
              name="message"
              defaultValue={site.absenceMessage}
              maxLength={500}
            />
          </label>
          <label>
            Avisar a los destinatarios alternativos después de (segundos)
            <input
              name="fallback"
              type="number"
              min={10}
              max={120}
              defaultValue={site.fallbackAfterSeconds}
            />
          </label>
          <Button type="submit">Guardar</Button>
        </form>
      </Card>
      <Card title="Horarios de atención">
        <p>
          Sin franjas, el Timbre atiende todos los días. Los horarios usan{" "}
          {site.timezone}.
        </p>
        <div className="vt-form vt-form-inline">
          <label>
            Día
            <select
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
            >
              {[
                "Domingo",
                "Lunes",
                "Martes",
                "Miércoles",
                "Jueves",
                "Viernes",
                "Sábado",
              ].map((label, i) => (
                <option key={label} value={i}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Desde
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Hasta
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <Button
            variant="outline"
            onClick={() => setRanges([...ranges, { day, start, end }])}
          >
            Agregar franja
          </Button>
        </div>
        {ranges.map((range, i) => (
          <div className="vt-toolbar" key={i}>
            <span>
              {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][range.day]}{" "}
              {range.start}–{range.end}
            </span>
            <Button
              variant="ghost"
              onClick={() => setRanges(ranges.filter((_, n) => n !== i))}
            >
              Quitar
            </Button>
          </div>
        ))}
        <Button
          onClick={() =>
            void timbreTask(
              () => save({ siteId: site._id, schedule: ranges }),
              "Horarios guardados",
            )
          }
        >
          Guardar horarios
        </Button>
      </Card>
      {site.role === "owner" && (
        <>
          <SiteSignaling site={site} />
          <SiteLicense site={site} />
        </>
      )}
    </div>
  );
}

function SiteSignaling({ site }: { site: Site }) {
  const states = useQuery(api.statuses.list, {});
  const save = useMutation(api.timbre.saveSiteSettings);
  return (
    <Card title="Avisos en tus dispositivos y luces">
      <Toggle
        label="Mostrar En llamada al atender"
        checked={site.signalStatusOnAccept !== false}
        onChange={(signalStatusOnAccept) =>
          void timbreTask(() =>
            save({ siteId: site._id, signalStatusOnAccept }),
          )
        }
      />
      <label className="vt-form">
        Estado para avisar mientras suena
        <select
          value={site.ringStatusId ?? ""}
          onChange={(e) =>
            void timbreTask(() =>
              save({
                siteId: site._id,
                ringStatusId: e.target.value
                  ? (e.target.value as Id<"statuses">)
                  : null,
              }),
            )
          }
        >
          <option value="">No cambiar el estado al sonar</option>
          {states?.statuses.map((state) => (
            <option key={state._id} value={state._id}>
              {state.name}
            </option>
          ))}
        </select>
      </label>
      <p className="vt-caption">
        Usa los Display, Deck y luces que ya tengas vinculados a tu estado.
        Elegí un estado con el nombre y color que quieras para el timbre. Se
        restaura al terminar, respetando tus cambios manuales y las otras
        llamadas. La respuesta de cada luz y equipo depende de su conexión
        actual.
      </p>
    </Card>
  );
}

function SiteLicense({ site }: { site: Site }) {
  const licenses = useQuery(api.timbre_commerce.myLicenses, {});
  const change = useMutation(api.timbre.changeSiteLicense);
  const [licenseId, setLicenseId] = useState("");
  return (
    <Card title="Licencia de este Timbre">
      <p>
        Podés vincular una licencia paga renovada o un plan superior sin cambiar
        el QR impreso. Debe alcanzar para tus accesos, integrantes y unidades.
      </p>
      <div className="vt-form">
        <label>
          Licencia activa
          <select
            value={licenseId}
            onChange={(e) => setLicenseId(e.target.value)}
          >
            <option value="">Elegir licencia</option>
            {licenses
              ?.filter((row) => row.active)
              .map((row) => (
                <option key={row._id} value={row._id}>
                  {row.planName}
                  {row._id === site.licenseId ? " · actual" : ""}
                </option>
              ))}
          </select>
        </label>
        <Button
          disabled={!licenseId}
          onClick={() =>
            void timbreTask(
              () =>
                change({
                  siteId: site._id,
                  licenseId: licenseId as Id<"timbreLicenses">,
                }),
              "Licencia vinculada. Se conserva tu QR.",
            )
          }
        >
          Vincular licencia
        </Button>
      </div>
    </Card>
  );
}

function SiteMembers({ site }: { site: Site }) {
  const now = useTimbreNow();
  const members = useQuery(api.timbre.listMembers, { siteId: site._id });
  const units = useQuery(api.timbre.listUnits, { siteId: site._id });
  const invites = useQuery(api.timbre.listInvites, { siteId: site._id });
  const invite = useMutation(api.timbre.createInvite);
  const revokeInvite = useMutation(api.timbre.revokeInvite);
  const saveMember = useMutation(api.timbre.saveMember);
  const removeMember = useMutation(api.timbre.removeMember);
  const createUnit = useMutation(api.timbre.createUnit);
  const saveUnit = useMutation(api.timbre.saveUnit);
  const saveSite = useMutation(api.timbre.saveSiteSettings);
  const [inviteLink, setInviteLink] = useState("");
  const [remove, setRemove] = useState<string>("");
  return (
    <div className="vt-stack">
      <Card title="Integrantes y destinatarios">
        <p>
          Elegí quién recibe primero y a quién se avisa si nadie responde. Cada
          integrante usa su propia cuenta VISO.
        </p>
        <div className="vt-list">
          {members?.map((member) => (
            <div className="vt-member" key={member._id}>
              <div>
                <strong>{member.name}</strong>
                <p>
                  {member.email} ·{" "}
                  {member.role === "owner"
                    ? "Propietario"
                    : member.role === "manager"
                      ? "Responsable"
                      : "Residente"}
                </p>
              </div>
              <div className="vt-member-options">
                {site.role === "owner" && member.role !== "owner" && (
                  <label className="vt-form">
                    Permiso de {member.name}
                    <select
                      value={member.role}
                      onChange={(event) =>
                        void timbreTask(
                          () =>
                            saveMember({
                              memberId: member._id,
                              role: event.target.value as
                                "manager" | "resident",
                            }),
                          "Permiso actualizado",
                        )
                      }
                    >
                      <option value="resident">Residente</option>
                      <option value="manager">Responsable</option>
                    </select>
                  </label>
                )}
                {member.role !== "owner" && (
                  <Toggle
                    label="Puede recibir"
                    checked={member.canReceive}
                    onChange={(canReceive) =>
                      void timbreTask(() =>
                        saveMember({ memberId: member._id, canReceive }),
                      )
                    }
                  />
                )}
                {member.canReceive && (
                  <>
                    <Toggle
                      label="Principal"
                      checked={site.recipientIds.includes(member.userId)}
                      onChange={(checked) =>
                        void timbreTask(() =>
                          saveSite({
                            siteId: site._id,
                            recipientIds: checked
                              ? [...site.recipientIds, member.userId]
                              : site.recipientIds.filter(
                                  (id) => id !== member.userId,
                                ),
                          }),
                        )
                      }
                    />
                    <Toggle
                      label="Alternativo"
                      checked={
                        site.fallbackRecipientIds?.includes(member.userId) ??
                        false
                      }
                      onChange={(checked) =>
                        void timbreTask(() =>
                          saveSite({
                            siteId: site._id,
                            fallbackRecipientIds: checked
                              ? [
                                  ...(site.fallbackRecipientIds ?? []),
                                  member.userId,
                                ]
                              : (site.fallbackRecipientIds ?? []).filter(
                                  (id) => id !== member.userId,
                                ),
                          }),
                        )
                      }
                    />
                  </>
                )}
                {member.role !== "owner" && (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => setRemove(member._id)}
                    >
                      Quitar
                    </Button>
                    {remove === member._id && (
                      <Button
                        variant="destructive"
                        onClick={() =>
                          void timbreTask(
                            () => removeMember({ memberId: member._id }),
                            "Integrante eliminado",
                          )
                        }
                      >
                        Confirmar eliminación
                      </Button>
                    )}
                  </>
                )}
              </div>
              {site.kind !== "home" && member.role !== "owner" && (
                <fieldset className="vt-unit-members">
                  <legend>Unidades asignadas</legend>
                  {units
                    ?.filter((unit) => unit.enabled)
                    .map((unit) => (
                      <label key={unit._id}>
                        <input
                          type="checkbox"
                          checked={member.unitIds.includes(unit._id)}
                          onChange={(e) =>
                            void timbreTask(() =>
                              saveMember({
                                memberId: member._id,
                                unitIds: e.target.checked
                                  ? [...member.unitIds, unit._id]
                                  : member.unitIds.filter(
                                      (id) => id !== unit._id,
                                    ),
                              }),
                            )
                          }
                        />
                        {unit.name}
                      </label>
                    ))}
                </fieldset>
              )}
            </div>
          ))}
        </div>
      </Card>
      <Card title="Invitar a tu familia o equipo">
        <form
          className="vt-form vt-form-inline"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            void timbreTask(async () => {
              const email = String(data.get("email")).trim();
              const result = await invite({
                siteId: site._id,
                role: String(data.get("role")) as "manager" | "resident",
                ...(email ? { email } : {}),
                expiresInHours: Number(data.get("hours")),
                unitIds: data.getAll("units") as Id<"timbreUnits">[],
              });
              setInviteLink(
                `${timbrePublicOrigin()}/timbre?invite=${result.token}`,
              );
            }, "Invitación creada");
          }}
        >
          <label>
            Correo verificado (opcional)
            <input name="email" type="email" placeholder="persona@correo.com" />
          </label>
          <label>
            Permiso
            <select name="role">
              <option value="resident">Residente</option>
              {site.role === "owner" && (
                <option value="manager">Responsable</option>
              )}
            </select>
          </label>
          <label>
            Vence en horas
            <input
              name="hours"
              type="number"
              min={1}
              max={168}
              defaultValue={48}
            />
          </label>
          {site.kind !== "home" && (
            <fieldset>
              <legend>Unidades</legend>
              {units
                ?.filter((unit) => unit.enabled)
                .map((unit) => (
                  <label key={unit._id}>
                    <input type="checkbox" name="units" value={unit._id} />
                    {unit.name}
                  </label>
                ))}
            </fieldset>
          )}
          <Button type="submit">Crear invitación</Button>
        </form>
        {inviteLink && (
          <div className="vt-notice">
            <p>
              Compartí este enlace sólo con la persona invitada. No se envía
              automáticamente.
            </p>
            <input
              readOnly
              value={inviteLink}
              aria-label="Enlace de invitación"
            />
            <Button
              variant="outline"
              onClick={() =>
                void timbreTask(
                  () => navigator.clipboard.writeText(inviteLink),
                  "Invitación copiada",
                )
              }
            >
              Copiar
            </Button>
          </div>
        )}
        {invites
          ?.filter(
            (row) => !row.acceptedAt && !row.revokedAt && row.expiresAt > now,
          )
          .map((row) => (
            <div className="vt-toolbar" key={row._id}>
              <span>
                {row.email ?? "Invitación por enlace"} · vence{" "}
                {new Date(row.expiresAt).toLocaleString("es-AR")}
              </span>
              <Button
                variant="ghost"
                onClick={() =>
                  void timbreTask(() => revokeInvite({ invitationId: row._id }))
                }
              >
                Revocar invitación
              </Button>
            </div>
          ))}
      </Card>
      {site.kind !== "home" && (
        <Card title="Unidades y sectores">
          <form
            className="vt-form vt-form-inline"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void timbreTask(
                () =>
                  createUnit({
                    siteId: site._id,
                    name: String(data.get("name")),
                  }),
                "Unidad creada",
              );
            }}
          >
            <label>
              Nombre
              <input
                name="name"
                required
                maxLength={100}
                placeholder="Departamento 2A o Recepción"
              />
            </label>
            <Button type="submit">Agregar unidad</Button>
          </form>
          {units?.map((unit) => (
            <details key={unit._id} className="vt-details">
              <summary>
                {unit.name} · {unit.enabled ? "Habilitada" : "Desactivada"}
              </summary>
              <UnitIdentity
                key={`${unit._id}:${unit.name}:${unit.order}`}
                unit={unit}
              />
              <Toggle
                label="Unidad habilitada"
                checked={unit.enabled}
                onChange={(enabled) =>
                  void timbreTask(() => saveUnit({ unitId: unit._id, enabled }))
                }
              />
              {members
                ?.filter(
                  (member) =>
                    member.canReceive &&
                    (member.role !== "resident" ||
                      member.unitIds.includes(unit._id)),
                )
                .map((member) => (
                  <Toggle
                    key={member._id}
                    label={member.name}
                    checked={unit.recipientIds.includes(member.userId)}
                    onChange={(checked) =>
                      void timbreTask(() =>
                        saveUnit({
                          unitId: unit._id,
                          recipientIds: checked
                            ? [...unit.recipientIds, member.userId]
                            : unit.recipientIds.filter(
                                (id) => id !== member.userId,
                              ),
                        }),
                      )
                    }
                  />
                ))}
            </details>
          ))}
        </Card>
      )}
    </div>
  );
}

function UnitIdentity({ unit }: { unit: Doc<"timbreUnits"> }) {
  const save = useMutation(api.timbre.saveUnit);
  return (
    <form
      className="vt-form vt-form-inline"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void timbreTask(
          () =>
            save({
              unitId: unit._id,
              name: String(form.get("name") ?? "").trim(),
              order: Number(form.get("order")),
            }),
          "Unidad actualizada",
        );
      }}
    >
      <label>
        Nombre de la unidad
        <input name="name" defaultValue={unit.name} required maxLength={100} />
      </label>
      <label>
        Orden en el directorio
        <input
          name="order"
          type="number"
          min={0}
          max={10000}
          step={1}
          defaultValue={unit.order}
          required
        />
      </label>
      <Button type="submit">Guardar unidad</Button>
    </form>
  );
}

function SiteHistory({ site }: { site: Site }) {
  const history = useQuery(
    api.timbre_calls.history,
    site.licenseActive ? { siteId: site._id } : "skip",
  );
  if (!site.licenseActive)
    return (
      <Card title="Historial no disponible">
        <p>
          La licencia de este Timbre no está activa. El propietario puede
          renovarla o vincular otra licencia desde Disponibilidad.
        </p>
      </Card>
    );
  return (
    <div className="vt-stack">
      <Card title="Visitas y llamadas">
        <p>
          El historial se comparte sólo con los integrantes autorizados de este
          Timbre.
        </p>
        {history === undefined ? (
          <p role="status">Cargando historial…</p>
        ) : history.length === 0 ? (
          <p>Todavía no hay visitas.</p>
        ) : (
          history.map((call) => (
            <div className="vt-history-row" key={call.callId}>
              <div>
                <strong>
                  {call.mode === "video"
                    ? "Videollamada"
                    : call.mode === "audio"
                      ? "Llamada"
                      : "Chat"}
                </strong>
                <p>
                  {new Date(call.createdAt).toLocaleString("es-AR")} ·{" "}
                  {call.status}
                </p>
              </div>
              <Link to={`/timbre/call/${call.callId}`}>Ver comunicación</Link>
            </div>
          ))
        )}
      </Card>
      <TimbreMessages siteId={site._id} enabled={!!site.features?.messages} />
    </div>
  );
}
