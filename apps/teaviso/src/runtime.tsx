import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ConvexAuthProvider, useAuthActions } from "@convex-dev/auth/react";
import {
  ConvexReactClient,
  useConvexAuth,
  useMutation,
  useQuery,
} from "convex/react";
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
  QrCode,
  Settings2,
  ShieldCheck,
  Menu,
  X,
  ArrowUpRight,
  Users,
} from "lucide-react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import TimbreIncoming from "@/components/timbre-incoming";
import { TimbreBrandContext } from "@/lib/timbre-brand";
import { api } from "@/convex/_generated/api";
import { convexUrl } from "./config";
import AccountPanel from "./account-panel";
import AdminCustomers from "./admin-customers";
import { AdminSigns, MySigns, SignCatalog, SignPage } from "./sign-pages";
import { FeaturePage } from "./feature-previews";
import Landing, { Equipment, Plans, Privacy, Solutions } from "./main";
import {
  Agenda,
  Entries,
  Onboarding,
  Overview,
  PortalSettings,
  SpaceEditorPage,
} from "./workspace";
import { BookingReceipt, EntryPortal } from "./visitor-v2";
import { Brand } from "./ui-v2";
import { PlanPanel, AdminPlanRequests } from "./commercial-panel";
import TimbreAdmin from "@/pages/timbre/admin";
import Auth from "./auth";
import WhatsappPanel from "./qr";
import BusinessPanel, { BusinessAdmin } from "./business";
import "../../../src/index.css";
import "./style.css";
import "./panel.css";
import "./sober.css";

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
  const account = useQuery(api.teaviso_accounts.profile, {}),
    register = useMutation(api.teaviso_accounts.register),
    { signOut } = useAuthActions(),
    location = useLocation(),
    navigate = useNavigate();
  const [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (account?.id && !account.enrolled)
      void register({}).catch(() =>
        setError(
          "No pudimos preparar tu perfil. Recargá e intentá nuevamente.",
        ),
      );
  }, [account?.id, account?.enrolled, register]);
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
    { to: "/panel/timbres", label: "Mis timbres", icon: QrCode },
    { to: "/panel/agenda", label: "Agenda", icon: CalendarDays },
    { to: "/panel/portal", label: "Portal de visitas", icon: MessageCircle },
    { to: "/panel/llamadas", label: "Llamadas e integrantes", icon: BellRing },
    { to: "/panel/carteles", label: "Mis carteles", icon: QrCode },
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
            <div className="av-admin-nav">
              <small>Administración Te Aviso</small>
              <NavLink
                to="/panel/admin/consultas"
                onClick={() => setOpen(false)}
              >
                <MessageCircle size={19} />
                Consultas de planes
              </NavLink>
              <NavLink to="/panel/admin" end onClick={() => setOpen(false)}>
                <Users size={19} />
                Usuarios y timbres
              </NavLink>
              <NavLink
                to="/panel/admin/carteles"
                onClick={() => setOpen(false)}
              >
                <QrCode size={19} />
                Carteles y presupuestos
              </NavLink>
              <NavLink to="/panel/admin/planes" onClick={() => setOpen(false)}>
                <ShieldCheck size={19} />
                Planes y licencias
              </NavLink>
              <NavLink
                to="/panel/admin/servicios"
                onClick={() => setOpen(false)}
              >
                <MessageCircle size={19} />
                Números dedicados
              </NavLink>
            </div>
          )}
          {account?.deckLinked && (
            <a
              href="https://viso-deck-android.vercel.app/deck"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ArrowUpRight size={19} />
              Mi Deck VISO
            </a>
          )}
        </nav>
        <div className="av-sidebar-account">
          <small>{account?.email ?? "Tu cuenta Te Aviso"}</small>
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
          { to: "/panel/timbres", name: "Timbres", icon: QrCode },
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
function DigitalPanel() {
  return (
    <section className="tea-stack vt-management">
      <header>
        <span className="eyebrow">TE AVISO · AUDIO Y VIDEO</span>
        <h1>Mis timbres digitales</h1>
        <p>
          Administrá integrantes, notificaciones y llamadas de tus timbres en Te
          Aviso.
        </p>
      </header>
      <Digital />
    </section>
  );
}
function AdminPanel({
  section = "customers",
}: {
  section?: "customers" | "commercial" | "business" | "signs" | "requests";
}) {
  const account = useQuery(api.teaviso_accounts.profile, {});
  if (account === undefined) return <p role="status">Revisando permisos…</p>;
  if (!account?.isAdmin)
    return (
      <section className="av-card">
        <h1>Acceso restringido</h1>
        <p>Esta sección es para administradores de Te Aviso.</p>
      </section>
    );
  if (section === "customers") return <AdminCustomers />;
  if (section === "requests") return <AdminPlanRequests />;
  if (section === "signs") return <AdminSigns />;
  return (
    <div className="av-stack">
      <header className="av-panel-heading">
        <div>
          <span className="av-eyebrow">Administración Te Aviso</span>
          <h1>
            {section === "commercial"
              ? "Planes y licencias"
              : "Números dedicados"}
          </h1>
        </div>
      </header>
      {section === "commercial" ? <TimbreAdmin /> : <BusinessAdmin />}
    </div>
  );
}
function LegacyDevices() {
  return <Navigate to="/panel/cuenta" replace />;
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
                  <Route path="/funciones/:feature" element={<FeaturePage />} />
                  <Route path="/carteles" element={<SignCatalog />} />
                  <Route path="/carteles/:model" element={<SignPage />} />
                  <Route path="/panel/carteles" element={panel(<MySigns />)} />
                  <Route
                    path="/panel/carteles/:model"
                    element={panel(<SignPage owner />)}
                  />
                  <Route
                    path="/panel/admin/carteles"
                    element={panel(<AdminPanel section="signs" />)}
                  />
                  <Route path="/soluciones" element={<Solutions />} />
                  <Route path="/soluciones/:solution" element={<Solutions />} />
                  <Route path="/equipos" element={<Equipment />} />
                  <Route path="/privacidad" element={<Privacy />} />
                  <Route path="/panel/nuevo" element={panel(<Onboarding />)} />
                  <Route path="/panel/entradas" element={panel(<Entries />)} />
                  <Route path="/panel/timbres" element={panel(<Entries />)} />
                  <Route
                    path="/panel/llamadas"
                    element={panel(<DigitalPanel />)}
                  />
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
                    element={panel(<LegacyDevices />)}
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
                  <Route
                    path="/panel/admin/consultas"
                    element={panel(<AdminPanel section="requests" />)}
                  />
                  <Route
                    path="/panel/admin/planes"
                    element={panel(<AdminPanel section="commercial" />)}
                  />
                  <Route
                    path="/panel/admin/servicios"
                    element={panel(<AdminPanel section="business" />)}
                  />
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
