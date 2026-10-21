import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Library,
  Loader2,
  PanelsTopLeft,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { marketplaceConnectionsPath } from "@/lib/marketplace-navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MarketplacePageInstall from "./page-install";
import { CATEGORY_LABELS, type MarketLibraryEntry } from "./types";

export { LibraryAsset } from "./library-asset";
import { LibraryAsset } from "./library-asset";
import { MarketplaceUseButton, ResourceUsage } from "./resource-use";

export default function MarketLibrary({
  onExplore,
}: {
  onExplore: () => void;
}) {
  const entries = useQuery(api.marketplace.library, {});
  const remove = useMutation(api.marketplace.removeFromLibrary);
  const install = useMutation(api.marketplace.installProfile);
  const update = useMutation(api.marketplace.updateLibrary);
  const [removing, setRemoving] = useState<MarketLibraryEntry | null>(null);
  const [installing, setInstalling] = useState<MarketLibraryEntry | null>(null);
  const [updating, setUpdating] = useState<MarketLibraryEntry | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const closeConfirmation = () => {
    if (busy.current) return;
    setRemoving(null);
    setInstalling(null);
    setUpdating(null);
    setError(null);
  };
  const confirm = async () => {
    if (busy.current || (!removing && !installing && !updating)) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      if (removing) {
        await remove({ productId: removing.productId });
        toast.success("Recurso quitado de tu biblioteca.");
      } else if (updating) {
        await update({ productId: updating.productId });
        toast.success(
          "Biblioteca actualizada. Tu deck y tus fondos conservan sus archivos.",
        );
      } else if (installing) {
        await install({ productId: installing.productId });
        toast.success(
          "Se agregó una página nueva al deck. Tus páginas anteriores se conservan.",
        );
      }
      setRemoving(null);
      setInstalling(null);
      setUpdating(null);
    } catch {
      setError(
        removing
          ? "No pudimos quitar el recurso. Volvé a intentarlo."
          : updating
            ? "No pudimos actualizar el recurso. Tu versión anterior se conserva; volvé a intentarlo."
            : "No pudimos agregar la página. Comprobá que haya espacio en tu deck y volvé a intentarlo.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  if (entries === undefined) {
    return (
      <div className="vm-loading" role="status">
        <Loader2 className="animate-spin" /> Cargando tu biblioteca…
      </div>
    );
  }
  if (!entries.length) {
    return (
      <div className="vm-empty" role="status">
        <Library aria-hidden="true" />
        <h2>Acá empieza tu colección.</h2>
        <p>
          Agregá un recurso gratuito y lo vas a encontrar acá, listo para usar.
        </p>
        <Button onClick={onExplore}>
          Explorar recursos <ArrowUpRight />
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="vm-library-help">
        <Check aria-hidden="true" />
        <p>
          Tus recursos se guardan con tu cuenta. Tocá Usar en un producto para
          elegir dónde aplicarlo; también estará disponible en tus otros
          dispositivos.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/deck/edit">
            Editar mis teclas <ArrowUpRight />
          </Link>
        </Button>
      </div>
      <div className="vm-library-list">
        {[...entries]
          .sort((a, b) => b.acquiredAt - a.acquiredAt)
          .map((entry, index) => (
            <details
              key={entry.productId}
              className="vm-library-entry"
              open={index === 0}
            >
              <summary>
                <span className="vm-library-entry-icon">
                  <Library aria-hidden="true" />
                </span>
                <span className="vm-library-entry-heading">
                  <span>
                    {CATEGORY_LABELS[entry.category]} · {entry.creatorName}
                  </span>
                  <h2>{entry.title}</h2>
                </span>
                <MarketplaceUseButton productId={entry.productId} />
                <ChevronDown
                  className="vm-library-chevron"
                  aria-hidden="true"
                />
              </summary>
              <div className="vm-library-entry-body">
                <ResourceUsage product={entry} />
                {entry.delivery === "page" && entry.pageTemplate && (
                  <MarketplacePageInstall
                    key={`${entry.productId}:${entry.revision ?? 1}`}
                    product={entry}
                  />
                )}
                {entry.delivery === "plugin" &&
                entry.productId === "viso-stream-deck" ? (
                  <div className="vm-library-inline-notice">
                    <p>
                      Descargá el plugin preparado con la configuración de tu
                      cuenta.
                    </p>
                    <Button asChild>
                      <Link to={marketplaceConnectionsPath()}>
                        Descargar mi plugin <ArrowUpRight />
                      </Link>
                    </Button>
                  </div>
                ) : entry.profileTemplate === "essential" ? (
                  <div className="vm-library-inline-notice">
                    <p>
                      Agregá una página con tus seis estados VISO. Las páginas
                      que ya tenés se conservan.
                    </p>
                    <Button
                      onClick={() => {
                        setError(null);
                        setInstalling(entry);
                      }}
                    >
                      <PanelsTopLeft /> Agregar página al deck
                    </Button>
                  </div>
                ) : null}
                {entry.assets.length > 0 && (
                  <div className="vm-asset-grid">
                    {entry.assets.map((asset) => (
                      <LibraryAsset
                        key={`${entry.revision ?? 1}:${asset.id}`}
                        asset={asset}
                        product={entry}
                      />
                    ))}
                  </div>
                )}
                <div className="vm-library-entry-footer">
                  {entry.updateAvailable && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setError(null);
                        setUpdating(entry);
                      }}
                      aria-label={`Actualizar ${entry.title} en mi biblioteca`}
                    >
                      <RefreshCw /> Actualizar recurso
                    </Button>
                  )}
                  {(entry.category === "icons" ||
                    entry.category === "profiles") && (
                    <Link to="/deck/edit">
                      Abrir editor del deck <ArrowUpRight />
                    </Link>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setError(null);
                      setRemoving(entry);
                    }}
                    aria-label={`Quitar ${entry.title} de mi biblioteca`}
                  >
                    <Trash2 /> Quitar de mi biblioteca
                  </Button>
                </div>
              </div>
            </details>
          ))}
      </div>

      <Dialog
        open={!!removing || !!installing || !!updating}
        onOpenChange={(open) => !open && closeConfirmation()}
      >
        <DialogContent
          className="vm-confirm-dialog"
          showCloseButton={!pending}
          onEscapeKeyDown={(event) => pending && event.preventDefault()}
          onPointerDownOutside={(event) => pending && event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {removing
                ? "¿Quitar este recurso?"
                : updating
                  ? "¿Actualizar este recurso?"
                  : "Agregar una página a tu deck"}
            </DialogTitle>
            <DialogDescription>
              {removing
                ? `Vas a quitar ${removing.title} de tu biblioteca. Las teclas que ya personalizaste conservan sus archivos.`
                : updating
                  ? `Vas a actualizar ${updating.title} en tu biblioteca${updating.latestVersion ? ` a la versión ${updating.latestVersion}` : " a la nueva versión publicada"}. Tus teclas, fondos y páginas ya instaladas se conservan. Para usar los cambios, elegí el recurso de nuevo o aplicá los ajustes de la página desde tu biblioteca.`
                  : "Se creará una página nueva con tus estados. Tus otras páginas y sus configuraciones se conservan."}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="vm-error">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={closeConfirmation}
            >
              Cancelar
            </Button>
            <Button disabled={pending} onClick={() => void confirm()}>
              {pending && <Loader2 className="animate-spin" />}
              {pending
                ? "Guardando…"
                : removing
                  ? "Quitar recurso"
                  : updating
                    ? "Actualizar mi biblioteca"
                    : "Crear página nueva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
