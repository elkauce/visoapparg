import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuthToken } from "@convex-dev/auth/react";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  marketErrorMessage,
  uploadMarketplaceFile,
  validateMarketplaceFile,
} from "@/lib/marketplace-upload";
import {
  DEFAULT_STOREFRONT,
  storeMediaSource,
  type StorefrontConfiguration,
  type StorefrontMedia,
} from "./storefront-model";
import { STORE_CATEGORIES } from "./store-categories";
import { StoreCarousel, CategoryTiles } from "./storefront-home";
import StoreMedia from "./store-media";

function cleanMedia(m: StorefrontMedia | undefined) {
  return m
    ? {
        mediaType: m.mediaType,
        ...(m.storageId ? { storageId: m.storageId } : {}),
        ...(m.builtinPath ? { builtinPath: m.builtinPath } : {}),
      }
    : undefined;
}
function editable(c: StorefrontConfiguration): StorefrontConfiguration {
  return {
    ...c,
    slides: c.slides.map((s) => ({ ...s, media: cleanMedia(s.media) })),
    categories: c.categories.map((s) => ({ ...s, media: cleanMedia(s.media) })),
    pulse: { ...c.pulse, colors: [...c.pulse.colors] },
  };
}
export default function StorefrontAdmin() {
  const remote = useQuery(api.marketplace_storefront.get, {});
  const products = useQuery(api.marketplace.list, {});
  if (remote === undefined) return <p role="status">Cargando el diseño…</p>;
  return (
    <StorefrontForm
      server={remote?.configuration ?? DEFAULT_STOREFRONT}
      serverRevision={remote?.revision ?? 0}
      products={products ?? []}
    />
  );
}
function StorefrontForm({
  server,
  serverRevision,
  products,
}: {
  server: StorefrontConfiguration;
  serverRevision: number;
  products: { id: string; title: string; status: string }[];
}) {
  const [draft, setDraft] = useState(() => editable(server));
  const [revision, setRevision] = useState(serverRevision);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const save = useMutation(api.marketplace_storefront.save);
  const token = useAuthToken();
  const lock = useRef(false);
  const previews = useRef(new Set<string>());
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const urls = previews.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);
  function update(change: Partial<StorefrontConfiguration>) {
    setDraft((c) => ({ ...c, ...change }));
    setError(null);
  }
  function slide(
    index: number,
    change: Partial<StorefrontConfiguration["slides"][number]>,
  ) {
    setDraft((c) => ({
      ...c,
      slides: c.slides.map((s, i) => (i === index ? { ...s, ...change } : s)),
    }));
  }
  function category(
    index: number,
    change: Partial<StorefrontConfiguration["categories"][number]>,
  ) {
    setDraft((c) => ({
      ...c,
      categories: c.categories.map((s, i) =>
        i === index ? { ...s, ...change } : s,
      ),
    }));
  }
  async function upload(
    file: File | undefined,
    apply: (media: StorefrontMedia) => void,
  ) {
    if (!file || lock.current) return;
    const invalid = validateMarketplaceFile(file);
    if (
      invalid ||
      (!/^image\//.test(file.type) && !/^video\/(mp4|webm)$/.test(file.type))
    ) {
      setError(invalid ?? "Elegí una imagen, GIF o video MP4/WebM.");
      return;
    }
    lock.current = true;
    setUploading(true);
    setError(null);
    try {
      const result = await uploadMarketplaceFile(file, token);
      if (result.mediaType !== "image" && result.mediaType !== "video")
        throw Error("Elegí imagen o video.");
      const objectUrl = URL.createObjectURL(file);
      previews.current.add(objectUrl);
      setPreviewUrls((p) => ({ ...p, [result.storageId]: objectUrl }));
      apply({ storageId: result.storageId, mediaType: result.mediaType });
    } catch (e) {
      setError(marketErrorMessage(e, "No pudimos subir el archivo."));
    } finally {
      lock.current = false;
      setUploading(false);
    }
  }
  function moveSlide(index: number, delta: number) {
    const rows = [...draft.slides];
    const next = index + delta;
    if (next < 0 || next >= rows.length) return;
    [rows[index], rows[next]] = [rows[next], rows[index]];
    update({ slides: rows });
  }
  function moveCategory(index: number, delta: number) {
    const rows = [...draft.categories];
    const next = index + delta;
    if (next < 0 || next >= rows.length) return;
    [rows[index], rows[next]] = [rows[next], rows[index]];
    update({ categories: rows });
  }
  async function persist() {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError(null);
    try {
      const next = await save({
        configuration: editable(draft),
        expectedRevision: revision,
      });
      setRevision(next);
      toast.success("Diseño guardado. Se actualizará en la web y en la app.");
    } catch (e) {
      setError(marketErrorMessage(e, "No pudimos guardar el diseño."));
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  function mediaPreview(media: StorefrontMedia | undefined) {
    const local = media?.storageId ? previewUrls[media.storageId] : undefined;
    return local ? (
      <VideoOrImage media={media!} source={local} />
    ) : (
      <StoreMedia
        media={
          media?.storageId
            ? ([...server.slides, ...server.categories].find(
                (x) => x.media?.storageId === media.storageId,
              )?.media ?? media)
            : media
        }
      />
    );
  }
  const previewConfig = {
    ...draft,
    slides: draft.slides.map((s) => ({
      ...s,
      media: s.media?.storageId
        ? {
            ...s.media,
            url:
              previewUrls[s.media.storageId] ??
              storeMediaSource(server.slides.find((x) => x.id === s.id)?.media),
          }
        : s.media,
    })),
    categories: draft.categories.map((c) => ({
      ...c,
      media: c.media?.storageId
        ? {
            ...c.media,
            url:
              previewUrls[c.media.storageId] ??
              storeMediaSource(
                server.categories.find((x) => x.category === c.category)?.media,
              ),
          }
        : c.media,
    })),
  };
  return (
    <section
      className="vm-store-editor"
      id="store-design"
      aria-label="Diseño del Marketplace"
    >
      <header className="vm-store-heading">
        <div>
          <h2>Diseño del Marketplace</h2>
          <p>Personalizá la portada de tu tienda.</p>
        </div>
        <div className="vm-editor-actions">
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(editable(DEFAULT_STOREFRONT));
              setError(null);
            }}
          >
            Restablecer diseño
          </Button>
          <Button variant="outline" onClick={() => setPreview((p) => !p)}>
            {preview ? "Cerrar vista previa" : "Vista previa"}
          </Button>
          <Button
            disabled={pending || uploading}
            onClick={() => void persist()}
          >
            {pending && <Loader2 className="animate-spin" />}Guardar cambios
          </Button>
        </div>
      </header>
      {serverRevision > revision && (
        <div className="vm-editor-conflict" role="status">
          <p>Hay una versión más reciente guardada desde otro dispositivo.</p>
          <Button
            variant="outline"
            onClick={() => {
              setDraft(editable(server));
              setRevision(serverRevision);
              setError(null);
            }}
          >
            <RefreshCw /> Cargar versión guardada
          </Button>
        </div>
      )}
      {error && (
        <p className="vm-error" role="alert">
          {error}
        </p>
      )}
      <fieldset disabled={pending || uploading}>
        <section className="vm-editor-card">
          <header>
            <div>
              <h3>Carrusel de destacados</h3>
              <p>Con el slide apagado se muestra el catálogo directo.</p>
            </div>
            <label className="vm-store-toggle">
              <input
                type="checkbox"
                checked={draft.showSlider}
                onChange={(e) => update({ showSlider: e.target.checked })}
              />{" "}
              Mostrar carrusel
            </label>
          </header>
          <label>
            Intervalo entre slides
            <select
              value={draft.intervalSeconds}
              onChange={(e) =>
                update({ intervalSeconds: Number(e.target.value) })
              }
            >
              {[3, 4, 5, 6, 8, 10, 15, 20, 30].map((n) => (
                <option key={n} value={n}>
                  {n} segundos
                </option>
              ))}
            </select>
          </label>
          <div className="vm-slide-editor-list">
            {draft.slides.map((s, i) => (
              <article key={s.id} className="vm-slide-editor">
                <div className="vm-editor-media">{mediaPreview(s.media)}</div>
                <div className="vm-editor-fields">
                  <label>
                    Título del slide {i + 1}
                    <input
                      value={s.title}
                      maxLength={100}
                      onChange={(e) => slide(i, { title: e.target.value })}
                    />
                  </label>
                  <label>
                    Descripción
                    <input
                      value={s.subtitle}
                      maxLength={160}
                      onChange={(e) => slide(i, { subtitle: e.target.value })}
                    />
                  </label>
                  <label>
                    Texto del botón
                    <input
                      value={s.buttonLabel}
                      maxLength={40}
                      onChange={(e) =>
                        slide(i, { buttonLabel: e.target.value })
                      }
                    />
                  </label>
                  <div className="vm-editor-target">
                    <label>
                      Destino
                      <select
                        value={s.target.kind}
                        onChange={(e) =>
                          slide(i, {
                            target: {
                              kind: e.target.value as typeof s.target.kind,
                              value:
                                e.target.value === "category"
                                  ? "icons"
                                  : e.target.value === "view"
                                    ? "videos"
                                    : "viso-living-icons",
                            },
                          })
                        }
                      >
                        <option value="product">Producto</option>
                        <option value="category">Categoría</option>
                        <option value="view">Sección</option>
                      </select>
                    </label>
                    <label>
                      {s.target.kind === "product"
                        ? "Producto publicado"
                        : "Elegir destino"}
                      {s.target.kind === "product" ? (
                        <select
                          value={s.target.value}
                          onChange={(e) =>
                            slide(i, {
                              target: { ...s.target, value: e.target.value },
                            })
                          }
                        >
                          {!products.some((p) => p.id === s.target.value) && (
                            <option value={s.target.value}>
                              {s.target.value || "Elegir producto"}
                            </option>
                          )}
                          {products
                            .filter((p) => p.status === "published")
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.title}
                              </option>
                            ))}
                        </select>
                      ) : (
                        <select
                          value={s.target.value}
                          onChange={(e) =>
                            slide(i, {
                              target: { ...s.target, value: e.target.value },
                            })
                          }
                        >
                          {s.target.kind === "category"
                            ? STORE_CATEGORIES.filter(
                                (x) => x.id !== "discover",
                              ).map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.label}
                                </option>
                              ))
                            : [
                                ["discover", "Tienda"],
                                ["videos", "Videos"],
                                ["library", "Biblioteca"],
                                ["creators", "Creadores"],
                              ].map(([id, label]) => (
                                <option key={id} value={id}>
                                  {label}
                                </option>
                              ))}
                        </select>
                      )}
                    </label>
                  </div>
                  <div className="vm-editor-actions">
                    <label className="vm-upload-label">
                      <Upload /> Imagen o video
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/webm"
                        aria-label={`Archivo del slide ${i + 1}`}
                        onChange={(e) => {
                          void upload(e.target.files?.[0], (m) =>
                            slide(i, { media: m }),
                          );
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      aria-label={`Subir slide ${i + 1}`}
                      disabled={i === 0}
                      onClick={() => moveSlide(i, -1)}
                    >
                      <ArrowUp />
                    </button>
                    <button
                      type="button"
                      aria-label={`Bajar slide ${i + 1}`}
                      disabled={i === draft.slides.length - 1}
                      onClick={() => moveSlide(i, 1)}
                    >
                      <ArrowDown />
                    </button>
                    <button
                      type="button"
                      aria-label={`Eliminar slide ${i + 1}`}
                      onClick={() =>
                        update({
                          slides: draft.slides.filter((_, x) => x !== i),
                        })
                      }
                    >
                      <Trash2 />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <Button
            variant="outline"
            disabled={draft.slides.length >= 8}
            onClick={() =>
              update({
                slides: [
                  ...draft.slides,
                  {
                    id: crypto.randomUUID(),
                    title: "Nuevo destacado",
                    subtitle: "",
                    buttonLabel: "Descubrir",
                    target: { kind: "category", value: "icons" },
                  },
                ],
              })
            }
          >
            <Plus /> Agregar slide
          </Button>
        </section>
        <section className="vm-editor-card">
          <header>
            <div>
              <h3>Accesos de categorías</h3>
              <p>
                Elegí imágenes, GIF o videos. El nombre puede mostrarse u
                ocultarse.
              </p>
            </div>
          </header>
          <div className="vm-category-editor-list">
            {draft.categories.map((c, i) => (
              <article key={c.category} className="vm-category-editor">
                <div className="vm-editor-media">{mediaPreview(c.media)}</div>
                <label>
                  Nombre
                  <input
                    value={c.label}
                    maxLength={40}
                    onChange={(e) => category(i, { label: e.target.value })}
                  />
                </label>
                <label className="vm-upload-label">
                  <Upload /> Imagen · GIF · Video
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/webm"
                    aria-label={`Archivo de ${c.label}`}
                    onChange={(e) => {
                      void upload(e.target.files?.[0], (m) =>
                        category(i, { media: m }),
                      );
                      e.target.value = "";
                    }}
                  />
                </label>
                <label className="vm-store-toggle">
                  <input
                    type="checkbox"
                    checked={c.showName}
                    onChange={(e) =>
                      category(i, { showName: e.target.checked })
                    }
                  />{" "}
                  Mostrar nombre
                </label>
                <label className="vm-store-toggle">
                  <input
                    type="checkbox"
                    checked={c.visible}
                    onChange={(e) => category(i, { visible: e.target.checked })}
                  />{" "}
                  Visible
                </label>
                <button
                  type="button"
                  aria-label={`Subir categoría ${c.label}`}
                  disabled={i === 0}
                  onClick={() => moveCategory(i, -1)}
                >
                  <ArrowUp />
                </button>
                <button
                  type="button"
                  aria-label={`Bajar categoría ${c.label}`}
                  disabled={i === draft.categories.length - 1}
                  onClick={() => moveCategory(i, 1)}
                >
                  <ArrowDown />
                </button>
                {c.media && (
                  <button
                    type="button"
                    aria-label={`Quitar archivo de ${c.label}`}
                    onClick={() => category(i, { media: undefined })}
                  >
                    <Trash2 />
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
        <section className="vm-editor-card">
          <header>
            <div>
              <h3>Cabecera con latido</h3>
              <p>Un halo suave que recorre los colores que elijas.</p>
            </div>
            <label className="vm-store-toggle">
              <input
                type="checkbox"
                checked={draft.pulse.enabled}
                onChange={(e) =>
                  update({
                    pulse: { ...draft.pulse, enabled: e.target.checked },
                  })
                }
              />{" "}
              Activar latido
            </label>
          </header>
          <div className="vm-editor-colors">
            {draft.pulse.colors.map((color, i) => (
              <label key={i}>
                Color {i + 1}
                <input
                  type="color"
                  value={color}
                  onChange={(e) =>
                    update({
                      pulse: {
                        ...draft.pulse,
                        colors: draft.pulse.colors.map((c, x) =>
                          x === i ? e.target.value : c,
                        ),
                      },
                    })
                  }
                />
              </label>
            ))}
            <Button
              variant="outline"
              disabled={draft.pulse.colors.length >= 8}
              onClick={() =>
                update({
                  pulse: {
                    ...draft.pulse,
                    colors: [...draft.pulse.colors, "#f97316"],
                  },
                })
              }
            >
              Agregar color
            </Button>
            <Button
              variant="outline"
              disabled={draft.pulse.colors.length <= 2}
              onClick={() =>
                update({
                  pulse: {
                    ...draft.pulse,
                    colors: draft.pulse.colors.slice(0, -1),
                  },
                })
              }
            >
              Quitar último color
            </Button>
            <label>
              Velocidad
              <select
                value={draft.pulse.speed}
                onChange={(e) =>
                  update({
                    pulse: {
                      ...draft.pulse,
                      speed: e.target.value as typeof draft.pulse.speed,
                    },
                  })
                }
              >
                <option value="slow">Suave</option>
                <option value="normal">Normal</option>
                <option value="fast">Rápida</option>
              </select>
            </label>
          </div>
        </section>
      </fieldset>
      {uploading && <p role="status">Subiendo archivo…</p>}
      {preview && (
        <aside
          className="vm-editor-preview"
          aria-label="Vista previa del Marketplace"
          onClickCapture={(event) => {
            if ((event.target as Element).closest("a")) event.preventDefault();
          }}
        >
          <h3>Vista previa de la portada</h3>
          <StoreCarousel configuration={previewConfig} />
          <CategoryTiles configuration={previewConfig} />
          {!draft.showSlider && (
            <p>
              Catálogo directo: los productos aparecen después de los accesos de
              categorías.
            </p>
          )}
        </aside>
      )}
    </section>
  );
}
function VideoOrImage({
  media,
  source,
}: {
  media: StorefrontMedia;
  source: string;
}) {
  return media.mediaType === "video" ? (
    <video src={source} muted controls playsInline />
  ) : (
    <img src={source} alt="Vista previa del archivo" />
  );
}
