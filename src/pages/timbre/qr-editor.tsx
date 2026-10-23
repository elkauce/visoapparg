import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, ImagePlus, LoaderCircle, ScanLine, Trash2 } from "lucide-react";
import {
  defaultTimbreQrDesign, downloadTimbreExport, exportTimbreQr, loadTimbreImage,
  makeTimbreSvg, makeTimbrePreviewSvg, timbrePrintSpecification,
  type TimbreQrDesign,
} from "../../lib/timbre-qr";
import "./qr-editor.css";

export type { TimbreQrDesign } from "../../lib/timbre-qr";
export type TimbreQrEditorProps = {
  url: string;
  label: string;
  initialDesign?: TimbreQrDesign;
  onDesignChange?: (design: TimbreQrDesign) => void;
  libraryImages?: { id: string; name: string; url: string }[];
  fixedDimensions?: { widthMm: number; heightMm: number };
  previewOnly?: boolean;
};

const TEXT_FIELDS = [
  { key: "title", label: "Título", max: 80, placeholder: "Timbre VISO" },
  { key: "streetNumber", label: "Número de calle", max: 16, placeholder: "1234" },
  { key: "familyName", label: "Familia", max: 80, placeholder: "Familia González" },
  { key: "businessName", label: "Nombre comercial", max: 80, placeholder: "Nombre de tu empresa" },
  { key: "unit", label: "Departamento / unidad", max: 40, placeholder: "3 B" },
  { key: "legend", label: "Leyenda", max: 140, placeholder: "Escaneá para comunicarte" },
] as const;
const EMBLEMS: { value: TimbreQrDesign["emblem"]; label: string }[] = [
  { value: "bell", label: "Timbre" }, { value: "home", label: "Casa" }, { value: "office", label: "Oficina" },
  { value: "flag-ar", label: "Argentina" }, { value: "flag-uy", label: "Uruguay" },
  { value: "flag-br", label: "Brasil" }, { value: "none", label: "Sin ícono" },
];
const PALETTES = [
  { name: "VISO", backgroundColor: "#F5F3EF", textColor: "#17191D" },
  { name: "Blanco", backgroundColor: "#FFFFFF", textColor: "#17191D" },
  { name: "Noche", backgroundColor: "#17191D", textColor: "#FFFFFF" },
  { name: "Azul", backgroundColor: "#EAF0F5", textColor: "#163A52" },
  { name: "Arena", backgroundColor: "#EDE0CB", textColor: "#3B2D20" },
];

/** Remount with a different key when switching to another saved QR design. */
export default function TimbreQrEditor({ url, label, initialDesign, onDesignChange, libraryImages = [], fixedDimensions, previewOnly = false }: TimbreQrEditorProps) {
  const [design, setDesign] = useState<TimbreQrDesign>(() => ({ ...defaultTimbreQrDesign(label), ...initialDesign }));
  const [qrOnly, setQrOnly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const working = useRef(false), inputRef = useRef<HTMLInputElement>(null), prefix = useId();
  const snapshot = useRef({ design, onDesignChange });
  useEffect(() => { snapshot.current = { design, onDesignChange }; }, [design, onDesignChange]);
  const fixedWidth = fixedDimensions?.widthMm, fixedHeight = fixedDimensions?.heightMm;
  useEffect(() => {
    if (fixedWidth !== undefined && fixedHeight !== undefined)
      snapshot.current.onDesignChange?.({ ...snapshot.current.design, widthMm: fixedWidth, heightMm: fixedHeight });
  }, [fixedWidth, fixedHeight]);
  const activeDesign = fixedDimensions ? { ...design, ...fixedDimensions } : design;
  const preview = useMemo(() => {
    try {
      const currentDesign = fixedDimensions ? { ...design, ...fixedDimensions } : design;
      const svg = previewOnly ? makeTimbrePreviewSvg(currentDesign) : makeTimbreSvg(url, currentDesign, qrOnly);
      return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, spec: previewOnly ? null : timbrePrintSpecification(url, currentDesign, qrOnly), error: null };
    } catch (error) {
      return { src: null, spec: null, error: error instanceof Error ? error.message : "Revisá los datos del diseño." };
    }
  }, [url, design, qrOnly, fixedDimensions, previewOnly]);

  function update(patch: Partial<TimbreQrDesign>) {
    const next = { ...design, ...patch, ...fixedDimensions };
    setDesign(next); setFeedback(null); onDesignChange?.(next);
  }
  async function setImage(source: File | string) {
    if (working.current) return;
    working.current = true; setBusy("imagen"); setFeedback(null);
    try {
      const imageDataUrl = await loadTimbreImage(source);
      const next = { ...design, imageDataUrl, ...fixedDimensions };
      setDesign(next); onDesignChange?.(next);
    } catch (error) {
      setFeedback({ error: true, text: error instanceof Error ? error.message : "No se pudo cargar la imagen." });
    } finally { working.current = false; setBusy(null); }
  }
  async function download(format: "png" | "svg" | "pdf") {
    if (working.current || previewOnly) return;
    working.current = true; setBusy(format); setFeedback(null);
    try {
      const file = await exportTimbreQr(url, activeDesign, format, qrOnly);
      downloadTimbreExport(file);
      setFeedback({ error: false, text: `${format.toUpperCase()} listo. El QR superó la comprobación de lectura digital.` });
    } catch (error) {
      setFeedback({ error: true, text: error instanceof Error ? error.message : "No se pudo generar el archivo." });
    } finally { working.current = false; setBusy(null); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(url); setFeedback({ error: false, text: "Enlace del timbre copiado." }); }
    catch { setFeedback({ error: true, text: "No se pudo copiar el enlace. Probá desde un navegador con permisos de portapapeles." }); }
  }

  return <section className="timbre-qr-editor" aria-label="Personalizar QR y placa">
    <div className="timbre-qr-editor-heading">
      <div><h2>Tu QR, a tu manera</h2><p>Personalizá tu entrada y descargá un archivo listo para imprimir.</p></div>
      {!previewOnly && <button type="button" className="timbre-qr-secondary" onClick={copyLink} disabled={!!preview.error}><Copy size={16} /> Copiar enlace</button>}
    </div>
    <div className="timbre-qr-workspace">
      <div className="timbre-qr-controls">
        <fieldset disabled={!!busy}>
          <legend>Texto de la placa</legend>
          <div className="timbre-qr-fields">{TEXT_FIELDS.map((field) => <label key={field.key} htmlFor={`${prefix}-${field.key}`}>
            {field.label}<input id={`${prefix}-${field.key}`} value={design[field.key]} maxLength={field.max} placeholder={field.placeholder} onChange={(event) => update({ [field.key]: event.target.value })} />
          </label>)}</div>
        </fieldset>
        <fieldset disabled={!!busy}>
          <legend>Estilo</legend>
          <div className="timbre-qr-palettes" aria-label="Paletas">{PALETTES.map((palette) => <button key={palette.name} type="button" title={palette.name} aria-label={`Paleta ${palette.name}`} aria-pressed={design.backgroundColor === palette.backgroundColor && design.textColor === palette.textColor} style={{ background: palette.backgroundColor, color: palette.textColor }} onClick={() => update({ backgroundColor: palette.backgroundColor, textColor: palette.textColor })}><span>Aa</span>{palette.name}</button>)}</div>
          <div className="timbre-qr-fields">
            <label htmlFor={`${prefix}-font`}>Tipografía<select id={`${prefix}-font`} value={design.font} onChange={(event) => update({ font: event.target.value as TimbreQrDesign["font"] })}><option value="sans">Moderna</option><option value="serif">Clásica</option><option value="mono">Monoespaciada</option></select></label>
            <label htmlFor={`${prefix}-emblem`}>Ícono o bandera<select id={`${prefix}-emblem`} value={design.emblem} onChange={(event) => update({ emblem: event.target.value as TimbreQrDesign["emblem"] })}>{EMBLEMS.map((emblem) => <option key={emblem.value} value={emblem.value}>{emblem.label}</option>)}</select></label>
            {([
              ["backgroundColor", "Fondo de la placa"], ["textColor", "Texto de la placa"],
              ["qrColor", "Módulos del QR"], ["qrBackground", "Fondo del QR"],
            ] as const).map(([key, text]) => <label key={key} className="timbre-qr-color" htmlFor={`${prefix}-${key}`}>{text}<span><input type="color" aria-label={text} id={`${prefix}-${key}`} value={design[key]} onChange={(event) => update({ [key]: event.target.value })} /><code>{design[key].toUpperCase()}</code></span></label>)}
          </div>
          <div className="timbre-qr-image-controls">
            <input ref={inputRef} type="file" className="timbre-qr-file" accept="image/png,image/jpeg" aria-label="Subir imagen para la placa" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void setImage(file); }} />
            <button type="button" className="timbre-qr-secondary" onClick={() => inputRef.current?.click()}><ImagePlus size={16} /> Subir imagen</button>
            {design.imageDataUrl && <button type="button" className="timbre-qr-secondary" onClick={() => update({ imageDataUrl: undefined })}><Trash2 size={16} /> Quitar imagen</button>}
            {libraryImages.length > 0 && <label htmlFor={`${prefix}-library`}>Tu biblioteca<select id={`${prefix}-library`} value="" onChange={(event) => { const item = libraryImages.find((image) => image.id === event.target.value); if (item) void setImage(item.url); }}><option value="">Elegir una imagen…</option>{libraryImages.map((image) => <option key={image.id} value={image.id}>{image.name}</option>)}</select></label>}
          </div>
          <p className="timbre-qr-hint">Logo, escudo o dibujo propio: PNG o JPEG, hasta 700 KB y 4096 × 4096 px. La imagen acompaña al QR sin cubrirlo.</p>
        </fieldset>
        <fieldset disabled={!!busy}>
          <legend>Tamaño de impresión</legend>
          {!fixedDimensions && <div className="timbre-qr-orientation" aria-label="Orientación">
            <button type="button" aria-pressed={design.heightMm >= design.widthMm} onClick={() => update({ widthMm: Math.min(design.widthMm, design.heightMm), heightMm: Math.max(design.widthMm, design.heightMm) })}>Vertical</button>
            <button type="button" aria-pressed={design.widthMm > design.heightMm} onClick={() => update({ widthMm: Math.max(design.widthMm, design.heightMm), heightMm: Math.min(design.widthMm, design.heightMm) })}>Horizontal</button>
          </div>}
          <div className="timbre-qr-fields timbre-qr-dimensions">
            <label htmlFor={`${prefix}-width`}>Ancho (mm)<input id={`${prefix}-width`} type="number" min={50} max={300} value={activeDesign.widthMm} disabled={!!fixedDimensions} onChange={(event) => update({ widthMm: Number(event.target.value) })} /></label>
            <label htmlFor={`${prefix}-height`}>Alto (mm)<input id={`${prefix}-height`} type="number" min={50} max={300} value={activeDesign.heightMm} disabled={!!fixedDimensions} onChange={(event) => update({ heightMm: Number(event.target.value) })} /></label>
            <label htmlFor={`${prefix}-bleed`}>Sangre (mm)<input id={`${prefix}-bleed`} type="number" min={0} max={5} step={.5} value={design.bleedMm} onChange={(event) => update({ bleedMm: Number(event.target.value) })} /></label>
          </div>
          <p className="timbre-qr-hint">{fixedDimensions ? "Las dimensiones corresponden a la placa seleccionada. " : ""}La sangre agrega fondo fuera de la línea de corte. Confirmá la medida con tu imprenta.</p>
        </fieldset>
      </div>
      <div className="timbre-qr-preview-column">
        <div className="timbre-qr-preview-card">
          <div className="timbre-qr-preview-title"><span>Vista previa</span><span>{previewOnly ? "Diseño antes de comprar" : qrOnly ? "Solo QR" : "Diseño completo"}</span></div>
          <div className="timbre-qr-preview-stage">
            {preview.src ? <img src={preview.src} alt={`Vista previa del ${qrOnly ? "QR" : "diseño"} de ${label}`} /> : <div className="timbre-qr-preview-error"><ScanLine size={40} /><p>{preview.error}</p></div>}
          </div>
          {preview.spec && <p className="timbre-qr-print-spec">{preview.spec.trimWidthMm} × {preview.spec.trimHeightMm} mm{preview.spec.bleedMm ? ` + ${preview.spec.bleedMm} mm de sangre` : ""}<br />300 dpi · QR con margen de 4 módulos</p>}
          {previewOnly && <p className="timbre-qr-print-spec">{activeDesign.widthMm} × {activeDesign.heightMm} mm<br />QR se vincula después del pago. Esta vista no es escaneable.</p>}
        </div>
        {!previewOnly && <div className="timbre-qr-downloads">
          <label className="timbre-qr-only" htmlFor={`${prefix}-only`}><input id={`${prefix}-only`} type="checkbox" checked={qrOnly} onChange={(event) => { setQrOnly(event.target.checked); setFeedback(null); }} disabled={!!busy} /><span>Descargar únicamente el QR<small>Cuadrado, con su margen de lectura.</small></span></label>
          <div className="timbre-qr-export-buttons">{(["png", "svg", "pdf"] as const).map((format) => <button key={format} type="button" className={format === "pdf" ? "timbre-qr-primary" : "timbre-qr-secondary"} disabled={!!preview.error || !!busy} onClick={() => void download(format)}>{busy === format ? <LoaderCircle size={16} className="timbre-qr-spin" /> : <Download size={16} />} {format.toUpperCase()}</button>)}</div>
          {busy && <p className="timbre-qr-feedback" role="status">{busy === "imagen" ? "Preparando imagen…" : "Generando archivo y comprobando la lectura del QR…"}</p>}
          {feedback && <p className={`timbre-qr-feedback ${feedback.error ? "is-error" : "is-success"}`} role={feedback.error ? "alert" : "status"}>{!feedback.error && <Check size={15} />}{feedback.text}</p>}
          <p className="timbre-qr-hint">Verificamos que el QR descargado abra tu timbre. Antes de fabricar una placa, probá también una impresión a tamaño real.</p>
        </div>}
        {previewOnly && feedback && <p className={`timbre-qr-feedback ${feedback.error ? "is-error" : "is-success"}`} role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
      </div>
    </div>
  </section>;
}
