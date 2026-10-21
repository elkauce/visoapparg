import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import {
  LayoutGrid,
  Plug,
  UserRound,
  Power,
  Download,
  ImagePlus,
  QrCode,
  ExternalLink,
  Copy,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { SignInButton } from "@/components/ui/signin";
import GoogleAccountSettings from "@/components/google-account-settings";
import { VisoBrand } from "@/components/viso-brand";
import StatusScreen from "@/components/status-screen";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import Deck from "./deck";
import SharePanel from "./share-panel";
import AndroidDownloadPanel, {
  ANDROID_APK_URL,
} from "./android-download-panel";
import StreamDeckPanel from "./stream-deck-panel";
import LightSync from "./light-sync";
import PanelLayout, { type PanelSection } from "./panel-layout";

export default function ControlPanel() {
  const [params, setParams] = useSearchParams();
  const section = params.get("section");
  const tab: Exclude<PanelSection, "marketplace"> =
    section === "display" || section === "connections" || section === "account"
      ? section
      : "states";
  const title =
    tab === "states"
      ? "Panel"
      : tab === "display"
        ? "Display"
        : tab === "connections"
          ? "Conexiones"
          : "Cuenta";
  const [googlePending, setGooglePending] = useState(false);
  const [androidOpen, setAndroidOpen] = useState(false);
  const data = useQuery(api.statuses.list, {});
  const user = useQuery(api.users.getCurrentUser, {});
  const slug = useQuery(api.public_status.getMine, {});
  const setActive = useMutation(api.statuses.setActive);
  const active =
    data?.statuses.find((status) => status._id === data.activeStatusId) ?? null;
  const displayUrl = slug ? `/s/${slug}` : undefined;
  const selectTab = (next: Exclude<PanelSection, "marketplace">) =>
    setParams(
      (previous) => {
        const nextParams = new URLSearchParams(previous);
        if (next === "states") nextParams.delete("section");
        else nextParams.set("section", next);
        return nextParams;
      },
      { replace: true },
    );
  const copyDisplay = async () => {
    if (!displayUrl) return;
    try {
      await navigator.clipboard.writeText(
        new URL(displayUrl, window.location.origin).href,
      );
      toast.success("Link copiado");
    } catch {
      toast.error("No se pudo copiar el link");
    }
  };

  return (
    <PanelLayout section={tab}>
      <header className="viso-panel-header">
        <div>
          <VisoBrand className="viso-panel-mobile-brand" />
          <h1>{title}</h1>
          <p>Tu espacio, conectado.</p>
        </div>
        <div className="viso-panel-header-actions">
          <Button asChild>
            <Link to="/deck">
              <LayoutGrid />
              Abrir deck
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="viso-panel-account"
            aria-label="Abrir mi cuenta"
            onClick={() => selectTab("account")}
          >
            <UserRound />
          </Button>
        </div>
      </header>
      <div className="viso-panel-statusbar" aria-live="polite">
        <div className="viso-panel-status-text">
          <span
            className="viso-panel-status-dot"
            style={{
              backgroundColor: active?.color ?? "#8b8e93",
              boxShadow: active ? `0 0 14px ${active.color}66` : undefined,
            }}
          />
          <span>
            Estado actual: <strong>{active?.name ?? "Sin estado"}</strong>
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={!active}
          onClick={() => {
            void setActive({ statusId: null }).catch(() =>
              toast.error("No se pudo apagar el estado"),
            );
          }}
        >
          <Power />
          Apagar
        </Button>
      </div>
      <main
        className={`viso-panel-workspace${tab === "states" ? "" : " viso-panel-workspace-single"}`}
      >
        <section
          className="viso-panel-primary"
          aria-label="Configuración del panel"
        >
          <div
            id="viso-panel-states"
            role="region"
            aria-label="Estados del deck"
            className="viso-panel-section-content"
            hidden={tab !== "states"}
          >
            <Deck compact />
          </div>
          <div
            id="viso-panel-display"
            role="region"
            aria-label="Configuración del Display"
            className="viso-panel-section-content"
            hidden={tab !== "display"}
          >
            <SharePanel />
          </div>
          <div
            id="viso-panel-connections"
            role="region"
            aria-label="Conexiones del panel"
            className="viso-panel-section-content"
            hidden={tab !== "connections"}
          >
            <StreamDeckPanel />
            <AndroidDownloadPanel />
          </div>
          <section
            role="region"
            aria-label="Tu cuenta VISO"
            className="viso-panel-section-content viso-panel-account-content"
            hidden={tab !== "account"}
          >
            <h2>Tu cuenta VISO</h2>
            <p>Tu deck y tus dispositivos están vinculados a esta cuenta.</p>
            <p className="break-all text-sm">{user?.email}</p>
            <GoogleAccountSettings onPendingChange={setGooglePending} />
            <SignInButton
              variant="secondary"
              signOutText="Cerrar sesión"
              disabled={googlePending}
            />
          </section>
        </section>
        {tab === "states" && (
          <aside className="viso-panel-quick" aria-label="Accesos rápidos">
            <h2>Accesos rápidos</h2>
            <section className="viso-panel-quick-card">
              <h3>Display</h3>
              <div className="viso-panel-preview">
                <StatusScreen face={active} />
              </div>
              <div className="viso-panel-quick-actions">
                {displayUrl ? (
                  <Button asChild>
                    <a href={displayUrl} target="_blank" rel="noreferrer">
                      <ExternalLink />
                      Abrir display
                    </a>
                  </Button>
                ) : (
                  <Button disabled>Preparando display…</Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => selectTab("display")}
                >
                  <ImagePlus />
                  Imagen o video
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void copyDisplay()}
                  disabled={!displayUrl}
                >
                  <Copy />
                  Copiar link
                </Button>
              </div>
            </section>
            <section className="viso-panel-quick-card">
              <h3>Stream Deck de Elgato</h3>
              <button
                className="viso-panel-quick-row"
                onClick={() => selectTab("connections")}
              >
                <Plug />
                <span className="viso-panel-quick-row-copy">
                  <strong>Conexión y plugin</strong>
                  <small>Usá tus teclas físicas</small>
                </span>
                <ChevronRight />
              </button>
            </section>
            <section className="viso-panel-quick-card">
              <h3>App Android</h3>
              <div className="viso-panel-quick-actions">
                <Button asChild size="sm">
                  <a href={ANDROID_APK_URL}>
                    <Download />
                    Descargar APK
                  </a>
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Mostrar QR de la APK"
                  onClick={() => setAndroidOpen(true)}
                >
                  <QrCode />
                </Button>
              </div>
            </section>
          </aside>
        )}
      </main>
      <Dialog open={androidOpen} onOpenChange={setAndroidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>VISO para Android</DialogTitle>
            <DialogDescription>
              Escaneá el QR para descargar la app en tu celular.
            </DialogDescription>
          </DialogHeader>
          <AndroidDownloadPanel />
        </DialogContent>
      </Dialog>
      <LightSync />
    </PanelLayout>
  );
}
