import { useEffect, useId, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useAuthToken } from "@convex-dev/auth/react";
import {
  ArrowDown,
  ArrowUp,
  FileIcon,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MarketplaceCategory } from "@/convex/lib/marketplace_catalog";
import { marketExternalUrl } from "@/convex/lib/marketplace_validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  marketErrorMessage,
  marketplaceFileMediaType,
  uploadMarketplaceFile,
  validateMarketplaceFile,
  type MarketMediaType,
  type MarketUpload,
} from "@/lib/marketplace-upload";
import {
  CATEGORY_LABELS,
  type MarketChangelog,
  type MarketDetails,
  type MarketGalleryItem,
  type MarketProduct,
} from "./types";
import AffiliateImport, { type AffiliateImportDraft } from "./affiliate-import";
import "./studio.css";

export type EditableMarketProduct = Omit<
  MarketProduct,
  | "builtin"
  | "assetCount"
  | "acquired"
  | "owned"
  | "creatorName"
  | "delivery"
  | "assets"
> & {
  builtin?: boolean;
  creatorName?: string;
  delivery?: MarketProduct["delivery"];
  coverStorageId?: Id<"_storage">;
  coverPath?: string;
  importSource?: AffiliateImportDraft["importSource"];
  assets: {
    id: string;
    name: string;
    mediaType: MarketMediaType;
    storageId?: Id<"_storage">;
    builtinPath?: string;
    url?: string | null;
  }[];
};
type DraftAsset = {
  key: string;
  name: string;
  mediaType: MarketMediaType;
  storageId?: Id<"_storage">;
  builtinPath?: string;
  file?: File;
};
type DraftGallery = MarketGalleryItem & { file?: File };
const CATEGORIES = Object.entries(CATEGORY_LABELS) as [
  MarketplaceCategory,
  string,
][];
const ALLOWED: Record<MarketplaceCategory, MarketMediaType[]> = {
  icons: ["image", "video"],
  screensavers: ["image", "video"],
  soundboards: ["audio"],
  plugins: ["archive"],
  profiles: ["profile", "archive"],
  pages: [],
  hardware: [],
  new: [],
  used: [],
};
const VISUAL_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/webm";
const ACCEPT: Record<MarketplaceCategory, string> = {
  icons: VISUAL_ACCEPT,
  screensavers: VISUAL_ACCEPT,
  soundboards:
    "audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/webm",
  plugins: ".zip,.streamDeckPlugin,application/zip",
  profiles: ".json,.zip,.streamDeckProfile,application/json,application/zip",
  pages: "",
  hardware: "",
  new: "",
  used: "",
};
const DETAILS: [keyof MarketDetails, string][] = [
  ["type", "Tipo de producto"],
  ["device", "Dispositivos compatibles"],
  ["os", "Sistema operativo"],
  ["compatibility", "Compatibilidad y requisitos"],
  ["size", "Tamaño del paquete"],
  ["version", "Versión actual"],
  ["language", "Idioma"],
  ["supportUrl", "Enlace de soporte"],
  ["included", "Contenido incluido"],
];

export default function ProductForm({
  product,
  isAdmin,
  initialCategory = "icons",
  onClose,
  onSaved,
}: {
  product?: EditableMarketProduct | null;
  isAdmin: boolean;
  initialCategory?: MarketplaceCategory;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const id = useId();
  const token = useAuthToken();
  const saveProduct = useMutation(api.marketplace.saveProduct);
  const submitProduct = useMutation(api.marketplace.submitProduct);
  const [title, setTitle] = useState(product?.title ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [category, setCategory] = useState<MarketplaceCategory>(
    product?.category ?? initialCategory,
  );
  const [condition, setCondition] = useState<"new" | "used">(
    product?.condition ?? (initialCategory === "used" ? "used" : "new"),
  );
  const [priceMode, setPriceMode] = useState<MarketProduct["priceMode"]>(
    product?.priceMode ?? (initialCategory === "used" ? "external" : "free"),
  );
  const [price, setPrice] = useState(
    product?.priceAmount ? (product.priceAmount / 100).toFixed(2) : "",
  );
  const [currency, setCurrency] = useState<"ARS" | "USD">(
    product?.currency ?? "ARS",
  );
  const [externalUrl, setExternalUrl] = useState(product?.externalUrl ?? "");
  const [affiliate, setAffiliate] = useState(
    product?.affiliate ?? (isAdmin && initialCategory === "used"),
  );
  const [importSource, setImportSource] = useState(product?.importSource);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverRemoved, setCoverRemoved] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [assets, setAssets] = useState<DraftAsset[]>(() =>
    (product?.assets ?? []).map((asset) => ({
      key: asset.id,
      name: asset.name,
      mediaType: asset.mediaType,
      storageId: asset.storageId,
      builtinPath: asset.builtinPath,
    })),
  );
  const [gallery, setGallery] = useState<DraftGallery[]>(
    product?.gallery ?? [],
  );
  const [details, setDetails] = useState<MarketDetails>(product?.details ?? {});
  const [changelog, setChangelog] = useState<MarketChangelog[]>(
    product?.changelog ?? [],
  );
  const [pageTemplate, setPageTemplate] = useState<
    NonNullable<MarketProduct["pageTemplate"]>
  >(product?.pageTemplate ?? "weather");
  const [pageSettings, setPageSettings] = useState(
    product?.pageSettings ? JSON.stringify(product.pageSettings, null, 2) : "",
  );
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const uploads = useRef(new Map<File, MarketUpload>());
  const objectUrls = useRef<string[]>([]);
  const savedId = useRef<string | undefined>(product?.id);
  const hardware = ["hardware", "new", "used"].includes(category);
  const effectivePrice = affiliate
    ? "external"
    : hardware && priceMode === "free"
      ? "info"
      : !hardware && priceMode === "info"
        ? "free"
        : priceMode;
  const cover = coverPreview ?? (!coverRemoved ? product?.coverUrl : null);
  useEffect(
    () => () => {
      for (const url of objectUrls.current) URL.revokeObjectURL(url);
    },
    [],
  );
  const previewUrl = (file: File) => {
    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    return url;
  };

  function addFiles(files: FileList | null, asGallery = false) {
    if (!files) return;
    const current = asGallery ? gallery : assets;
    const limit = asGallery ? 24 : 32;
    if (current.length + files.length > limit) {
      setError(`Podés agregar hasta ${limit} archivos por sección.`);
      return;
    }
    const selected: { file: File; mediaType: MarketMediaType }[] = [];
    for (const file of Array.from(files)) {
      const invalid = validateMarketplaceFile(file);
      if (invalid) {
        setError(`${file.name}: ${invalid}`);
        return;
      }
      const mediaType = marketplaceFileMediaType(file)!;
      if (
        !(asGallery ? ["image", "video"] : ALLOWED[category]).includes(
          mediaType,
        )
      ) {
        setError(
          "El formato de uno de los archivos no corresponde a la categoría elegida.",
        );
        return;
      }
      if (
        current.some(
          (asset) =>
            asset.file?.name === file.name &&
            asset.file.size === file.size &&
            asset.file.lastModified === file.lastModified,
        )
      )
        continue;
      selected.push({ file, mediaType });
    }
    if (asGallery)
      setGallery((current) => [
        ...current,
        ...selected.map(({ file, mediaType }, index) => ({
          id: `${Date.now()}-${index}-${file.name}`,
          name: file.name.slice(0, 100),
          mediaType: mediaType as "image" | "video",
          file,
          url: previewUrl(file),
        })),
      ]);
    else
      setAssets((current) => [
        ...current,
        ...selected.map(({ file, mediaType }, index) => ({
          key: `${Date.now()}-${index}-${file.name}`,
          name: file.name.slice(0, 100),
          file,
          mediaType,
        })),
      ]);
    setError(null);
  }
  function applyImport(draft: AffiliateImportDraft) {
    if (draft.title !== undefined) setTitle(draft.title);
    if (draft.description !== undefined) setDescription(draft.description);
    if (
      draft.priceAmount !== undefined &&
      (draft.currency === "ARS" || draft.currency === "USD")
    ) {
      setPrice((draft.priceAmount / 100).toFixed(2));
      setCurrency(draft.currency);
    }
    if (draft.gallery !== undefined) setGallery(draft.gallery);
    setExternalUrl(draft.externalUrl);
    setImportSource(draft.importSource);
    setAffiliate(true);
    setPriceMode("external");
  }
  async function save(send: boolean) {
    if (pending.current) return;
    setError(null);
    if (!title.trim() || !description.trim()) {
      setError("Completá el título y la descripción.");
      return;
    }
    if (send && effectivePrice === "info") {
      setError(
        "Definí un precio y una forma de compra antes de publicar. Mientras tanto, guardá un borrador.",
      );
      return;
    }
    if (send && hardware && effectivePrice === "paid") {
      setError(
        "Por ahora, los equipos se venden mediante un enlace externo. Elegí esa forma de compra antes de publicar.",
      );
      return;
    }
    if (effectivePrice === "paid" && currency !== "ARS") {
      setError(
        "Los cobros de Mercado Pago Argentina se ofrecen en ARS. Elegí pesos argentinos y definí el precio que corresponda.",
      );
      return;
    }
    if (hardware && assets.length) {
      setError(
        "Retirá los archivos descargables para crear una ficha de hardware.",
      );
      return;
    }
    if (
      !hardware &&
      assets.some((asset) => !ALLOWED[category].includes(asset.mediaType))
    ) {
      setError(
        "Revisá los archivos: alguno no corresponde a la categoría elegida.",
      );
      return;
    }
    if (
      (effectivePrice === "free" || effectivePrice === "paid") &&
      !assets.length &&
      category !== "pages" &&
      !(
        product?.builtin &&
        product.category === category &&
        (product.delivery === "plugin" ||
          product.profileTemplate === "essential")
      )
    ) {
      setError("Agregá al menos un archivo para ofrecer este recurso.");
      return;
    }
    if (price.trim() && !/^\d+(?:[.,]\d{1,2})?$/.test(price.trim())) {
      setError("Ingresá un precio con hasta dos decimales.");
      return;
    }
    const amount = price.trim()
      ? Math.round(Number(price.replace(",", ".")) * 100)
      : undefined;
    if (
      (price.trim() &&
        (!amount || !Number.isSafeInteger(amount) || amount < 0)) ||
      (effectivePrice === "paid" && !amount) ||
      (send && effectivePrice === "external" && !amount)
    ) {
      setError(
        "Ingresá un precio válido antes de publicar. Podés guardar un borrador mientras lo definís.",
      );
      return;
    }
    let checkedUrl: string | undefined;
    let checkedSettings: Record<string, unknown> | undefined =
      category === "pages" ? {} : undefined;
    try {
      if (category === "pages" && pageSettings.trim()) {
        const parsed: unknown = JSON.parse(pageSettings);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          setError("La configuración de la página debe ser un objeto JSON.");
          return;
        }
        checkedSettings = parsed as Record<string, unknown>;
      }
      checkedUrl =
        effectivePrice === "external"
          ? marketExternalUrl(externalUrl, affiliate)
          : undefined;
      if (effectivePrice === "external" && !checkedUrl) {
        setError("Agregá el enlace de compra HTTPS.");
        return;
      }
    } catch (problem) {
      setError(marketErrorMessage(problem, "Revisá el enlace de compra."));
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      const upload = async (file: File) => {
        const cached = uploads.current.get(file);
        if (cached) return cached;
        const result = await uploadMarketplaceFile(file, token);
        uploads.current.set(file, result);
        return result;
      };
      let coverStorageId = coverRemoved ? undefined : product?.coverStorageId;
      if (coverFile) {
        setProgress("Subiendo portada…");
        coverStorageId = (await upload(coverFile)).storageId;
      }
      const prepared = [];
      for (let index = 0; index < assets.length; index++) {
        const asset = assets[index];
        setProgress(`Preparando archivo ${index + 1} de ${assets.length}…`);
        const stored = asset.file
          ? await upload(asset.file)
          : asset.storageId
            ? { storageId: asset.storageId, mediaType: asset.mediaType }
            : asset.builtinPath
              ? {
                  id: asset.key,
                  builtinPath: asset.builtinPath,
                  mediaType: asset.mediaType,
                }
              : null;
        if (!stored)
          throw new Error(
            "Falta un archivo. Volvé a seleccionarlo antes de guardar.",
          );
        prepared.push({
          name: asset.name.trim() || asset.file?.name || "Archivo",
          ...stored,
        });
      }
      const preparedGallery = [];
      for (let index = 0; index < gallery.length; index++) {
        const item = gallery[index];
        setProgress(`Preparando galería ${index + 1} de ${gallery.length}…`);
        const stored = item.file
          ? { storageId: (await upload(item.file)).storageId }
          : item.storageId
            ? { storageId: item.storageId as Id<"_storage"> }
            : item.builtinPath
              ? { builtinPath: item.builtinPath }
              : { externalUrl: item.externalUrl };
        preparedGallery.push({
          id: item.id,
          name: item.name.trim() || `Vista ${index + 1}`,
          mediaType: item.mediaType,
          ...stored,
        });
      }
      setProgress("Guardando producto…");
      const productId = await saveProduct({
        ...(savedId.current ? { productId: savedId.current } : {}),
        title: title.trim(),
        description: description.trim(),
        category,
        priceMode: effectivePrice,
        ...(coverStorageId ? { coverStorageId } : {}),
        ...(coverRemoved
          ? { coverPath: "" }
          : product?.coverPath
            ? { coverPath: product.coverPath }
            : {}),
        ...(checkedUrl ? { externalUrl: checkedUrl } : {}),
        affiliate,
        assets: prepared,
        gallery: preparedGallery,
        ...(hardware
          ? {
              condition:
                category === "used"
                  ? "used"
                  : category === "new"
                    ? "new"
                    : condition,
            }
          : {}),
        ...(effectivePrice !== "free" && amount
          ? { priceAmount: amount, currency }
          : {}),
        details: Object.fromEntries(
          Object.entries(details)
            .filter(([, value]) => value.trim())
            .map(([key, value]) => [key, value.trim()]),
        ),
        changelog: changelog
          .filter((change) => change.version.trim() || change.notes.trim())
          .map((change) => ({
            version: change.version.trim(),
            date: change.date,
            notes: change.notes.trim(),
          })),
        ...(category === "pages"
          ? {
              pageTemplate,
              ...(checkedSettings ? { pageSettings: checkedSettings } : {}),
            }
          : {}),
        ...(importSource ? { importSource } : {}),
      });
      savedId.current = productId;
      if (send) {
        setProgress("Enviando a revisión…");
        await submitProduct({ productId });
      }
      toast.success(
        send ? "Producto enviado a revisión." : "Borrador guardado.",
      );
      onSaved?.();
      onClose();
    } catch (problem) {
      setError(
        marketErrorMessage(
          problem,
          "No pudimos guardar el producto. Revisá los datos e intentá nuevamente.",
        ),
      );
    } finally {
      pending.current = false;
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent
        className="vm-studio-dialog vm-product-editor"
        showCloseButton={!busy}
        onEscapeKeyDown={(event) => busy && event.preventDefault()}
        onPointerDownOutside={(event) => busy && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {product
              ? "Editar producto"
              : category === "used"
                ? "Nuevo usado"
                : "Nuevo producto"}
          </DialogTitle>
          <DialogDescription>
            Prepará la ficha completa. Los cambios se revisan antes de
            publicarse.
          </DialogDescription>
        </DialogHeader>
        <form
          className="vm-studio-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save(false);
          }}
        >
          <fieldset disabled={busy} className="vm-studio-fields">
            {isAdmin && (
              <AffiliateImport initialUrl={externalUrl} onApply={applyImport} />
            )}
            <div>
              <Label htmlFor={`${id}-title`}>Título</Label>
              <Input
                id={`${id}-title`}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={100}
                placeholder="Por ejemplo, Iconos de estudio"
              />
            </div>
            <div>
              <Label htmlFor={`${id}-description`}>Descripción</Label>
              <Textarea
                id={`${id}-description`}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={6000}
                rows={5}
                placeholder="Qué incluye, para quién es y cómo se usa."
              />
            </div>
            <div className="vm-studio-field-row">
              <div>
                <Label htmlFor={`${id}-category`}>Categoría</Label>
                <select
                  id={`${id}-category`}
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as MarketplaceCategory)
                  }
                  className="vm-studio-select"
                >
                  {CATEGORIES.map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor={`${id}-price-mode`}>Cómo se ofrece</Label>
                <select
                  id={`${id}-price-mode`}
                  value={effectivePrice}
                  onChange={(event) =>
                    setPriceMode(event.target.value as typeof priceMode)
                  }
                  className="vm-studio-select"
                  disabled={affiliate}
                >
                  {!hardware && <option value="free">Gratis</option>}
                  <option value="paid" disabled={hardware}>
                    Compra en VISO · Recursos digitales
                  </option>
                  <option value="external">Compra en sitio externo</option>
                  {hardware && (
                    <option value="info">Borrador sin precio</option>
                  )}
                </select>
              </div>
            </div>
            {hardware && (
              <div>
                <Label htmlFor={`${id}-condition`}>Condición</Label>
                <select
                  id={`${id}-condition`}
                  className="vm-studio-select"
                  value={
                    category === "used"
                      ? "used"
                      : category === "new"
                        ? "new"
                        : condition
                  }
                  disabled={category !== "hardware"}
                  onChange={(event) =>
                    setCondition(event.target.value as typeof condition)
                  }
                >
                  <option value="new">Nuevo</option>
                  <option value="used">Usado</option>
                </select>
                <p className="vm-studio-help">
                  La misma publicación aparece en Hardware y en su condición,
                  sin duplicar el producto.
                </p>
              </div>
            )}
            {effectivePrice !== "free" && (
              <div className="vm-studio-field-row">
                <div>
                  <Label htmlFor={`${id}-amount`}>Precio</Label>
                  <Input
                    id={`${id}-amount`}
                    inputMode="decimal"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    placeholder="Por definir"
                  />
                  <p className="vm-studio-help">
                    El precio es obligatorio al publicar. Sin precio, guardá un
                    borrador.
                  </p>
                </div>
                <div>
                  <Label htmlFor={`${id}-currency`}>Moneda</Label>
                  <select
                    id={`${id}-currency`}
                    className="vm-studio-select"
                    value={currency}
                    onChange={(event) =>
                      setCurrency(event.target.value as typeof currency)
                    }
                  >
                    <option value="ARS">ARS · Peso argentino</option>
                    <option value="USD" disabled={effectivePrice === "paid"}>
                      USD · Dólar
                    </option>
                  </select>
                </div>
              </div>
            )}
            {isAdmin && (
              <label className="vm-form-check">
                <input
                  type="checkbox"
                  checked={affiliate}
                  onChange={(event) => {
                    setAffiliate(event.target.checked);
                    if (!event.target.checked) setImportSource(undefined);
                  }}
                />{" "}
                Este producto usa un enlace de afiliado
              </label>
            )}
            {effectivePrice === "external" && (
              <div>
                <Label htmlFor={`${id}-url`}>
                  {affiliate
                    ? "Enlace de afiliado de Mercado Libre"
                    : "Enlace de compra"}
                </Label>
                <Input
                  id={`${id}-url`}
                  type="url"
                  value={externalUrl}
                  onChange={(event) => {
                    setExternalUrl(event.target.value);
                    if (event.target.value !== importSource?.affiliateUrl)
                      setImportSource(undefined);
                  }}
                  placeholder={affiliate ? "https://meli.la/…" : "https://…"}
                  maxLength={4096}
                />
                <p className="vm-studio-help">
                  {affiliate
                    ? "Se conserva el enlace completo. La compra se realiza en Mercado Libre, sin una comisión de VISO."
                    : "El comprador completa la compra en ese sitio externo."}
                </p>
              </div>
            )}
            {category === "pages" && (
              <div>
                <Label htmlFor={`${id}-template`}>Página de VISO</Label>
                <select
                  id={`${id}-template`}
                  className="vm-studio-select"
                  value={pageTemplate}
                  onChange={(event) =>
                    setPageTemplate(event.target.value as typeof pageTemplate)
                  }
                >
                  <option value="football">Fútbol</option>
                  <option value="clock">Reloj</option>
                  <option value="weather">Clima</option>
                  <option value="spotify">Spotify</option>
                </select>
                <p className="vm-studio-help">
                  Se instala como una página del deck. La configuración se
                  sincroniza con la cuenta del usuario.
                </p>
                <Label htmlFor={`${id}-page-settings`}>
                  Configuración inicial de la página (opcional)
                </Label>
                <Textarea
                  id={`${id}-page-settings`}
                  value={pageSettings}
                  onChange={(event) => setPageSettings(event.target.value)}
                  rows={5}
                  spellCheck={false}
                  placeholder={
                    '{"screenSettings":{"city":"Córdoba","units":"celsius"}}'
                  }
                  maxLength={10000}
                />
                <p className="vm-studio-help">
                  Usá el formato JSON de la guía para creadores. El usuario
                  puede personalizar la página después de instalarla.
                </p>
              </div>
            )}
            <div>
              <Label htmlFor={`${id}-cover`}>Portada</Label>
              {cover && (
                <div className="vm-studio-cover">
                  <img src={cover} alt="Vista previa de la portada" />
                  <Button
                    variant="secondary"
                    type="button"
                    size="sm"
                    onClick={() => {
                      setCoverFile(null);
                      setCoverPreview(null);
                      setCoverRemoved(true);
                    }}
                  >
                    Quitar portada
                  </Button>
                </div>
              )}
              <Input
                id={`${id}-cover`}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const invalid = validateMarketplaceFile(file, true);
                  if (invalid) {
                    setError(invalid);
                    event.target.value = "";
                    return;
                  }
                  setCoverFile(file);
                  setCoverPreview(previewUrl(file));
                  setCoverRemoved(false);
                  setError(null);
                }}
              />
              <p className="vm-studio-help">
                PNG, JPG, WebP, GIF o AVIF. Hasta 60 MB.
              </p>
            </div>
            <section className="vm-studio-assets">
              <Label htmlFor={`${id}-gallery`}>
                Fotos y videos de la ficha
              </Label>
              <Input
                id={`${id}-gallery`}
                type="file"
                multiple
                accept={VISUAL_ACCEPT}
                onChange={(event) => {
                  addFiles(event.target.files, true);
                  event.target.value = "";
                }}
              />
              <p className="vm-studio-help">
                Fotos, GIF y videos verticales u horizontales. Se muestran
                completos, respetando su proporción. Estos archivos son públicos
                y separados de la descarga.
              </p>
              <div className="vm-editor-gallery">
                {gallery.map((item, index) => (
                  <div key={item.id} className="vm-editor-gallery-item">
                    {item.mediaType === "video" ? (
                      <video
                        src={item.url ?? item.externalUrl ?? item.builtinPath}
                        controls
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={item.url ?? item.externalUrl ?? item.builtinPath}
                        alt={item.name}
                      />
                    )}
                    <Input
                      aria-label={`Descripción de la vista ${index + 1}`}
                      value={item.name}
                      maxLength={100}
                      onChange={(event) =>
                        setGallery((current) =>
                          current.map((entry) =>
                            entry.id === item.id
                              ? { ...entry, name: event.target.value }
                              : entry,
                          ),
                        )
                      }
                    />
                    <div>
                      <Button
                        size="icon"
                        variant="ghost"
                        type="button"
                        aria-label={`Mover vista ${index + 1} antes`}
                        disabled={!index}
                        onClick={() =>
                          setGallery((current) => {
                            const next = [...current];
                            [next[index - 1], next[index]] = [
                              next[index],
                              next[index - 1],
                            ];
                            return next;
                          })
                        }
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        type="button"
                        aria-label={`Mover vista ${index + 1} después`}
                        disabled={index === gallery.length - 1}
                        onClick={() =>
                          setGallery((current) => {
                            const next = [...current];
                            [next[index + 1], next[index]] = [
                              next[index],
                              next[index + 1],
                            ];
                            return next;
                          })
                        }
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        type="button"
                        aria-label={`Quitar vista ${index + 1}`}
                        onClick={() =>
                          setGallery((current) =>
                            current.filter((entry) => entry.id !== item.id),
                          )
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            {!hardware && category !== "pages" && (
              <section className="vm-studio-assets">
                <Label htmlFor={`${id}-files`}>Archivos del producto</Label>
                <Input
                  id={`${id}-files`}
                  type="file"
                  multiple
                  accept={ACCEPT[category]}
                  onChange={(event) => {
                    addFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
                <p className="vm-studio-help">
                  Hasta 32 archivos de 60 MB. Perfiles JSON hasta 512 KB. Los
                  archivos de plugins se descargan y no se ejecutan en VISO.
                </p>
                {assets.map((asset, index) => (
                  <div className="vm-studio-file" key={asset.key}>
                    <FileIcon aria-hidden="true" />
                    <Input
                      aria-label={`Nombre del archivo ${index + 1}`}
                      value={asset.name}
                      maxLength={100}
                      onChange={(event) =>
                        setAssets((current) =>
                          current.map((item) =>
                            item.key === asset.key
                              ? { ...item, name: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      aria-label={`Quitar ${asset.name}`}
                      onClick={() =>
                        setAssets((current) =>
                          current.filter((item) => item.key !== asset.key),
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </section>
            )}
            <section className="vm-editor-section">
              <h3>Información técnica</h3>
              <div className="vm-studio-field-row">
                {DETAILS.map(([key, label]) => (
                  <div key={key}>
                    <Label htmlFor={`${id}-${key}`}>{label}</Label>
                    <Input
                      id={`${id}-${key}`}
                      value={details[key] ?? ""}
                      onChange={(event) =>
                        setDetails((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                      maxLength={key === "supportUrl" ? 4096 : 1000}
                      type={key === "supportUrl" ? "url" : "text"}
                    />
                  </div>
                ))}
              </div>
              <div>
                <Label htmlFor={`${id}-setup`}>
                  Instrucciones de instalación y uso
                </Label>
                <Textarea
                  id={`${id}-setup`}
                  value={details.setup ?? ""}
                  onChange={(event) =>
                    setDetails((current) => ({
                      ...current,
                      setup: event.target.value,
                    }))
                  }
                  rows={4}
                  maxLength={6000}
                />
              </div>
            </section>
            <section className="vm-editor-section">
              <div className="vm-studio-section-heading">
                <h3>Versiones y novedades</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setChangelog((current) => [
                      ...current,
                      {
                        version: "",
                        date: new Date().toISOString().slice(0, 10),
                        notes: "",
                      },
                    ])
                  }
                >
                  <Plus /> Agregar versión
                </Button>
              </div>
              {changelog.map((change, index) => (
                <div className="vm-editor-version" key={index}>
                  <div className="vm-studio-field-row">
                    <div>
                      <Label htmlFor={`${id}-v-${index}`}>
                        Versión {index + 1}
                      </Label>
                      <Input
                        id={`${id}-v-${index}`}
                        value={change.version}
                        maxLength={50}
                        onChange={(event) =>
                          setChangelog((current) =>
                            current.map((entry, i) =>
                              i === index
                                ? { ...entry, version: event.target.value }
                                : entry,
                            ),
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${id}-date-${index}`}>
                        Fecha de versión {index + 1}
                      </Label>
                      <Input
                        id={`${id}-date-${index}`}
                        type="date"
                        value={change.date}
                        onChange={(event) =>
                          setChangelog((current) =>
                            current.map((entry, i) =>
                              i === index
                                ? { ...entry, date: event.target.value }
                                : entry,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                  <Label htmlFor={`${id}-notes-${index}`}>
                    Novedades de versión {index + 1}
                  </Label>
                  <Textarea
                    id={`${id}-notes-${index}`}
                    value={change.notes}
                    maxLength={3000}
                    onChange={(event) =>
                      setChangelog((current) =>
                        current.map((entry, i) =>
                          i === index
                            ? { ...entry, notes: event.target.value }
                            : entry,
                        ),
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    type="button"
                    size="sm"
                    onClick={() =>
                      setChangelog((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Trash2 /> Quitar versión
                  </Button>
                </div>
              ))}
            </section>
            {(product?.status === "published" || product?.hasDraft) && (
              <p className="vm-studio-notice">
                La versión publicada sigue disponible mientras editás y se
                revisan los cambios. Los recursos ya adquiridos se conservan.
              </p>
            )}
          </fieldset>
          {error && (
            <p role="alert" className="vm-studio-error">
              {error}
            </p>
          )}
          {busy && (
            <p role="status" className="vm-studio-help">
              {progress}
            </p>
          )}
          <div className="vm-studio-dialog-actions">
            <Button
              variant="ghost"
              type="button"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button variant="outline" type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <FileIcon />}
              Guardar borrador
            </Button>
            <Button
              type="button"
              onClick={() => void save(true)}
              disabled={busy}
            >
              <Upload />
              Guardar y enviar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
