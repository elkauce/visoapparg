import { useEffect, useRef, useState } from "react";
import { useConvex, useConvexConnectionState, useMutation, useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { ArrowLeft, Maximize, Minimize, Pencil } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { immersive, isAndroidNative, nativeDeck } from "@/lib/android-native";
import { cn } from "@/lib/utils";
import DeckPage from "./page.tsx";
import VisoStateScreen from "./_components/viso-state-screen.tsx";
import SpotifyScreen from "./_components/spotify-screen.tsx";
import StandbyScreen from "./_components/standby-screen.tsx";
import GoogleHomeColorsDialog from "./_components/google-home-colors-dialog.tsx";
import { useAndroidMedia } from "./_components/use-android-media.ts";
import { findVisoStatus, type VisoStateDefinition } from "./_lib/viso-states.ts";
import { deckErrorMessage, deckExtensionsEnabled, getDeckDeviceId } from "./_lib/deck-options.ts";
import { getGridPreferenceStorage } from "./_lib/grid.ts";

const SCREENS = [
  { id: "estados", name: "Estados VISO" },
  { id: "spotify", name: "Spotify" },
  { id: "standby", name: "Standby" },
] as const;
type Screen = typeof SCREENS[number]["id"];

/** Three built-in Android views; saved pages and their editor remain untouched. */
export default function AndroidDeck() {
  const convex = useConvex();
  const user = useQuery(api.users.getCurrentUser, {});
  const statusData = useQuery(api.statuses.list, {});
  const connection = useConvexConnectionState();
  const createStatus = useMutation(api.statuses.create);
  const activateStatus = useMutation(api.deck_actions.activateStatus);
  const setActive = useMutation(api.statuses.setActive);
  const [screen, setScreen] = useState<Screen>("estados");
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [lightsOpen, setLightsOpen] = useState(false);
  const spotify = useAndroidMedia(screen === "spotify" && !editing, "com.spotify.music");
  const standby = useAndroidMedia(screen === "standby" && !editing);
  const connected = connection.isWebSocketConnected;

  useEffect(() => {
    const handleBack = (event: Event) => {
      if (editing || fullscreen) {
        event.preventDefault();
        if (editing) setEditing(false);
        else void immersive.exit().then(() => setFullscreen(false)).catch(() => undefined);
      }
    };
    window.addEventListener("viso:android-back", handleBack);
    return () => {
      window.removeEventListener("viso:android-back", handleBack);
    };
  }, [editing, fullscreen]);

  useEffect(() => () => {
    if (isAndroidNative()) void immersive.exit().catch(() => undefined);
  }, []);

  async function select(definition: VisoStateDefinition, knownId: Id<"statuses"> | null) {
    if (pendingRef.current) return;
    if (!connected) { toast.error("Sin conexión. Espera antes de cambiar el estado."); return; }
    pendingRef.current = true;
    setPending(true);
    try {
      let id = knownId;
      if (!id) {
        // Re-query at the explicit tap. Never replace Almuerzo or create defaults
        // from mounting a screen; existing actions keep their original IDs.
        const current = await convex.query(api.statuses.list, {});
        if (!current) throw new Error("Inicia sesión para cambiar el estado.");
        id = findVisoStatus(definition, current.statuses)?._id ?? null;
        if (!id) id = await createStatus({ name: definition.name, color: definition.defaultColor, icon: definition.icon });
      }
      if (deckExtensionsEnabled()) {
        const storage = getGridPreferenceStorage();
        const deviceId = isAndroidNative() ? await nativeDeck.getDeviceId() : storage ? getDeckDeviceId(storage) : crypto.randomUUID();
        await activateStatus({ statusId: id, requestId: crypto.randomUUID(), deviceId });
      } else await setActive({ statusId: id });
    } catch (error) { toast.error(deckErrorMessage(error)); }
    finally { pendingRef.current = false; setPending(false); }
  }

  async function toggleFullscreen() {
    try {
      if (isAndroidNative()) {
        if (fullscreen) await immersive.exit(); else await immersive.enter();
        setFullscreen(!fullscreen);
      } else if (document.fullscreenElement) { await document.exitFullscreen(); setFullscreen(false); }
      else { await document.documentElement.requestFullscreen(); setFullscreen(true); }
    } catch (error) { toast.error(deckErrorMessage(error)); }
  }

  if (user === undefined || statusData === undefined) return <div className="viso-safe-screen flex h-dvh items-center justify-center" role="status">Cargando VISO Deck…</div>;
  if (!user || !statusData) return <div className="viso-safe-screen flex h-dvh flex-col items-center justify-center gap-4"><p>Inicia sesión para usar tu Deck.</p><Button asChild><Link to="/">Volver al inicio</Link></Button></div>;
  if (editing) return <div className="relative h-dvh"><DeckPage /><Button className="fixed bottom-[max(var(--viso-safe-bottom),1rem)] left-1/2 z-40 -translate-x-1/2 shadow-lg" onClick={() => setEditing(false)}>Volver a Estados VISO</Button></div>;
  const activeStatus = statusData.statuses.find((status) => status._id === statusData.activeStatusId) ?? null;
  return (
    <div className="viso-safe-screen flex h-dvh min-h-0 flex-col gap-3 bg-background p-3" style={{ paddingTop: "max(var(--viso-safe-top),0.75rem)", paddingBottom: "max(var(--viso-safe-bottom),0.75rem)", paddingLeft: "max(var(--viso-safe-left),0.75rem)", paddingRight: "max(var(--viso-safe-right),0.75rem)" }}>
      <header className="flex shrink-0 items-center gap-1.5">
        <Button asChild variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Volver al inicio"><Link to="/"><ArrowLeft /></Link></Button>
        <nav aria-label="Pantallas predeterminadas del Deck" className="grid min-w-0 flex-1 grid-cols-3 items-center gap-1">
          {SCREENS.map((item) => <button key={item.id} type="button" onClick={() => setScreen(item.id)} aria-current={screen === item.id ? "page" : undefined} className={cn("min-w-0 rounded-full px-1 py-2 text-[11px] font-medium sm:px-3 sm:text-sm", screen === item.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>{item.name}</button>)}
        </nav>
        <span role="status" aria-label={pending ? "Esperando confirmación" : connected ? "Conectado a VISO" : "Sin conexión"} className={cn("size-1.5 shrink-0 rounded-full", connected ? "bg-green-500" : "bg-amber-500")} />
        {screen === "estados" && <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Editar mis teclas guardadas" onClick={() => setEditing(true)}><Pencil /></Button>}
        <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"} onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize /> : <Maximize />}</Button>
      </header>
      <main className="min-h-0 flex-1 overflow-auto" aria-label={SCREENS.find((item) => item.id === screen)?.name}>
        {screen === "estados" && <VisoStateScreen statuses={statusData.statuses} activeStatusId={statusData.activeStatusId} pending={pending} connected={connected} onSelect={(definition, id) => void select(definition, id)} onConfigureLights={() => setLightsOpen(true)} />}
        {screen === "spotify" && <SpotifyScreen media={spotify.media} loading={spotify.loading} error={spotify.error} pending={spotify.pending} onCommand={spotify.command} onRequestAccess={spotify.requestAccess} onRefresh={spotify.refresh} />}
        {screen === "standby" && <StandbyScreen key={user._id} userId={user._id} media={standby.media} mediaLoading={standby.loading} activeStatus={activeStatus} connected={connected} onMediaCommand={standby.command} mediaBusy={standby.pending} />}
      </main>
      <GoogleHomeColorsDialog key={user._id} userId={user._id} open={lightsOpen} onOpenChange={setLightsOpen} />
    </div>
  );
}
