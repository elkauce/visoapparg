import { useEffect, useId, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useAuthToken } from "@convex-dev/auth/react";
import { FileIcon, Loader2, Trash2, Upload } from "lucide-react";
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
import "./studio.css";

export type EditableMarketProduct = {
  id: string;
  title: string;
  description: string;
  category: MarketplaceCategory;
  priceMode: "free" | "external" | "info";
  externalUrl?: string;
  affiliate: boolean;
  status: string;
  coverUrl?: string | null;
  coverStorageId?: Id<"_storage">;
  assets: {
    id: string;
    name: string;
    mediaType: MarketMediaType;
    storageId?: Id<"_storage">;
    url?: string | null;
  }[];
};

type DraftAsset = {
  key: string;
  name: string;
  mediaType: MarketMediaType;
  storageId?: Id<"_storage">;
  file?: File;
};
const CATEGORIES: { value: MarketplaceCategory; label: string }[] = [
  { value: "icons", label: "Iconos" },
  { value: "plugins", label: "Plugins" },
  { value: "profiles", label: "Perfiles" },
  { value: "screensavers", label: "Protectores de pantalla" },
  { value: "soundboards", label: "Sonidos" },
  { value: "hardware", label: "Hardware" },
  { value: "used", label: "Usados" },
];
const ALLOWED: Record<MarketplaceCategory, MarketMediaType[]> = {
  icons: ["image", "video"],
  screensavers: ["image", "video"],
  soundboards: ["audio"],
  plugins: ["archive"],
  profiles: ["profile", "archive"],
  hardware: [],
  used: [],
};
const ACCEPT: Record<MarketplaceCategory, string> = {
  icons:
    "image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/webm",
  screensavers:
    "image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/webm",
  soundboards:
    "audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/webm",
  plugins: ".zip,.streamDeckPlugin,application/zip",
  profiles: ".json,.zip,.streamDeckProfile,application/json,application/zip",
  hardware: "",
  used: "",
};

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
  const [priceMode, setPriceMode] = useState<"free" | "external" | "info">(
    product?.priceMode ?? (initialCategory === "used" ? "external" : "free"),
  );
  const [externalUrl, setExternalUrl] = useState(product?.externalUrl ?? "");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverRemoved, setCoverRemoved] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [assets, setAssets] = useState<DraftAsset[]>(() =>
    (product?.assets ?? []).map((asset) => ({
      key: asset.id,
      name: asset.name,
      mediaType: asset.mediaType,
      storageId: asset.storageId,
    })),
  );
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const uploads = useRef(new Map<File, MarketUpload>());
  const savedId = useRef<string | undefined>(product?.id);
  const hardware = category === "hardware" || category === "used";
  const effectivePrice =
    category === "used"
      ? "external"
      : hardware && priceMode === "free"
        ? "info"
        : !hardware && priceMode === "info"
          ? "free"
          : priceMode;
  const cover = coverPreview ?? (!coverRemoved ? product?.coverUrl : null);

  useEffect(
    () => () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    },
    [coverPreview],
  );

  function addFiles(files: FileList | null) {
    if (!files) return;
    if (assets.length + files.length > 32) {
      setError("Podés agregar hasta 32 archivos por producto.");
      return;
    }
    const selected: DraftAsset[] = [];
    for (const file of Array.from(files)) {
      const invalid = validateMarketplaceFile(file);
      if (invalid) {
        setError(`${file.name}: ${invalid}`);
        return;
      }
      const mediaType = marketplaceFileMediaType(file)!;
      if (!ALLOWED[category].includes(mediaType)) {
        setError(
          "El formato de uno de los archivos no corresponde a la categoría elegida.",
        );
        return;
      }
      if (
        assets.some(
          (asset) =>
            asset.file?.name === file.name &&
            asset.file.size === file.size &&
            asset.file.lastModified === file.lastModified,
        )
      )
        continue;
      selected.push({
        key: `${Date.now()}-${selected.length}-${file.name}`,
        name: file.name.slice(0, 100),
        file,
        mediaType,
      });
    }
    setAssets((current) => [...current, ...selected]);
    setError(null);
  }

  async function save(send: boolean) {
    if (pending.current) return;
    setError(null);
    if (!title.trim() || !description.trim()) {
      setError("Completá el título y la descripción.");
      return;
    }
    if (category === "used" && !isAdmin) {
      setError("Por ahora, VISO publica los productos usados.");
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
    if (effectivePrice === "free" && !assets.length) {
      setError(
        "Agregá al menos un archivo para ofrecer este recurso gratuito.",
      );
      return;
    }
    let checkedUrl: string | undefined;
    try {
      checkedUrl =
        effectivePrice === "external"
          ? marketExternalUrl(externalUrl, category === "used")
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
      const prepared: {
        name: string;
        storageId: Id<"_storage">;
        mediaType: MarketMediaType;
      }[] = [];
      for (let index = 0; index < assets.length; index++) {
        const asset = assets[index];
        setProgress(`Preparando archivo ${index + 1} de ${assets.length}…`);
        const stored = asset.file
          ? await upload(asset.file)
          : asset.storageId
            ? { storageId: asset.storageId, mediaType: asset.mediaType }
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
      setProgress("Guardando producto…");
      const productId = await saveProduct({
        ...(savedId.current ? { productId: savedId.current } : {}),
        title: title.trim(),
        description: description.trim(),
        category,
        priceMode: effectivePrice,
        ...(coverStorageId ? { coverStorageId } : {}),
        ...(checkedUrl ? { externalUrl: checkedUrl } : {}),
        affiliate: category === "used",
        assets: prepared,
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="vm-studio-dialog"
        showCloseButton={!busy}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault();
        }}
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
            Prepará la ficha y sus archivos. VISO revisa cada publicación antes
            de mostrarla en el marketplace.
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
                rows={4}
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
                  {CATEGORIES.filter(
                    (item) => isAdmin || item.value !== "used",
                  ).map((item) => (
                    <option value={item.value} key={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              {category !== "used" && (
                <div>
                  <Label htmlFor={`${id}-price`}>Cómo se ofrece</Label>
                  <select
                    id={`${id}-price`}
                    value={effectivePrice}
                    onChange={(event) =>
                      setPriceMode(event.target.value as typeof priceMode)
                    }
                    className="vm-studio-select"
                  >
                    {!hardware && <option value="free">Gratis</option>}
                    <option value="external">Compra en sitio externo</option>
                    {hardware && (
                      <option value="info">Ficha informativa</option>
                    )}
                  </select>
                </div>
              )}
            </div>
            {effectivePrice === "external" && (
              <div>
                <Label htmlFor={`${id}-url`}>
                  {category === "used"
                    ? "Enlace de afiliado de Mercado Libre"
                    : "Enlace de compra"}
                </Label>
                <Input
                  id={`${id}-url`}
                  type="url"
                  value={externalUrl}
                  onChange={(event) => setExternalUrl(event.target.value)}
                  placeholder={
                    category === "used" ? "https://meli.la/…" : "https://…"
                  }
                  maxLength={4096}
                />
                <p className="vm-studio-help">
                  {category === "used"
                    ? "Conservamos tu enlace completo. La compra se realiza en Mercado Libre y la ficha indica que es un enlace de afiliado."
                    : "El comprador completa la compra en ese sitio. En esta etapa no cobramos ni confirmamos pagos dentro de VISO."}
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
                  setCoverPreview(URL.createObjectURL(file));
                  setCoverRemoved(false);
                  setError(null);
                }}
              />
              <p className="vm-studio-help">
                PNG, JPG, WebP, GIF o AVIF. Hasta 60 MB.
              </p>
            </div>
            {!hardware && (
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
                  Hasta 32 archivos, de 60 MB cada uno. Los perfiles JSON
                  admiten hasta 512 KB. Subí contenido propio o que tengas
                  permiso para distribuir.
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
            {product?.status === "published" && (
              <p className="vm-studio-notice">
                Al guardar cambios, esta ficha vuelve a borrador. Tendrás que
                enviarla a revisión para publicarla de nuevo.
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
