import { useCallback, useEffect, useState } from "react";
import { useConvexConnectionState } from "convex/react";
import { Button } from "@/components/ui/button.tsx";
import { actions, isAndroidNative, nativeDeck, type HomeAssistantLight, type NativeCapabilities, type MediaCommand } from "@/lib/android-native.ts";
import { AndroidScreen } from "./shared.tsx";
import { toast } from "sonner";

const mediaButtons: { label: string; command: MediaCommand; session?: boolean }[] = [
  { label: "Anterior", command: "previous", session: true },
  { label: "Play / pausa", command: "play-pause", session: true },
  { label: "Siguiente", command: "next", session: true },
  { label: "Volumen −", command: "volume-down" },
  { label: "Volumen +", command: "volume-up" },
  { label: "Silenciar", command: "mute" },
];

function LightControls({ light, refresh }: { light: HomeAssistantLight; refresh: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const control = async (options: Parameters<typeof nativeDeck.controlLight>[1]) => {
    if (pending) return;
    setPending(true);
    try { await nativeDeck.controlLight(light.id, options); await refresh(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "La luz no respondió"); }
    finally { setPending(false); }
  };
  return <div className="space-y-3 rounded-xl border border-border p-4"><div className="flex items-center justify-between gap-3"><span>{light.name}</span><Button size="sm" variant="outline" disabled={pending || !light.available} onClick={() => void control({ on: !light.on })}>{light.available ? light.on ? "Apagar" : "Encender" : "No disponible"}</Button></div>
    {light.brightness !== undefined && <label className="flex items-center justify-between gap-3 text-sm">Brillo<input aria-label={`Brillo de ${light.name}`} type="range" min="0" max="100" defaultValue={light.brightness} key={light.brightness} disabled={pending || !light.available} onPointerUp={(event) => void control({ brightness: Number(event.currentTarget.value) })} onKeyUp={(event) => { if (event.key.startsWith("Arrow")) void control({ brightness: Number(event.currentTarget.value) }); }} /></label>}
    {light.supportsColor && <label className="flex items-center justify-between text-sm">Color<input aria-label={`Color de ${light.name}`} type="color" defaultValue="#ffffff" disabled={pending || !light.available} onChange={(event) => void control({ color: event.target.value })} /></label>}
  </div>;
}

function IntegrationCard({ title, status, children }: { title: string; status: string; children: React.ReactNode }) {
  return <section className="space-y-3 rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{title}</h2><span className="text-xs text-muted-foreground">{status}</span></div>{children}</section>;
}

export default function AndroidIntegrations() {
  const [capabilities, setCapabilities] = useState<NativeCapabilities | null>(null);
  const [lights, setLights] = useState<HomeAssistantLight[]>([]);
  const [pending, setPending] = useState(false);
  const connection = useConvexConnectionState();
  const refresh = useCallback(async () => {
    const state = await nativeDeck.getCapabilities();
    setCapabilities(state);
    if (state.homeAssistant.status === "connected") setLights(await nativeDeck.getHomeAssistantLights());
    else setLights([]);
  }, []);
  useEffect(() => {
    let active = true;
    void nativeDeck.getCapabilities().then(async (state) => {
      if (!active) return;
      setCapabilities(state);
      if (state.homeAssistant.status === "connected") {
        const discovered = await nativeDeck.getHomeAssistantLights();
        if (active) setLights(discovered);
      }
    }).catch(() => { if (active) toast.error("No se pudo consultar las integraciones"); });
    const resume = () => { if (!document.hidden) void refresh().catch(() => undefined); };
    document.addEventListener("visibilitychange", resume);
    return () => { active = false; document.removeEventListener("visibilitychange", resume); };
  }, [refresh]);
  const perform = async (operation: () => Promise<unknown>) => {
    if (pending) return;
    setPending(true);
    try { await operation(); await refresh(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "La integración no respondió"); }
    finally { setPending(false); }
  };
  const hasSession = !!capabilities?.mediaPermissionGranted && (capabilities?.activeMediaSessions ?? 0) > 0;
  return <AndroidScreen title="Integraciones">
    <Button variant="outline" disabled={pending} onClick={() => void perform(refresh)}>Actualizar estado</Button>
    <IntegrationCard title="VISO y sincronización" status={connection.isWebSocketConnected ? "Conectado" : "Reconectando"}><p className="text-sm text-muted-foreground">Los estados, páginas y teclas pertenecen a tu cuenta. El Deck confirma los cambios cuando el servidor los recibe.</p></IntegrationCard>
    <IntegrationCard title="Google Home" status="Pendiente de autorización"><p className="text-sm text-muted-foreground">{capabilities?.googleHome.message ?? "Requiere configurar el proyecto Google Home y autorizar la aplicación con OAuth."}</p><p className="text-sm text-muted-foreground">Esta versión no controla dispositivos directamente mediante Google Home.</p></IntegrationCard>
    <IntegrationCard title="Luces y RGB · Home Assistant" status={capabilities?.homeAssistant.status === "connected" ? "Conectado" : "Sin conexión"}>
      <p className="text-sm text-muted-foreground">{capabilities?.homeAssistant.message ?? "Conecta tu servidor Home Assistant HTTPS. El token se introduce y guarda de forma segura en Android."}</p>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!isAndroidNative() || pending} onClick={() => void perform(() => nativeDeck.configureHomeAssistant())}>Conectar servidor</Button>{capabilities?.homeAssistant.configured && <Button variant="outline" disabled={pending} onClick={() => void perform(() => nativeDeck.disconnectHomeAssistant())}>Desconectar</Button>}</div>
      {lights.map((light) => <LightControls key={light.id} light={light} refresh={refresh} />)}
      {capabilities?.homeAssistant.status === "connected" && lights.length === 0 && <p className="text-sm text-muted-foreground">El servidor respondió, pero no expone luces disponibles.</p>}
    </IntegrationCard>
    <IntegrationCard title="Multimedia Android" status={hasSession ? "Sesión multimedia disponible" : "Sin sesión activa"}>
      <p className="text-sm text-muted-foreground">El volumen controla este dispositivo. Para controlar la reproducción, permite el acceso a notificaciones y abre un reproductor compatible.</p><Button variant="outline" disabled={!isAndroidNative() || pending} onClick={() => void perform(() => nativeDeck.openMediaPermissionSettings())}>Permitir control multimedia</Button>
      <div className="flex flex-wrap gap-2">{mediaButtons.map(({ label, command, session }) => <Button key={command} size="sm" variant="secondary" disabled={pending || !isAndroidNative() || (session && !hasSession)} onClick={() => void perform(() => actions.media(command))}>{label}</Button>)}</div>
    </IntegrationCard>
    <IntegrationCard title="Aplicaciones y automatizaciones" status={isAndroidNative() ? "Android disponible" : "Requiere APK"}><p className="text-sm text-muted-foreground">Autoriza las aplicaciones que puede abrir el Deck. Las automatizaciones se detienen si un paso no puede completarse.</p><Button variant="outline" disabled={!isAndroidNative() || pending} onClick={() => void perform(() => nativeDeck.manageAllowedApps())}>Aplicaciones permitidas</Button></IntegrationCard>
    <IntegrationCard title="Elgato Stream Deck" status="Plugin pendiente de conexión"><p className="text-sm text-muted-foreground">Stream Deck físico utiliza su plugin en una computadora. Stream Deck Mobile es una aplicación independiente de Elgato.</p><Button asChild variant="outline"><a href="https://www.elgato.com/stream-deck-mobile" target="_blank" rel="noreferrer">Ver Stream Deck Mobile</a></Button></IntegrationCard>
  </AndroidScreen>;
}
