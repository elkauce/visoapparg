import { useId, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  makeQrPlate,
  normalizeTemplate,
  qrPlatePng,
  qrTemplates,
  type QrTemplate,
} from "./qr-templates";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams, Link } from "react-router-dom";
import { errorText, qrUrl } from "./config";
import { isTeavisoAndroid, saveNativeQr } from "./native-app";

export function QrDownload({
  url,
  label,
  initialTemplate,
  onSaveTemplate,
  compact = false,
}: {
  url: string;
  label: string;
  compact?: boolean;
  initialTemplate?: QrTemplate;
  onSaveTemplate?: (template: QrTemplate) => Promise<unknown>;
}) {
  const [selected, setSelected] = useState<QrTemplate>(
    normalizeTemplate(initialTemplate),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [saved, setSaved] = useState(false);
  const groupId = useId();
  const plate = useMemo(
    () => makeQrPlate(url, label, selected),
    [url, label, selected],
  );
  const name =
    label.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 50) || "te-a-viso";
  async function download(kind: "svg" | "png") {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    let objectUrl: string | undefined;
    try {
      if (isTeavisoAndroid()) {
        const contents =
          kind === "png"
            ? await qrPlatePng(plate.svg, plate.width, plate.height)
            : plate.svg;
        await saveNativeQr(`${name}-${selected}.${kind}`, kind, contents);
        return;
      }
      let href: string;
      if (kind === "png")
        href = await qrPlatePng(plate.svg, plate.width, plate.height);
      else {
        objectUrl = URL.createObjectURL(
          new Blob([plate.svg], { type: "image/svg+xml" }),
        );
        href = objectUrl;
      }
      const a = document.createElement("a");
      a.href = href;
      a.download = `${name}-${selected}.${kind}`;
      a.click();
    } catch {
      setError("No pudimos descargar el diseño. Intentá nuevamente.");
    } finally {
      if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl!), 1000);
      lock.current = false;
      setBusy(false);
    }
  }
  async function save() {
    if (lock.current || !onSaveTemplate) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await onSaveTemplate(selected);
      setSaved(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="tea-qr-preview">
      {!compact && (
        <fieldset className="tea-template-picker" disabled={busy}>
          <legend>Elegí el diseño de tu placa</legend>
          <div>
            {qrTemplates.map((template) => (
              <label
                key={template.id}
                className={`tea-template-choice ${selected === template.id ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name={groupId}
                  value={template.id}
                  checked={selected === template.id}
                  onChange={() => {
                    setSelected(template.id);
                    setSaved(false);
                  }}
                />
                <span
                  className={`tea-template-swatch ${template.id}`}
                  aria-hidden="true"
                />
                <strong>{template.name}</strong>
                <small>{template.description}</small>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {compact ? (
        <div className="tea-plate-preview gd-compact-code">
          <QRCodeSVG
            value={url}
            size={208}
            marginSize={4}
            level="M"
            aria-label="QR de tu timbre"
          />
        </div>
      ) : (
        <div
          className="tea-plate-preview"
          dangerouslySetInnerHTML={{ __html: plate.svg }}
        />
      )}
      <p className="tea-print-size">
        {plate.width / 10} × {plate.height / 10} mm · listo para imprimir
      </p>
      <div className="tea-actions">
        <button
          disabled={busy}
          className="button"
          onClick={() => void download("png")}
        >
          Descargar PNG
        </button>
        {!compact && (
          <button
            disabled={busy}
            className="tea-secondary"
            onClick={() => void download("svg")}
          >
            Descargar SVG
          </button>
        )}
        {onSaveTemplate && (
          <button
            disabled={busy}
            className="tea-secondary"
            onClick={() => void save()}
          >
            Guardar diseño
          </button>
        )}
      </div>
      <a
        className="tea-link"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Probar mi QR
      </a>
      {saved && <p role="status">Diseño guardado en tu cuenta.</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export default function WhatsappPanel() {
  const rows = useQuery(api.teaviso.myWhatsappQrs, {});
  const save = useMutation(api.teaviso.saveWhatsappQr);
  const saveTemplate = useMutation(api.teaviso.saveQrTemplate);
  const archive = useMutation(api.teaviso.archiveWhatsappQr);
  const [editing, setEditing] = useState<
    Id<"teavisoWhatsappQrs"> | undefined
  >();
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const item = rows?.find((row) => row._id === editing);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    const data = new FormData(e.currentTarget);
    try {
      await save({
        ...(editing ? { id: editing } : {}),
        label: String(data.get("label")),
        phone: String(data.get("phone")),
        message: String(data.get("message")),
        enabled: data.get("enabled") === "on",
        consent: data.get("consent") === "on",
      });
      setEditing(undefined);
      setRevision((x) => x + 1);
      setSuccess("QR guardado en tu cuenta. Ya podés descargarlo.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function remove(id: Id<"teavisoWhatsappQrs">) {
    if (
      !window.confirm(
        "¿Eliminar este QR? El código impreso dejará de funcionar.",
      )
    )
      return;
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await archive({ id });
      if (editing === id) {
        setEditing(undefined);
        setRevision((x) => x + 1);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="tea-stack">
      <header>
        <span className="eyebrow">TU ENTRADA · A TU ESTILO</span>
        <h1>Mis entradas</h1>
        <p>Editá el número o el mensaje sin cambiar el QR que ya imprimiste.</p>
      </header>
      <section className="tea-card">
        <h2>{item ? "Editar QR" : "Crear un QR"}</h2>
        <form key={`${editing ?? "new"}:${revision}`} onSubmit={submit}>
          <fieldset disabled={busy}>
            <div className="tea-grid">
              <label>
                Nombre del lugar
                <input
                  name="label"
                  defaultValue={item?.label}
                  placeholder="Mi casa, local u oficina"
                  required
                  maxLength={80}
                />
              </label>
              <label>
                WhatsApp con código de país
                <input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  defaultValue={item?.phone}
                  placeholder="5491112345678"
                  required
                  maxLength={30}
                />
                <small>
                  Argentina: 549 + característica + número, sin 0 ni 15.
                </small>
              </label>
            </div>
            <label>
              Mensaje al abrir el chat
              <textarea
                name="message"
                defaultValue={
                  item?.message ?? "Hola, estoy en la puerta. ¿Podés atenderme?"
                }
                maxLength={500}
              />
            </label>
            <label className="tea-check">
              <input
                name="enabled"
                type="checkbox"
                defaultChecked={item?.enabled ?? true}
              />{" "}
              QR activo
            </label>
            <label className="tea-check">
              <input name="consent" type="checkbox" required /> Tengo permiso
              para publicar este número y entiendo que los visitantes podrán
              verlo en WhatsApp.
            </label>
            <div className="tea-actions">
              <button className="button" type="submit">
                {busy ? "Guardando…" : "Guardar entrada"}
              </button>
              {item && (
                <button
                  className="tea-secondary"
                  type="button"
                  onClick={() => {
                    setEditing(undefined);
                    setRevision((x) => x + 1);
                  }}
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </fieldset>
        </form>
        {error && <p role="alert">{error}</p>}
        {success && <p role="status">{success}</p>}
      </section>
      {rows === undefined ? (
        <p role="status">Cargando tus QR…</p>
      ) : rows.length === 0 ? (
        <section className="tea-card">
          <h2>Tu primer QR empieza acá</h2>
          <p>Configurá tu contacto y elegí una placa lista para imprimir.</p>
        </section>
      ) : (
        <div className="tea-grid">
          {rows.map((row) => (
            <article className="tea-card" key={row._id}>
              <div className="tea-card-head">
                <h2>{row.label}</h2>
                <span className="tea-badge">
                  {row.enabled ? "Activo" : "Pausado"}
                </span>
              </div>
              <p>+{row.phone}</p>
              <QrDownload
                url={qrUrl(row.token)}
                label={row.label}
                initialTemplate={row.qrTemplate}
                onSaveTemplate={(template) =>
                  saveTemplate({ kind: "personal", id: row._id, template })
                }
              />
              {!row.enabled && (
                <p className="tea-muted">
                  El QR está pausado. Activálo al editar para que vuelva a
                  funcionar.
                </p>
              )}
              <div className="tea-actions">
                <button
                  disabled={busy}
                  className="tea-secondary"
                  onClick={() => {
                    setEditing(row._id);
                    setRevision((x) => x + 1);
                    setSuccess("");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Editar
                </button>
                <button
                  disabled={busy}
                  className="tea-link-button"
                  onClick={() => void remove(row._id)}
                >
                  Eliminar QR
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="tea-muted">
        El QR abre un chat. La llamada se inicia dentro de WhatsApp. No
        ocultamos el número ni transferimos llamadas.
      </p>
    </div>
  );
}
export function WhatsappVisitor() {
  const { token } = useParams();
  const contact = useQuery(api.teaviso.publicWhatsapp, { token: token ?? "" });
  return (
    <main className="tea-visitor">
      <Link className="brand" to="/">
        <span className="tea-original-symbol" aria-hidden="true">
          <img src="/brand/viso-logo.png" alt="" />
        </span>
        Te Aviso
      </Link>
      <section className="tea-card">
        {contact === undefined ? (
          <p role="status">Buscando el lugar…</p>
        ) : contact ? (
          <>
            <span className="eyebrow">YA ESTÁS EN LA PUERTA</span>
            <h1>{contact.label}</h1>
            <p>Avisá que llegaste por WhatsApp.</p>
            <a className="button" href={contact.url} rel="noreferrer">
              Abrir WhatsApp
            </a>
            <small>
              Se abrirá el chat del lugar. No necesitás una cuenta en Te Aviso.
            </small>
          </>
        ) : (
          <>
            <h1>Este QR no está disponible</h1>
            <p>
              Puede estar pausado o haber sido eliminado. Comunicate con el
              lugar por otro medio.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
