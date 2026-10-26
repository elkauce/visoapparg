import { readableTextColor } from "@/lib/color";
import type { CSSProperties } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { Link } from "react-router-dom";
import {
  LayoutGrid,
  Monitor,
  Plug,
  ShoppingBag,
  BellRing,
  ChevronRight,
  UserRound,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import StatusIcon from "@/components/status-icon";
import AccountAccess from "@/components/account-access";
import NativeBrand from "@/components/native-brand";
import NativeAppNav from "@/components/native-app-nav";
import { ConnectionStatus } from "./shared";
import "./management.css";

export default function AndroidHome() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const data = useQuery(api.statuses.list, isAuthenticated ? {} : "skip");
  const active = data?.statuses.find(
    (status) => status._id === data.activeStatusId,
  );
  if (isLoading)
    return (
      <div className="viso-app-home viso-safe-screen">
        <p role="status">Cargando tu cuenta…</p>
      </div>
    );
  if (!isAuthenticated)
    return (
      <div className="viso-app-home viso-app-welcome viso-safe-screen">
        <main>
          <NativeBrand />
          <h1>Tu espacio, conectado.</h1>
          <p>Todo lo que necesitás, en un solo lugar.</p>
          <div className="viso-app-auth-halo">
            <AccountAccess />
          </div>
          <p className="viso-app-welcome-footer">
            Deck · Display · Timbre · Marketplace
          </p>
        </main>
      </div>
    );
  return (
    <div className="viso-app-home viso-safe-screen">
      <header className="viso-app-home-header">
        <NativeBrand />
        <Link
          to="/android/settings"
          className="viso-app-avatar"
          aria-label="Abrir mi cuenta"
        >
          <UserRound />
        </Link>
      </header>
      <main className="viso-app-dashboard">
        <h1>Tu panel</h1>
        <Link
          to="/deck"
          className="viso-app-current-status"
          style={
            {
              backgroundColor: active?.color ?? "#64748b",
              color: active ? readableTextColor(active.color) : "#fff",
            } as CSSProperties
          }
          aria-label={
            active ? `Estado actual: ${active.name}. Abrir Deck` : "Abrir Deck"
          }
        >
          <span>Estado actual</span>
          <strong>
            {active && <StatusIcon name={active.icon} className="size-7" />}
            {active?.name ??
              (data === undefined ? "Sincronizando…" : "Sin estado activo")}
          </strong>
          <ChevronRight className="viso-app-status-arrow" />
        </Link>
        <section className="viso-app-launchers" aria-label="Tu espacio VISO">
          {[
            {
              title: "Deck",
              description: "Tus teclas y páginas",
              icon: LayoutGrid,
              to: "/deck",
              primary: true,
            },
            {
              title: "Display",
              description: "Tu estado, a la vista",
              icon: Monitor,
              to: "/android/display",
            },
            {
              title: "Timbre",
              description: "Recibí tus visitas",
              icon: BellRing,
              to: "/timbre",
            },
            {
              title: "Marketplace",
              description: "Descubrí contenidos",
              icon: ShoppingBag,
              to: "/marketplace",
            },
          ].map(({ title, description, icon: Icon, to, primary }) => (
            <Link
              key={title}
              to={to}
              className={`viso-app-launcher${primary ? " is-primary" : ""}`}
            >
              <span className="viso-app-launcher-icon">
                <Icon />
              </span>
              <h2>{title}</h2>
              <p>{description}</p>
              <ChevronRight className="viso-app-launcher-arrow" />
            </Link>
          ))}
        </section>
        <Link to="/android/integrations" className="viso-app-connections">
          <Plug />
          <span>
            <strong>Conexiones</strong>
            <small>Tus servicios vinculados</small>
          </span>
          <ChevronRight />
        </Link>
        <ConnectionStatus />
      </main>
      <NativeAppNav />
    </div>
  );
}
