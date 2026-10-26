import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useConvexAuth, useConvexConnectionState } from "convex/react";
import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin";
import NativeAppNav from "@/components/native-app-nav";
import "./management.css";

export function ConnectionStatus() {
  const connection = useConvexConnectionState();
  const syncing =
    !connection.hasEverConnected || connection.hasInflightRequests;
  const status = connection.isWebSocketConnected
    ? syncing
      ? "Sincronizando"
      : "Conectado"
    : connection.hasEverConnected
      ? "Sin conexión"
      : "Sincronizando";
  return (
    <span
      role="status"
      className="ml-auto shrink-0 text-xs text-muted-foreground"
    >
      VISO — {status}
    </span>
  );
}

export function AndroidScreen({
  title,
  children,
  backTo = "/",
  backLabel = "Volver al inicio",
}: {
  title: string;
  children: React.ReactNode;
  backTo?: string;
  backLabel?: string;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  return (
    <div className="viso-safe-screen viso-app-management">
      <header className="viso-app-page-header">
        <Button asChild variant="ghost" size="icon" aria-label={backLabel}>
          <Link to={backTo}>
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="min-w-32 flex-1 text-xl font-semibold break-words">
          {title}
        </h1>
        <ConnectionStatus />
      </header>
      <main className="viso-app-page-content space-y-5">
        {isLoading ? (
          <p role="status">Cargando la sesión…</p>
        ) : isAuthenticated ? (
          children
        ) : (
          <div className="space-y-4">
            <p>Inicia sesión con tu cuenta VISO.</p>
            <SignInButton />
          </div>
        )}
      </main>
      {isAuthenticated && <NativeAppNav />}
    </div>
  );
}
