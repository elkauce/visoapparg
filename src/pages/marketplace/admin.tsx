import { useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import {
  Archive,
  Check,
  CheckCheck,
  ExternalLink,
  FilePlus2,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { marketErrorMessage } from "@/lib/marketplace-upload";
import ProductForm, { type EditableMarketProduct } from "./product-form";
import MarketplacePaymentSettings from "./payment-settings";
import "./studio.css";

type Review =
  | {
      kind: "creator";
      id: Id<"creatorProfiles">;
      title: string;
      decision: "approved" | "rejected";
      wasApproved?: boolean;
    }
  | {
      kind: "product";
      id: string;
      title: string;
      decision: "approved" | "rejected" | "archived";
    };
const STATUS_NAMES: Record<string, string> = {
  draft: "Borrador",
  pending: "En revisión",
  approved: "Aprobado",
  published: "Publicado",
  rejected: "Cambios solicitados",
  archived: "Archivado",
};
const CATEGORY_NAMES: Record<string, string> = {
  icons: "Iconos",
  plugins: "Plugins",
  profiles: "Perfiles",
  screensavers: "Protectores",
  soundboards: "Sonidos",
  hardware: "Hardware",
  used: "Usados",
  new: "Nuevo",
  pages: "Página",
};

function ReviewDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: Review;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void>;
}) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const rejecting = target.decision === "rejected";
  const label =
    target.decision === "approved"
      ? "Aprobar"
      : target.decision === "archived"
        ? "Archivar"
        : target.kind === "creator" && target.wasApproved
          ? "Retirar aprobación"
          : "Pedir cambios";
  async function confirm() {
    if (pending.current) return;
    if (rejecting && !reason.trim()) {
      setError("Explicá el motivo para que el creador pueda corregirlo.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim() || undefined);
    } catch (problem) {
      setError(
        marketErrorMessage(
          problem,
          "No pudimos completar la revisión. Intentá nuevamente.",
        ),
      );
    } finally {
      pending.current = false;
      setBusy(false);
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
        className="vm-studio-dialog vm-admin-review-dialog"
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
            {label}: {target.title}
          </DialogTitle>
          <DialogDescription>
            {target.decision === "approved"
              ? target.kind === "creator"
                ? "Este creador podrá preparar productos y enviarlos a revisión."
                : "La ficha y sus archivos se mostrarán en el marketplace."
              : target.kind === "creator" && target.wasApproved
                ? "Sus productos publicados y pendientes se archivarán. El creador verá el motivo en su espacio."
                : target.decision === "archived"
                  ? "La ficha dejará de aparecer en el catálogo. Los recursos ya agregados a bibliotecas se conservarán."
                  : "El creador verá tu comentario y podrá enviar una versión corregida."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="vm-studio-form"
          onSubmit={(event) => {
            event.preventDefault();
            void confirm();
          }}
        >
          {target.decision !== "approved" && (
            <div>
              <Label htmlFor={id}>Motivo {rejecting ? "" : "(opcional)"}</Label>
              <Textarea
                id={id}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={4}
                maxLength={1200}
                disabled={busy}
                placeholder="Indicá qué debería revisar o corregir."
              />
            </div>
          )}
          {error && (
            <p role="alert" className="vm-studio-error">
              {error}
            </p>
          )}
          <div className="vm-studio-dialog-actions">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {label}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdminWorkspace() {
  const queues = useQuery(api.marketplace.queues, {});
  const products = useQuery(api.marketplace.adminProducts, {});
  const creators = useQuery(api.marketplace.adminCreators, {});
  const reviewCreator = useMutation(api.marketplace.reviewCreator);
  const reviewProduct = useMutation(api.marketplace.reviewProduct);
  const [review, setReview] = useState<Review | null>(null);
  const [editor, setEditor] = useState<
    EditableMarketProduct | "new-used" | "new" | null
  >(null);
  const [filter, setFilter] = useState("all");
  if (!queues || !products || !creators)
    return (
      <p role="status" className="vm-studio-loading">
        Cargando las publicaciones y solicitudes…
      </p>
    );
  const filteredProducts = products.filter(
    (product) => filter === "all" || product.status === filter,
  );
  async function confirmReview(reason?: string) {
    if (!review) return;
    if (review.kind === "creator")
      await reviewCreator({
        creatorId: review.id,
        decision: review.decision,
        ...(reason ? { reason } : {}),
      });
    else
      await reviewProduct({
        productId: review.id,
        decision: review.decision,
        ...(reason ? { reason } : {}),
      });
    toast.success(
      review.decision === "approved"
        ? "Aprobado."
        : review.decision === "archived"
          ? "Producto archivado."
          : "Revisión enviada al creador.",
    );
    setReview(null);
  }
  return (
    <div className="vm-studio vm-admin">
      <header className="vm-studio-heading">
        <div className="vm-studio-eyebrow">
          <ShieldCheck aria-hidden="true" />
          Administración
        </div>
        <h2>Un catálogo cuidado.</h2>
        <p>
          Revisá las creaciones de la comunidad y administrá los productos
          publicados por VISO.
        </p>
      </header>
      <MarketplacePaymentSettings />
      <div className="vm-admin-summary">
        <div>
          <strong>{queues.creators.length}</strong>
          <span>Solicitudes de creadores</span>
        </div>
        <div>
          <strong>{queues.products.length}</strong>
          <span>Productos por revisar</span>
        </div>
        <div>
          <strong>
            {
              products.filter((product) => product.status === "published")
                .length
            }
          </strong>
          <span>Publicaciones aprobadas</span>
        </div>
      </div>
      <section className="vm-studio-card">
        <div className="vm-studio-section-heading">
          <div>
            <h3>Creadores por revisar</h3>
            <p>
              Su aprobación habilita el envío de productos, no su publicación
              automática.
            </p>
          </div>
        </div>
        {!queues.creators.length ? (
          <p className="vm-admin-clear">
            <CheckCheck aria-hidden="true" />
            No hay solicitudes pendientes.
          </p>
        ) : (
          <div className="vm-admin-review-list">
            {queues.creators.map((creator) => (
              <article className="vm-admin-review-card" key={creator._id}>
                <div>
                  <h4>{creator.displayName}</h4>
                  <p>{creator.bio}</p>
                  {creator.website && (
                    <a
                      href={creator.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="vm-admin-link"
                    >
                      Visitar sitio
                      <ExternalLink aria-hidden="true" />
                    </a>
                  )}
                </div>
                <div className="vm-studio-actions">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setReview({
                        kind: "creator",
                        id: creator._id,
                        title: creator.displayName,
                        decision: "rejected",
                      })
                    }
                  >
                    <X />
                    Pedir cambios
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      setReview({
                        kind: "creator",
                        id: creator._id,
                        title: creator.displayName,
                        decision: "approved",
                      })
                    }
                  >
                    <Check />
                    Aprobar creador
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="vm-studio-card">
        <div className="vm-studio-section-heading">
          <div>
            <h3>Productos por revisar</h3>
            <p>
              Comprobá la ficha, los enlaces y los archivos antes de aprobarlos.
            </p>
          </div>
        </div>
        {!queues.products.length ? (
          <p className="vm-admin-clear">
            <CheckCheck aria-hidden="true" />
            No hay productos pendientes.
          </p>
        ) : (
          <div className="vm-admin-review-list">
            {queues.products.map((product) => (
              <article className="vm-admin-review-card" key={product.id}>
                <div className="vm-admin-product-preview">
                  {product.coverUrl && <img src={product.coverUrl} alt="" />}
                  <div>
                    <span className="vm-studio-status vm-studio-status-pending">
                      {CATEGORY_NAMES[product.category]}
                    </span>
                    <h4>{product.title}</h4>
                    <p>Por {product.creatorName}</p>
                  </div>
                </div>
                <p>{product.description}</p>
                {product.externalUrl && (
                  <a
                    href={product.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow sponsored"
                    className="vm-admin-link"
                  >
                    {product.affiliate
                      ? "Revisar enlace de afiliado"
                      : "Revisar enlace de compra"}
                    <ExternalLink aria-hidden="true" />
                  </a>
                )}
                {product.assets.length > 0 && (
                  <details className="vm-admin-files">
                    <summary>Revisar {product.assets.length} archivos</summary>
                    <ul>
                      {product.assets.map((asset) => (
                        <li key={asset.id}>
                          {asset.url ? (
                            <a
                              href={asset.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {asset.name}
                              <ExternalLink aria-hidden="true" />
                            </a>
                          ) : (
                            asset.name
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <div className="vm-studio-actions">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setReview({
                        kind: "product",
                        id: product.id,
                        title: product.title,
                        decision: "rejected",
                      })
                    }
                  >
                    <X />
                    Pedir cambios
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      setReview({
                        kind: "product",
                        id: product.id,
                        title: product.title,
                        decision: "approved",
                      })
                    }
                  >
                    <Check />
                    Aprobar producto
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="vm-studio-card">
        <div className="vm-studio-section-heading">
          <div>
            <h3>Publicaciones</h3>
            <p>
              Los usados se publican desde VISO con el enlace de afiliado
              original.
            </p>
          </div>
          <div className="vm-studio-actions">
            <Button variant="outline" onClick={() => setEditor("new")}>
              <FilePlus2 /> Nuevo producto
            </Button>
            <Button onClick={() => setEditor("new-used")}>
              <FilePlus2 />
              Nuevo usado
            </Button>
          </div>
        </div>
        <label className="vm-admin-filter">
          Mostrar
          <select
            className="vm-studio-select"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="published">Publicados</option>
            <option value="pending">En revisión</option>
            <option value="draft">Borradores</option>
            <option value="rejected">Con cambios solicitados</option>
            <option value="archived">Archivados</option>
          </select>
        </label>
        {!filteredProducts.length ? (
          <p className="vm-studio-help">
            No hay publicaciones para este filtro.
          </p>
        ) : (
          <div className="vm-studio-product-list">
            {filteredProducts.map((product) => (
              <article className="vm-studio-product" key={product.id}>
                {product.coverUrl && (
                  <img
                    src={product.coverUrl}
                    alt=""
                    className="vm-studio-product-cover"
                  />
                )}
                <div className="vm-studio-product-copy">
                  <span
                    className={`vm-studio-status vm-studio-status-${product.status}`}
                  >
                    {STATUS_NAMES[product.status]}
                  </span>
                  <h4>{product.title}</h4>
                  <p>
                    {product.creatorName} · {CATEGORY_NAMES[product.category]}
                  </p>
                  {product.affiliate && (
                    <span className="vm-admin-affiliate">
                      Enlace de afiliado
                    </span>
                  )}
                </div>
                <div className="vm-studio-product-actions">
                  <Button asChild size="sm" variant="ghost">
                    <Link
                      to={`/marketplace/products/${encodeURIComponent(product.id)}`}
                    >
                      Ver ficha
                    </Link>
                  </Button>
                  {product.canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditor(product)}
                    >
                      Editar ficha
                    </Button>
                  )}
                  {product.status !== "archived" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setReview({
                          kind: "product",
                          id: product.id,
                          title: product.title,
                          decision: "archived",
                        })
                      }
                    >
                      <Archive />
                      Archivar
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="vm-studio-card">
        <div className="vm-studio-section-heading">
          <div>
            <h3>Creadores aprobados</h3>
            <p>
              Retirar una aprobación también archiva sus productos publicados.
            </p>
          </div>
        </div>
        {!creators.some((creator) => creator.status === "approved") ? (
          <p className="vm-studio-help">Todavía no hay creadores aprobados.</p>
        ) : (
          <div className="vm-admin-creator-list">
            {creators
              .filter((creator) => creator.status === "approved")
              .map((creator) => (
                <article key={creator._id}>
                  <div>
                    <h4>{creator.displayName}</h4>
                    <span className="vm-studio-status vm-studio-status-approved">
                      Aprobado
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setReview({
                        kind: "creator",
                        id: creator._id,
                        title: creator.displayName,
                        decision: "rejected",
                        wasApproved: true,
                      })
                    }
                  >
                    Retirar aprobación
                  </Button>
                </article>
              ))}
          </div>
        )}
      </section>
      {review && (
        <ReviewDialog
          key={`${review.kind}-${review.id}-${review.decision}`}
          target={review}
          onClose={() => setReview(null)}
          onConfirm={confirmReview}
        />
      )}
      {editor && (
        <ProductForm
          key={typeof editor === "string" ? editor : editor.id}
          product={typeof editor === "string" ? null : editor}
          initialCategory={editor === "new-used" ? "used" : "icons"}
          isAdmin
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}

export default function MarketplaceAdmin() {
  const session = useQuery(api.marketplace.session, {});
  if (!session)
    return (
      <p role="status" className="vm-studio-loading">
        Comprobando tu acceso…
      </p>
    );
  if (!session.isAdmin)
    return (
      <section className="vm-studio-card">
        <h2>Administración de VISO</h2>
        <p>
          Esta sección está disponible para los administradores del marketplace.
        </p>
      </section>
    );
  return <AdminWorkspace />;
}
