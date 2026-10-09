import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { isAndroidNative, nativeDeck } from "@/lib/android-native.ts";
import { toast } from "sonner";
import { AndroidScreen } from "./shared.tsx";

export default function AndroidSettings() {
  const user = useQuery(api.users.getCurrentUser, {});
  return <AndroidScreen title="Configuración">
    <section className="space-y-3 rounded-2xl border border-border bg-card p-5"><h2 className="font-semibold">Cuenta</h2><p className="break-all text-sm text-muted-foreground">{user?.email ?? "Cuenta VISO"}</p><p className="text-sm text-muted-foreground">La sesión se conserva en este dispositivo. Cierra sesión antes de compartirlo.</p><SignInButton variant="outline" signOutText="Cerrar sesión" /></section>
    <section className="space-y-3 rounded-2xl border border-border bg-card p-5"><h2 className="font-semibold">Deck</h2><p className="text-sm text-muted-foreground">Abre el Deck y toca Editar para configurar teclas, páginas y distribución. La orientación se ajusta automáticamente.</p><Button asChild variant="outline"><Link to="/deck">Configurar Deck</Link></Button></section>
    <section className="space-y-3 rounded-2xl border border-border bg-card p-5"><h2 className="font-semibold">Aplicaciones permitidas</h2><p className="text-sm text-muted-foreground">Elige qué aplicaciones pueden abrir las teclas de tu Deck.</p><Button variant="outline" disabled={!isAndroidNative()} onClick={() => void nativeDeck.manageAllowedApps().then(() => toast.success("Aplicaciones permitidas actualizadas")).catch(() => toast.error("No se pudo actualizar la lista"))}>Elegir aplicaciones</Button></section>
    <Button asChild variant="outline"><Link to="/android/integrations">Configurar integraciones</Link></Button>
    <p className="text-xs text-muted-foreground">VISO Deck Android 1.0 · versión de prueba</p>
  </AndroidScreen>;
}
