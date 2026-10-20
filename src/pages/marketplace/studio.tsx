import { useId, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  BadgeCheck,
  Clock3,
  FilePlus2,
  Loader2,
  Palette,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { marketErrorMessage } from "@/lib/marketplace-upload";
import ProductForm, { type EditableMarketProduct } from "./product-form";
import "./studio.css";

const STATUS_NAMES: Record<string, string> = {
  draft: "Borrador",
  pending: "En revisión",
  approved: "Aprobado",
  published: "Publicado",
  rejected: "Cambios solicitados",
  archived: "Archivado",
};

function CreatorProfile({
  profile,
}: {
  profile: Doc<"creatorProfiles"> | null;
}) {
  const id = useId();
  const save = useMutation(api.marketplace.saveCreator);
  const submit = useMutation(api.marketplace.submitCreator);
  const [name, setName] = useState(profile?.displayName ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [website, setWebsite] = useState(profile?.website ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  async function saveProfile(requestReview: boolean) {
    if (pending.current) return;
    setError(null);
    if (!name.trim() || !bio.trim()) {
      setError("Completá tu nombre de creador y una presentación.");
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      await save({
        displayName: name.trim(),
        bio: bio.trim(),
        ...(website.trim() ? { website: website.trim() } : {}),
      });
      if (requestReview) await submit({});
      toast.success(
        requestReview
          ? "Recibimos tu solicitud. Te avisaremos acá cuando sea revisada."
          : "Perfil guardado.",
      );
    } catch (problem) {
      setError(
        marketErrorMessage(
          problem,
          "No pudimos guardar tu perfil. Intentá nuevamente.",
        ),
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="vm-studio-card">
      <div className="vm-studio-section-heading">
        <div>
          <h3>Tu perfil de creador</h3>
          <p>Presentá tu trabajo y solicitá un espacio en VISO.</p>
        </div>
        {profile && (
          <span
            className={`vm-studio-status vm-studio-status-${profile.status}`}
          >
            {STATUS_NAMES[profile.status]}
          </span>
        )}
      </div>
      {profile?.reviewReason && (
        <p className="vm-studio-notice">
          Revisión de VISO: {profile.reviewReason}
        </p>
      )}
      <form
        noValidate
        className="vm-studio-form"
        onSubmit={(event) => {
          event.preventDefault();
          void saveProfile(false);
        }}
      >
        <fieldset disabled={busy} className="vm-studio-fields">
          <div>
            <Label htmlFor={`${id}-name`}>Nombre de creador o marca</Label>
            <Input
              id={`${id}-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={70}
              autoComplete="organization"
              placeholder="Cómo querés aparecer en el marketplace"
            />
          </div>
          <div>
            <Label htmlFor={`${id}-bio`}>Presentación</Label>
            <Textarea
              id={`${id}-bio`}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={1200}
              rows={3}
              placeholder="Contanos qué creás y qué te gustaría compartir."
            />
          </div>
          <div>
            <Label htmlFor={`${id}-site`}>
              Sitio web <span className="vm-studio-optional">Opcional</span>
            </Label>
            <Input
              id={`${id}-site`}
              type="url"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder="https://…"
              maxLength={4096}
            />
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="vm-studio-error">
            {error}
          </p>
        )}
        <div className="vm-studio-actions">
          <Button type="submit" variant="outline" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}Guardar perfil
          </Button>
          {profile?.status !== "approved" && (
            <Button
              type="button"
              disabled={busy}
              onClick={() => void saveProfile(true)}
            >
              <Send />
              {profile?.status === "pending"
                ? "Actualizar solicitud"
                : "Solicitar aprobación"}
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}

export default function MarketplaceStudio() {
  const session = useQuery(api.marketplace.session, {});
  const products = useQuery(api.marketplace.mine, {});
  const submitProduct = useMutation(api.marketplace.submitProduct);
  const [editor, setEditor] = useState<EditableMarketProduct | "new" | null>(
    null,
  );
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!session || !products)
    return (
      <p role="status" className="vm-studio-loading">
        Preparando tu espacio…
      </p>
    );
  const canPublish = session.isAdmin || session.creator?.status === "approved";
  async function send(productId: string) {
    if (sending) return;
    setSending(productId);
    setError(null);
    try {
      await submitProduct({ productId });
      toast.success("Producto enviado a revisión.");
    } catch (problem) {
      setError(marketErrorMessage(problem, "No pudimos enviar este producto."));
    } finally {
      setSending(null);
    }
  }
  return (
    <div className="vm-studio">
      <header className="vm-studio-heading">
        <div className="vm-studio-eyebrow">
          <Palette aria-hidden="true" />
          Espacio creador
        </div>
        <h2>Creá para otros espacios.</h2>
        <p>Compartí tus diseños, recursos y productos con la comunidad VISO.</p>
      </header>
      <CreatorProfile profile={session.creator} />
      {!canPublish && (
        <div className="vm-studio-step">
          <Clock3 aria-hidden="true" />
          <div>
            <h3>
              {session.creator?.status === "pending"
                ? "Tu solicitud está en revisión"
                : "El primer paso es tu perfil"}
            </h3>
            <p>
              Cuando VISO apruebe tu perfil, podrás crear fichas, subir archivos
              y enviar productos para publicar.
            </p>
          </div>
        </div>
      )}
      {canPublish && (
        <section className="vm-studio-card">
          <div className="vm-studio-section-heading">
            <div>
              <h3>Tus productos</h3>
              <p>
                Los borradores son privados. Cada producto se publica después de
                su revisión.
              </p>
            </div>
            <Button onClick={() => setEditor("new")}>
              <FilePlus2 />
              Nuevo producto
            </Button>
          </div>
          {error && (
            <p role="alert" className="vm-studio-error">
              {error}
            </p>
          )}
          {!products.length ? (
            <div className="vm-studio-empty">
              <Palette aria-hidden="true" />
              <h4>Tu primera creación empieza acá</h4>
              <p>
                Podés ofrecer iconos, videos, sonidos, perfiles, plugins y
                hardware.
              </p>
            </div>
          ) : (
            <div className="vm-studio-product-list">
              {products.map((product) => (
                <article key={product.id} className="vm-studio-product">
                  {product.coverUrl ? (
                    <img
                      src={product.coverUrl}
                      alt=""
                      className="vm-studio-product-cover"
                    />
                  ) : (
                    <div className="vm-studio-product-cover vm-studio-product-placeholder">
                      <Palette aria-hidden="true" />
                    </div>
                  )}
                  <div className="vm-studio-product-copy">
                    <span
                      className={`vm-studio-status vm-studio-status-${product.status}`}
                    >
                      {STATUS_NAMES[product.status] ?? product.status}
                    </span>
                    <h4>{product.title}</h4>
                    <p>
                      {product.assetCount}{" "}
                      {product.assetCount === 1 ? "archivo" : "archivos"}
                    </p>
                    {product.reviewReason && (
                      <p className="vm-studio-feedback">
                        Revisión: {product.reviewReason}
                      </p>
                    )}
                  </div>
                  <div className="vm-studio-product-actions">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditor(product)}
                    >
                      Editar
                    </Button>
                    {product.status !== "published" &&
                      product.status !== "pending" && (
                        <Button
                          size="sm"
                          disabled={sending !== null}
                          onClick={() => void send(product.id)}
                        >
                          {sending === product.id ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <Send />
                          )}
                          Enviar a revisión
                        </Button>
                      )}
                    {product.status === "published" && (
                      <span className="vm-studio-published">
                        <BadgeCheck aria-hidden="true" />
                        Visible en el marketplace
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      <p className="vm-studio-footer-note">
        Empezamos con recursos gratuitos y compras en los sitios de los
        vendedores. Los cobros dentro de VISO se incorporarán en una próxima
        etapa.
      </p>
      {editor && (
        <ProductForm
          key={editor === "new" ? "new" : editor.id}
          product={editor === "new" ? null : editor}
          isAdmin={session.isAdmin}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
