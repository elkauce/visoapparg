import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ConvexAuthProvider, useAuthActions } from "@convex-dev/auth/react";
import { ConvexReactClient, useConvexAuth, useQuery } from "convex/react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  BellRing,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Package,
  QrCode,
  Settings2,
  ShieldCheck,
  Menu,
  X,
  ArrowUpRight,
} from "lucide-react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import TimbreIncoming from "@/components/timbre-incoming";
import { TimbreBrandContext } from "@/lib/timbre-brand";
import { api } from "@/convex/_generated/api";
import { convexUrl } from "./config";
import Landing, { Equipment, Plans, Privacy, Solutions } from "./main";
import {
  Agenda,
  Devices,
  Entries,
  Onboarding,
  Overview,
  PortalSettings,
  SpaceEditorPage,
} from "./workspace";
import { BookingReceipt, EntryPortal } from "./visitor-v2";
import { Brand } from "./ui-v2";
import TimbreCommercial from "@/pages/timbre/commercial";
import TimbreAdmin from "@/pages/timbre/admin";
import Auth from "./auth";
import WhatsappPanel from "./qr";
import BusinessPanel, { BusinessAdmin } from "./business";
import "../../../src/index.css";
import "./style.css";
import "./panel.css";

const Digital = lazy(() =>
  import("@/pages/timbre/page").then((module) => ({
    default: module.TimbreWorkspace,
  })),
);
const Visitor = lazy(() => import("@/pages/timbre/visitor"));
const Call = lazy(() => import("@/pages/timbre/call-session"));
const client = new ConvexReactClient(convexUrl);

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="tea-visitor">
        <section className="tea-card">
          <h1>No pudimos cargar Te Aviso</h1>
          <p>
            Revisá la conexión. Si el problema continúa, el servicio puede estar
            pendiente de actualización.
          </p>
          <button className="button" onClick={() => window.location.reload()}>
            Reintentar
          </button>
          <a href="/">Volver al inicio</a>
        </section>
      </main>
    ) : (
      this.props.children
    );
  }
}
function Protected({ children }: { children: ReactNode }) {
  const auth = useConvexAuth();
  if (auth.isLoading)
    return (
      <p role="status" className="tea-loading">
        Revisando tu cuenta…
      </p>
    );
  return auth.isAuthenticated ? <>{children}</> : <Auth />;
}
function Shell({ children }: { children: ReactNode }) {
  const account = useQuery(api.teaviso.account, {}),
    { signOut } = useAuthActions(),
    location = useLocation(),
    navigate = useNavigate();
  const [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (p.has("google")) {
      p.delete("google");
      navigate(`${location.pathname}${p.size ? `?${p}` : ""}`, {
        replace: true,
      });
    }
  }, [location.pathname, location.search, navigate]);
  const space = new URLSearchParams(location.search).get("space"),
    withSpace = (path: string) =>
      space ? `${path}?space=${encodeURIComponent(space)}` : path;
  const links = [
    { to: "/panel", label: "Inicio", icon: LayoutDashboard },
    { to: "/panel/entradas", label: "Mis entradas", icon: QrCode },
    { to: "/panel/agenda", label: "Agenda", icon: CalendarDays },
    { to: "/panel/portal", label: "Portal de visitas", icon: MessageCircle },
    { to: "/timbre", label: "Llamadas e integrantes", icon: BellRing },
    { to: "/panel/dispositivos", label: "Dispositivos", icon: Package },
    { to: "/panel/plan", label: "Mi plan", icon: ShieldCheck },
    { to: "/panel/cuenta", label: "Mi cuenta", icon: Settings2 },
  ];
  return (
    <div className={`av-shell${open ? " nav-open" : ""}`}>
      <header className="av-mobile-header">
        <Brand />
        <button
          onClick={() => setOpen(!open)}
          aria-label={open ? "Cerrar navegación" : "Abrir navegación"}
          aria-expanded={open}
        >
          {open ? <X /> : <Menu />}
        </button>
      </header>
      <aside className="av-sidebar">
        <Brand />
        <nav aria-label="Panel Te Aviso">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={withSpace(to)}
              end={to === "/panel"}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
          {account?.isAdmin && (
            <NavLink to="/panel/admin" onClick={() => setOpen(false)}>
              <Settings2 size={19} />
              Administración
            </NavLink>
          )}
          <a
            href="https://viso-deck-android.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ArrowUpRight size={19} />
            Ir a VISO
          </a>
        </nav>
        <div className="av-sidebar-account">
          <small>{account?.email ?? "Tu cuenta VISO"}</small>
          <button
            disabled={busy}
            onClick={() => {
              if (busy) return;
              setBusy(true);
              setError("");
              void signOut()
                .catch(() =>
                  setError("No pudimos cerrar sesión. Intentá nuevamente."),
                )
                .finally(() => setBusy(false));
            }}
          >
            <LogOut size={16} />
            {busy ? "Saliendo…" : "Cerrar sesión"}
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      </aside>
      <main className="tea-panel av-panel">{children}</main>
      <nav className="av-bottom-nav" aria-label="Navegación móvil">
        {[
          { to: "/panel", name: "Inicio", icon: LayoutDashboard },
          { to: "/panel/agenda", name: "Agenda", icon: CalendarDays },
          { to: "/panel/entradas", name: "Entradas", icon: QrCode },
          { to: "/panel/cuenta", name: "Cuenta", icon: Settings2 },
        ].map(({ to, name, icon: Icon }) => (
          <NavLink key={to} to={withSpace(to)} end={to === "/panel"}>
            <Icon size={21} />
            <span>{name}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
function Dashboard() {
  return <Overview />;
}
function AccountPanel() {
  const account = useQuery(api.teaviso.account, {});
  return (
    <div className="av-stack">
      <header className="av-panel-heading">
        <div>
          <span className="av-eyebrow">Tu cuenta, conectada</span>
          <h1>Mi cuenta</h1>
          <p>Usás la misma identidad en Te Aviso y VISO.</p>
        </div>
      </header>
      <section className="av-card">
        <h2>{account?.name ?? "Tu perfil"}</h2>
        <p>{account?.email}</p>
        <a
          className="av-button av-outline"
          href="https://viso-deck-android.vercel.app/?section=account"
          target="_blank"
          rel="noopener noreferrer"
        >
          Gestionar mi cuenta VISO ↗
        </a>
      </section>
      <section className="av-card">
        <h2>Recepción de avisos</h2>
        <p>
          Los avisos de visitas y agenda se consultan en este panel. Para
          llamadas con la web abierta, permití cámara y micrófono cuando vayas a
          atender.
        </p>
        <p>
          La APK VISO compatible recibe llamadas con sus permisos y las
          condiciones de Android. La APK independiente Te Aviso todavía no se
          distribuye; no hay recepción nativa iOS.
        </p>
      </section>
      <Link to="/privacidad">Privacidad y uso ↗</Link>
    </div>
  );
}
function PlanPanel() {
  return (
    <div className="av-stack">
      <header className="av-panel-heading">
        <div>
          <span className="av-eyebrow">Elegí cómo recibir</span>
          <h1>Mi plan y beneficios</h1>
          <p>
            Tu WhatsApp básico es gratuito. Las reservas, el portal de mensajes
            y los servicios adicionales se habilitan según tu contratación.
          </p>
        </div>
      </header>
      <section className="av-card">
        <h2>WhatsApp y número dedicado</h2>
        <p>
          Conservá tu número o solicitá la preparación de un número para tu
          espacio. Los mensajes preguardados son una mejora de la licencia.
        </p>
        <Link className="av-button av-outline" to="/panel/business">
          Consultar número dedicado ↗
        </Link>
      </section>
      <TimbreCommercial />
    </div>
  );
}
function DigitalPanel() {
  return (
    <section className="tea-stack vt-management">
      <header>
        <span className="eyebrow">TE AVISO · AUDIO Y VIDEO</span>
        <h1>Mis timbres digitales</h1>
        <p>
          Administrá tus lugares, integrantes, QR y llamadas con tu cuenta
          vinculada a VISO.
        </p>
      </header>
      <Digital />
    </section>
  );
}
function AdminPanel() {
  const account = useQuery(api.teaviso.account, {});
  return account === undefined ? (
    <p role="status">Revisando permisos…</p>
  ) : account?.isAdmin ? (
    <div className="av-stack">
      <header className="av-panel-heading">
        <h1>Administración Te Aviso</h1>
      </header>
      <details className="av-card" open>
        <summary>Planes, licencias y asistencia</summary>
        <TimbreAdmin />
      </details>
      <details className="av-card">
        <summary>Número dedicado y configuración asistida</summary>
        <BusinessAdmin />
      </details>
    </div>
  ) : (
    <section className="tea-card">
      <h1>Acceso restringido</h1>
      <p>Esta sección es para administradores.</p>
    </section>
  );
}
function panel(content: ReactNode) {
  return (
    <Protected>
      <Shell>{content}</Shell>
    </Protected>
  );
}
export default function App() {
  return (
    <Boundary>
      <ConvexAuthProvider client={client}>
        <TimbreBrandContext.Provider
          value={{
            name: "Te Aviso",
            standalone: true,
          }}
        >
          <TooltipProvider>
            <BrowserRouter>
              <TimbreIncoming />
              <Suspense
                fallback={
                  <p role="status" className="tea-loading">
                    Cargando Te Aviso…
                  </p>
                }
              >
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/planes" element={<Plans />} />
                  <Route path="/soluciones" element={<Solutions />} />
                  <Route path="/soluciones/:solution" element={<Solutions />} />
                  <Route path="/equipos" element={<Equipment />} />
                  <Route path="/privacidad" element={<Privacy />} />
                  <Route path="/panel/nuevo" element={panel(<Onboarding />)} />
                  <Route path="/panel/entradas" element={panel(<Entries />)} />
                  <Route
                    path="/panel/entradas/:spaceId"
                    element={panel(<SpaceEditorPage />)}
                  />
                  <Route path="/panel/agenda" element={panel(<Agenda />)} />
                  <Route
                    path="/panel/portal"
                    element={panel(<PortalSettings />)}
                  />
                  <Route
                    path="/panel/dispositivos"
                    element={panel(<Devices />)}
                  />
                  <Route path="/panel/plan" element={panel(<PlanPanel />)} />
                  <Route
                    path="/panel/cuenta"
                    element={panel(<AccountPanel />)}
                  />
                  <Route path="/e/:token" element={<EntryPortal />} />
                  <Route path="/reserva/:id" element={<BookingReceipt />} />
                  <Route
                    path="/login"
                    element={<Navigate to="/panel" replace />}
                  />
                  <Route path="/panel" element={panel(<Dashboard />)} />
                  <Route
                    path="/panel/whatsapp"
                    element={panel(<WhatsappPanel />)}
                  />
                  <Route
                    path="/panel/business"
                    element={panel(<BusinessPanel />)}
                  />
                  <Route path="/panel/admin" element={panel(<AdminPanel />)} />
                  <Route path="/timbre" element={panel(<DigitalPanel />)} />
                  <Route path="/t/:qr" element={<Visitor />} />
                  <Route path="/w/:token" element={<EntryPortal />} />
                  <Route
                    path="/timbre/call/:callId"
                    element={
                      <Protected>
                        <Call />
                      </Protected>
                    }
                  />
                  <Route
                    path="*"
                    element={
                      <main className="tea-visitor">
                        <section className="tea-card">
                          <h1>No encontramos esta página</h1>
                          <Link className="button" to="/">
                            Volver al inicio
                          </Link>
                        </section>
                      </main>
                    }
                  />
                </Routes>
              </Suspense>
            </BrowserRouter>
            <Toaster theme="light" />
          </TooltipProvider>
        </TimbreBrandContext.Provider>
      </ConvexAuthProvider>
    </Boundary>
  );
}
