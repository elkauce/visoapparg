import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import {
  Home,
  LayoutGrid,
  Monitor,
  Plug,
  Settings2,
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
import "./panel.css";

const TABS = [
  { id: "states", label: "Estados", icon: LayoutGrid },
  { id: "display", label: "Display", icon: Monitor },
  { id: "connections", label: "Conexiones", icon: Plug },
] as const;
type PanelTab = (typeof TABS)[number]["id"];

export default function ControlPanel() {
  const [tab, setTab] = useState<PanelTab>("states");
  const [accountOpen, setAccountOpen] = useState(false);
  const [androidOpen, setAndroidOpen] = useState(false);
  const data = useQuery(api.statuses.list, {});
  const user = useQuery(api.users.getCurrentUser, {});
  const slug = useQuery(api.public_status.getMine, {});
  const setActive = useMutation(api.statuses.setActive);
  const active =
    data?.statuses.find((status) => status._id === data.activeStatusId) ?? null;
  const displayUrl = slug ? `/s/${slug}` : undefined;
  const selectTab = (next: PanelTab) => setTab(next);
  const tabKey = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % TABS.length
        : event.key === "ArrowLeft"
          ? (index + TABS.length - 1) % TABS.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? TABS.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    setTab(TABS[next].id);
    document.getElementById(`viso-tab-${TABS[next].id}`)?.focus();
  };
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
    <div className="viso-control-panel min-h-screen">
      <aside className="viso-panel-rail" aria-label="Panel VISO">
        <VisoBrand className="viso-panel-brand" />
        <nav className="viso-panel-rail-nav" aria-label="Secciones del panel">
          <button
            aria-current={tab === "states" ? "page" : undefined}
            onClick={() => selectTab("states")}
          >
            <Home />
            <span>Panel</span>
          </button>
          <button
            aria-current={tab === "display" ? "page" : undefined}
            onClick={() => selectTab("display")}
          >
            <Monitor />
            <span>Display</span>
          </button>
          <button
            aria-current={tab === "connections" ? "page" : undefined}
            onClick={() => selectTab("connections")}
          >
            <Plug />
            <span>Conexiones</span>
          </button>
          <button onClick={() => setAccountOpen(true)}>
            <Settings2 />
            <span>Cuenta</span>
          </button>
        </nav>
      </aside>
      <div className="viso-panel-shell">
        <header className="viso-panel-header">
          <div>
            <VisoBrand className="viso-panel-mobile-brand" />
            <h1>Panel</h1>
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
              onClick={() => setAccountOpen(true)}
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
        <main className="viso-panel-workspace">
          <section
            className="viso-panel-primary"
            aria-label="Configuración del panel"
          >
            <div
              className="viso-panel-tabs"
              role="tablist"
              aria-label="Sección del panel"
            >
              {TABS.map(({ id, label, icon: Icon }, index) => (
                <button
                  key={id}
                  id={`viso-tab-${id}`}
                  role="tab"
                  aria-selected={tab === id}
                  aria-controls={`viso-panel-${id}`}
                  tabIndex={tab === id ? 0 : -1}
                  onKeyDown={(event) => tabKey(event, index)}
                  onClick={() => selectTab(id)}
                >
                  <Icon />
                  {label}
                </button>
              ))}
            </div>
            <div
              id="viso-panel-states"
              role="tabpanel"
              aria-labelledby="viso-tab-states"
              className="viso-panel-tab-content"
              hidden={tab !== "states"}
            >
              <Deck compact />
            </div>
            <div
              id="viso-panel-display"
              role="tabpanel"
              aria-labelledby="viso-tab-display"
              className="viso-panel-tab-content"
              hidden={tab !== "display"}
            >
              <SharePanel />
            </div>
            <div
              id="viso-panel-connections"
              role="tabpanel"
              aria-labelledby="viso-tab-connections"
              className="viso-panel-tab-content"
              hidden={tab !== "connections"}
            >
              <StreamDeckPanel />
              <AndroidDownloadPanel />
            </div>
          </section>
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
        </main>
      </div>
      <nav className="viso-panel-mobile-nav" aria-label="Navegación del panel">
        <button
          aria-current={tab === "states" ? "page" : undefined}
          onClick={() => selectTab("states")}
        >
          <Home />
          <span>Panel</span>
        </button>
        <button
          aria-current={tab === "display" ? "page" : undefined}
          onClick={() => selectTab("display")}
        >
          <Monitor />
          <span>Display</span>
        </button>
        <button
          aria-current={tab === "connections" ? "page" : undefined}
          onClick={() => selectTab("connections")}
        >
          <Plug />
          <span>Conexiones</span>
        </button>
        <button onClick={() => setAccountOpen(true)}>
          <UserRound />
          <span>Cuenta</span>
        </button>
      </nav>
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="viso-panel-account-dialog">
          <DialogHeader>
            <DialogTitle>Tu cuenta</DialogTitle>
            <DialogDescription>
              Tu deck y tus dispositivos están vinculados a esta cuenta VISO.
            </DialogDescription>
          </DialogHeader>
          <p className="break-all text-sm">{user?.email}</p>
          <SignInButton variant="secondary" signOutText="Cerrar sesión" />
        </DialogContent>
      </Dialog>
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
    </div>
  );
}
