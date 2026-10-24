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
  LayoutDashboard,
  LogOut,
  MessageCircle,
  QrCode,
  Settings2,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import TimbreIncoming from "@/components/timbre-incoming";
import { TimbreBrandContext } from "@/lib/timbre-brand";
import { api } from "@/convex/_generated/api";
import { convexUrl } from "./config";
import Landing from "./main";
import Auth from "./auth";
import WhatsappPanel, { WhatsappVisitor } from "./qr";
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
          <h1>No pudimos cargar Te a Viso</h1>
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
  const account = useQuery(api.teaviso.account, {});
  const { signOut } = useAuthActions();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (location.search.includes("google=return"))
      navigate(location.pathname, { replace: true });
  }, [location.pathname, location.search, navigate]);
  return (
    <div className="tea-shell">
      <aside className="tea-sidebar">
        <Link className="brand" to="/">
          <span className="tea-original-symbol" aria-hidden="true">
            <img src="/brand/viso-logo.png" alt="" />
          </span>
          Te a Viso
        </Link>
        <nav aria-label="Panel Te a Viso">
          <NavLink to="/panel" end>
            <LayoutDashboard /> Mi panel
          </NavLink>
          <NavLink to="/panel/whatsapp">
            <QrCode /> Mis entradas
          </NavLink>
          <NavLink to="/panel/business">
            <MessageCircle /> Servicio asistido
          </NavLink>
          <NavLink to="/timbre">
            <BellRing /> Timbre digital
          </NavLink>
          {account?.isAdmin && (
            <NavLink to="/panel/admin">
              <Settings2 /> Administración
            </NavLink>
          )}
          <a
            href="https://viso-deck-android.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ArrowUpRight /> Ir a VISO
          </a>
        </nav>
        <div className="tea-sidebar-bottom">
          <span>{account?.email ?? "Tu cuenta VISO"}</span>
          <button
            disabled={busy}
            onClick={() => {
              if (busy) return;
              setBusy(true);
              setError("");
              void signOut()
                .catch(() =>
                  setError("No pudimos cerrar la sesión. Intentá nuevamente."),
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
      <main className="tea-panel">{children}</main>
    </div>
  );
}
function Dashboard() {
  const account = useQuery(api.teaviso.account, {});
  return (
    <div className="tea-stack">
      <header>
        <span className="eyebrow">TU PUERTA, CONECTADA</span>
        <h1>Tu espacio en Te a Viso.</h1>
        <p>
          Elegí cómo querés recibir a tus visitas. Cada opción se administra
          desde acá.
        </p>
      </header>
      <div className="tea-welcome">
        <ShieldCheck />
        <div>
          <h2>Una cuenta, todo conectado.</h2>
          <p>{account?.email ?? "Tu cuenta"} · vinculada al ecosistema VISO.</p>
        </div>
      </div>
      <div className="tea-dashboard-cards">
        <article className="tea-card">
          <QrCode />
          <span className="tea-badge">Esencial</span>
          <h2>Tu entrada, a tu estilo</h2>
          <p>
            Creá, editá y descargá tus QR. Cambiá el número sin reimprimirlos.
          </p>
          <Link className="button" to="/panel/whatsapp">
            Administrar mis entradas
          </Link>
        </article>
        <article className="tea-card">
          <MessageCircle />
          <span className="tea-badge">Asistido</span>
          <h2>Servicio asistido</h2>
          <p>
            Número dedicado, QR y configuración inicial. Seguí tu solicitud y su
            preparación.
          </p>
          <Link className="button" to="/panel/business">
            Ver servicio
          </Link>
        </article>
        <article className="tea-card">
          <BellRing />
          <span className="tea-badge">Según tu plan</span>
          <h2>Timbre digital</h2>
          <p>
            Inmuebles, integrantes, QR y llamadas de audio y video con los
            permisos de tu cuenta.
          </p>
          <Link className="button" to="/timbre">
            Abrir mis timbres
          </Link>
        </article>
      </div>
      <section className="tea-card">
        <h2>Atendé desde donde estés</h2>
        <p>
          Este panel usa el mismo servicio de llamadas que VISO. Para recibir
          desde la web, mantené Te a Viso abierto y permití los avisos. La APK
          VISO actual sigue siendo compatible para recibir en segundo plano.
        </p>
        <p className="tea-muted">
          La APK independiente Te a Viso todavía no se distribuye. No necesitás
          contratar de nuevo las licencias vigentes.
        </p>
      </section>
    </div>
  );
}
function DigitalPanel() {
  return (
    <section className="tea-stack vt-management">
      <header>
        <span className="eyebrow">TE A VISO · AUDIO Y VIDEO</span>
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
    <BusinessAdmin />
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
            name: "Te a Viso",
            standalone: true,
          }}
        >
          <TooltipProvider>
            <BrowserRouter>
              <TimbreIncoming />
              <Suspense
                fallback={
                  <p role="status" className="tea-loading">
                    Cargando Te a Viso…
                  </p>
                }
              >
                <Routes>
                  <Route path="/" element={<Landing />} />
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
                  <Route path="/w/:token" element={<WhatsappVisitor />} />
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
