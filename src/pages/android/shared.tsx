import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useConvexAuth, useConvexConnectionState } from "convex/react";
import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";

export function ConnectionStatus() {
  const connection = useConvexConnectionState();
  return <span role="status" className="text-xs text-muted-foreground">{connection.isWebSocketConnected ? "Conectado a VISO" : connection.hasEverConnected ? "Sin conexión · reconectando" : "Conectando a VISO…"}</span>;
}

export function AndroidScreen({ title, children }: { title: string; children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  return <div className="min-h-dvh bg-background px-5 pb-8" style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)", paddingBottom: "max(env(safe-area-inset-bottom), 2rem)" }}>
    <header className="mx-auto mb-6 flex max-w-2xl items-center gap-3"><Button asChild variant="ghost" size="icon" aria-label="Volver al inicio"><Link to="/"><ArrowLeft /></Link></Button><h1 className="flex-1 text-xl font-semibold">{title}</h1><ConnectionStatus /></header>
    <main className="mx-auto max-w-2xl space-y-5">{isLoading ? <p role="status">Cargando la sesión…</p> : isAuthenticated ? children : <div className="space-y-4"><p>Inicia sesión con tu cuenta VISO.</p><SignInButton /></div>}</main>
  </div>;
}
