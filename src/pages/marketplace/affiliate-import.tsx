import { useState } from "react";
import { useAction } from "convex/react";
import { Download, Link2, Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { AffiliateImportDraft as ImportedDraft, AffiliateImportResult } from "@/convex/lib/marketplace_affiliate_import";
import { Button } from "@/components/ui/button";
import { marketErrorMessage } from "@/lib/marketplace-upload";
import "./affiliate-import.css";

export type AffiliateImportDraft = Omit<ImportedDraft, "gallery"> & { gallery?: ImportedDraft["gallery"] };
type Selection = "title" | "description" | "price" | "gallery";
const FIELD_LABELS: Record<Selection, string> = { title: "Título", description: "Descripción", price: "Precio y moneda", gallery: "Fotos y videos" };

export default function AffiliateImport({ initialUrl = "", onApply }: { initialUrl?: string; onApply: (draft: AffiliateImportDraft) => void }) {
  const preview = useAction(api.marketplace_import.previewAffiliate);
  const [url, setUrl] = useState(initialUrl);
  const [result, setResult] = useState<AffiliateImportResult | null>(null);
  const [selected, setSelected] = useState<Set<Selection>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const load = async () => {
    if (busy) return;
    setBusy(true); setError(null); setApplied(false); setResult(null); setSelected(new Set());
    try { setResult(await preview({ affiliateUrl: url.trim() })); }
    catch (cause) { setError(marketErrorMessage(cause, "No se pudo consultar el producto. Podés completar la publicación manualmente.")); }
    finally { setBusy(false); }
  };
  const apply = () => {
    if (!result) return;
    const source = result.draft;
    onApply({
      externalUrl: source.externalUrl,
      importSource: source.importSource,
      ...(selected.has("title") && source.title ? { title: source.title } : {}),
      ...(selected.has("description") && source.description ? { description: source.description } : {}),
      ...(selected.has("price") && source.priceAmount && (source.currency === "ARS" || source.currency === "USD") ? { priceAmount: source.priceAmount, currency: source.currency } : {}),
      ...(selected.has("gallery") ? { gallery: source.gallery } : {}),
    });
    setApplied(true);
  };
  const available = result ? {
    title: Boolean(result.draft.title), description: Boolean(result.draft.description),
    price: Boolean(result.draft.priceAmount && (result.draft.currency === "ARS" || result.draft.currency === "USD")), gallery: result.draft.gallery.length > 0,
  } : null;

  return (
    <section className="vm-affiliate-import" aria-label="Importar desde Mercado Libre">
      <div className="vm-affiliate-heading"><Link2 aria-hidden="true" /><strong>Importar desde Mercado Libre</strong></div>
      <p>Pegá tu enlace de afiliado. Revisá los datos y elegí qué aplicar al borrador; nada se publica automáticamente.</p>
      <label htmlFor="vm-import-url">Enlace para importar</label>
      <div className="vm-affiliate-input">
        <input id="vm-import-url" type="url" value={url} onChange={(event) => { setUrl(event.target.value); setResult(null); setApplied(false); }} placeholder="https://meli.la/…" disabled={busy} />
        <Button type="button" variant="outline" disabled={busy || !url.trim()} onClick={() => void load()}>{busy ? <Loader2 className="animate-spin" /> : <Download />}{busy ? "Consultando…" : "Consultar producto"}</Button>
      </div>
      {error && <p role="alert" className="vm-error">{error}</p>}
      {result && available && (
        <div className="vm-affiliate-preview">
          <div className="vm-affiliate-preview-heading"><strong>Revisar importación</strong><time dateTime={new Date(result.draft.importSource.importedAt).toISOString()}>{new Date(result.draft.importSource.importedAt).toLocaleString("es-AR")}</time></div>
          <p>Los campos están desmarcados para conservar tus cambios. El enlace de afiliado se mantiene completo y la compra se hace en Mercado Libre, sin un cobro adicional de VISO.</p>
          <div className="vm-affiliate-field-list">{(Object.keys(FIELD_LABELS) as Selection[]).map((field) => (
            <label key={field} className="vm-affiliate-field"><input type="checkbox" checked={selected.has(field)} disabled={!available[field] || applied} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(field); else next.delete(field); return next; })} />{FIELD_LABELS[field]}{!available[field] && <span>No disponible</span>}</label>
          ))}</div>
          {result.draft.title && <h4>{result.draft.title}</h4>}
          {result.draft.description && <p className="vm-affiliate-description">{result.draft.description}</p>}
          {result.draft.priceAmount && result.draft.currency && <p><strong>{new Intl.NumberFormat("es-AR", { style: "currency", currency: result.draft.currency }).format(result.draft.priceAmount / 100)}</strong> al importar. Verificá el precio antes de publicar.</p>}
          {result.draft.currency && !["ARS", "USD"].includes(result.draft.currency) && <p>El precio original está en {result.draft.currency}. VISO admite ARS y USD en esta etapa; completá el importe manualmente en la moneda elegida. No se convierte automáticamente.</p>}
          {result.draft.importSource.availability && <p>{result.draft.importSource.availability}</p>}
          {result.draft.gallery.length > 0 && <div className="vm-affiliate-gallery">{result.draft.gallery.map((item) => item.mediaType === "video" ? <video key={item.id} src={item.externalUrl} controls preload="metadata" playsInline /> : <img key={item.id} src={item.externalUrl} alt={item.name} loading="lazy" />)}</div>}
          {result.warnings.length > 0 && <ul className="vm-affiliate-warnings">{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
          <Button type="button" disabled={applied} onClick={apply}>{applied ? "Datos aplicados al borrador" : selected.size ? "Aplicar campos seleccionados" : "Usar sólo el enlace"}</Button>
          <p className="vm-affiliate-footnote">Podés editar todo antes de guardar. Consultar otra vez no reemplaza tu descripción ni tus archivos.</p>
        </div>
      )}
    </section>
  );
}
