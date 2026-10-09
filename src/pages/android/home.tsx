import { useConvexAuth } from "convex/react";
import { Link } from "react-router-dom";
import { LayoutGrid, Monitor, Settings2, Plug } from "lucide-react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Button } from "@/components/ui/button.tsx";
import { VisoBrand } from "@/components/viso-brand.tsx";
import { ConnectionStatus } from "./shared.tsx";

export default function AndroidHome() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  return <div className="viso-safe-screen viso-safe-home flex min-h-dvh flex-col bg-background">
    <header className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-3"><VisoBrand /><ConnectionStatus /></header>
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 py-8">
      <h1 className="text-2xl font-semibold">VISO Deck</h1>
      {isLoading ? <p role="status">Cargando la sesión…</p> : isAuthenticated ? <>
        <Button asChild className="h-24 justify-start rounded-2xl px-6 text-xl"><Link to="/deck"><LayoutGrid className="mr-3 size-8" />Deck</Link></Button>
        <Button asChild className="h-24 justify-start rounded-2xl px-6 text-xl"><Link to="/android/display"><Monitor className="mr-3 size-8" />Display</Link></Button>
        <div className="grid grid-cols-2 gap-3"><Button asChild variant="outline" className="h-14"><Link to="/android/settings"><Settings2 />Configuración</Link></Button><Button asChild variant="outline" className="h-14"><Link to="/android/integrations"><Plug />Integraciones</Link></Button></div>
      </> : <><p className="text-muted-foreground">Tu Deck y tu Display, sincronizados con tu cuenta VISO.</p><SignInButton size="lg" signInText="Entrar o crear cuenta" /></>}
    </main>
    {isAuthenticated && <footer className="mx-auto flex w-full max-w-2xl justify-end"><SignInButton variant="ghost" signOutText="Cerrar sesión" /></footer>}
  </div>;
}
