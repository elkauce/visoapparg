import { useEffect, useRef, useState } from "react";
import {
  useConvex,
  useConvexConnectionState,
  useMutation,
  useQuery,
} from "convex/react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Lightbulb,
  Maximize,
  Minimize,
  Pencil,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { immersive, isAndroidNative, nativeDeck } from "@/lib/android-native";
import { cn } from "@/lib/utils";
import DeckPage from "./page.tsx";
import VisoStateScreen from "./_components/viso-state-screen.tsx";
import SpotifyScreen from "./_components/spotify-screen.tsx";
import StandbyScreen from "./_components/standby-screen.tsx";
import GoogleHomeColorsDialog from "./_components/google-home-colors-dialog.tsx";
import { useAndroidMedia } from "./_components/use-android-media.ts";
import {
  findVisoStatus,
  type VisoStateDefinition,
} from "./_lib/viso-states.ts";
import {
  deckErrorMessage,
  deckExtensionsEnabled,
  getDeckDeviceId,
} from "./_lib/deck-options.ts";
import { getGridPreferenceStorage } from "./_lib/grid.ts";

const SCREENS = [
  { id: "estados", name: "Estados VISO" },
  { id: "spotify", name: "Spotify" },
  { id: "standby", name: "Standby" },
] as const;
type Screen = (typeof SCREENS)[number]["id"];

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [standbySettingsOpen, setStandbySettingsOpen] = useState(false);
  const [lightsOpen, setLightsOpen] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const spotify = useAndroidMedia(
    screen === "spotify" && !editing,
    "com.spotify.music",
  );
  const standby = useAndroidMedia(screen === "standby" && !editing);
  const connected = connection.isWebSocketConnected;

  useEffect(() => {
    const handleBack = (event: Event) => {
      if (
        settingsOpen ||
        standbySettingsOpen ||
        lightsOpen ||
        editing ||
        fullscreen
      ) {
        event.preventDefault();
        if (lightsOpen) setLightsOpen(false);
        else if (standbySettingsOpen) setStandbySettingsOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        else if (editing) setEditing(false);
        else
          void immersive
            .exit()
            .then(() => setFullscreen(false))
            .catch(() => undefined);
      }
    };
    window.addEventListener("viso:android-back", handleBack);
    return () => {
      window.removeEventListener("viso:android-back", handleBack);
    };
  }, [editing, fullscreen, settingsOpen, standbySettingsOpen, lightsOpen]);

  useEffect(() => {
    if (!isAndroidNative()) return;
    let mounted = true;
    void immersive
      .enter()
      .then(() => {
        if (mounted) setFullscreen(true);
        else void immersive.exit().catch(() => undefined);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
      void immersive.exit().catch(() => undefined);
    };
  }, []);

  async function select(
    definition: VisoStateDefinition,
    knownId: Id<"statuses"> | null,
  ) {
    if (pendingRef.current) return;
    if (!connected) {
      toast.error("Sin conexión. Espera antes de cambiar el estado.");
      return;
    }
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
        if (!id)
          id = await createStatus({
            name: definition.name,
            color: definition.defaultColor,
            icon: definition.icon,
          });
      }
      if (deckExtensionsEnabled()) {
        const storage = getGridPreferenceStorage();
        const deviceId = isAndroidNative()
          ? await nativeDeck.getDeviceId()
          : storage
            ? getDeckDeviceId(storage)
            : crypto.randomUUID();
        await activateStatus({
          statusId: id,
          requestId: crypto.randomUUID(),
          deviceId,
        });
      } else await setActive({ statusId: id });
    } catch (error) {
      toast.error(deckErrorMessage(error));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function toggleFullscreen() {
    try {
      if (isAndroidNative()) {
        if (fullscreen) await immersive.exit();
        else await immersive.enter();
        setFullscreen(!fullscreen);
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
        setFullscreen(false);
      } else {
        await document.documentElement.requestFullscreen();
        setFullscreen(true);
      }
    } catch (error) {
      toast.error(deckErrorMessage(error));
    }
  }

  if (user === undefined || statusData === undefined)
    return (
      <div
        className="viso-safe-screen flex h-dvh items-center justify-center"
        role="status"
      >
        Cargando VISO Deck…
      </div>
    );
  if (!user || !statusData)
    return (
      <div className="viso-safe-screen flex h-dvh flex-col items-center justify-center gap-4">
        <p>Inicia sesión para usar tu Deck.</p>
        <Button asChild>
          <Link to="/">Volver al inicio</Link>
        </Button>
      </div>
    );
  if (editing)
    return (
      <div className="relative h-dvh">
        <DeckPage />
        <Button
          className="fixed bottom-[max(var(--viso-safe-bottom),1rem)] left-1/2 z-40 -translate-x-1/2 shadow-lg"
          onClick={() => setEditing(false)}
        >
          Volver a Estados VISO
        </Button>
      </div>
    );
  const activeStatus =
    statusData.statuses.find(
      (status) => status._id === statusData.activeStatusId,
    ) ?? null;
  const pageIndex = SCREENS.findIndex((item) => item.id === screen);
  return (
    <div
      className="viso-safe-screen relative flex h-dvh min-h-0 flex-col overflow-hidden bg-black p-1.5"
      style={{
        paddingTop: "calc(var(--viso-safe-top, 0px) + 2.75rem)",
        paddingBottom: "max(var(--viso-safe-bottom, 0px),0.375rem)",
        paddingLeft: "max(var(--viso-safe-left, 0px),0.375rem)",
        paddingRight: "max(var(--viso-safe-right, 0px),0.375rem)",
      }}
    >
      <header
        className="pointer-events-none absolute inset-x-0 z-20 flex items-center justify-between"
        style={{
          top: "var(--viso-safe-top, 0px)",
          paddingLeft: "var(--viso-safe-left, 0px)",
          paddingRight: "var(--viso-safe-right, 0px)",
        }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="pointer-events-auto h-11 min-w-11 gap-1.5 px-3 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-1 focus-visible:ring-white/50"
              aria-label={`Cambiar pantalla. Página ${pageIndex + 1} de 3: ${SCREENS[pageIndex].name}`}
            >
              {String(pageIndex + 1).padStart(2, "0")}
              <span
                role="status"
                aria-label={
                  pending
                    ? "Esperando confirmación"
                    : connected
                      ? "Conectado a VISO"
                      : "Sin conexión"
                }
                className={cn(
                  "size-1 shrink-0 rounded-full",
                  connected ? "bg-green-400" : "bg-amber-400",
                )}
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            aria-label="Pantallas predeterminadas del Deck"
          >
            {SCREENS.map((item, index) => (
              <DropdownMenuItem
                key={item.id}
                className="min-h-11 gap-3"
                aria-current={screen === item.id ? "page" : undefined}
                onSelect={() => setScreen(item.id)}
              >
                <span className="text-xs text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {item.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon"
          className="pointer-events-auto size-11 text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-1 focus-visible:ring-white/50"
          aria-label="Ajustes"
          onClick={() => setSettingsOpen(true)}
        >
          <Star className="size-4" />
        </Button>
      </header>
      <main
        className="min-h-0 min-w-0 flex-1 overflow-hidden"
        aria-label={SCREENS[pageIndex].name}
        onTouchStart={(event) => {
          const target = event.target;
          if (
            event.touches.length !== 1 ||
            (target instanceof Element &&
              target.closest(
                "button, input, select, textarea, a, [role='slider']",
              ))
          ) {
            touchStart.current = null;
            return;
          }
          touchStart.current = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY,
          };
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start || !event.changedTouches[0]) return;
          const dx = event.changedTouches[0].clientX - start.x;
          const dy = event.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.5)
            setScreen(
              SCREENS[(pageIndex + (dx < 0 ? 1 : 2)) % SCREENS.length].id,
            );
        }}
        onTouchCancel={() => {
          touchStart.current = null;
        }}
      >
        {screen === "estados" && (
          <VisoStateScreen
            statuses={statusData.statuses}
            activeStatusId={statusData.activeStatusId}
            pending={pending}
            connected={connected}
            onSelect={(definition, id) => void select(definition, id)}
          />
        )}
        {screen === "spotify" && (
          <SpotifyScreen
            media={spotify.media}
            loading={spotify.loading}
            error={spotify.error}
            pending={spotify.pending}
            onCommand={spotify.command}
            onRequestAccess={spotify.requestAccess}
            onRefresh={spotify.refresh}
          />
        )}
        {screen === "standby" && (
          <StandbyScreen
            key={user._id}
            userId={user._id}
            media={standby.media}
            mediaLoading={standby.loading}
            activeStatus={activeStatus}
            connected={connected}
            onMediaCommand={standby.command}
            mediaBusy={standby.pending}
            settingsOpen={standbySettingsOpen}
            onSettingsOpenChange={setStandbySettingsOpen}
          />
        )}
      </main>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajustes</DialogTitle>
            <DialogDescription>
              Personalizá VISO y sus conexiones.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button
              variant="secondary"
              className="min-h-11 justify-start"
              onClick={() => {
                setSettingsOpen(false);
                setLightsOpen(true);
              }}
            >
              <Lightbulb />
              Google Home
            </Button>
            <Button
              variant="secondary"
              className="min-h-11 justify-start"
              onClick={() => {
                setSettingsOpen(false);
                setScreen("standby");
                setStandbySettingsOpen(true);
              }}
            >
              <Clock />
              Personalizar Standby
            </Button>
            <Button
              variant="secondary"
              className="min-h-11 justify-start"
              onClick={() => {
                setSettingsOpen(false);
                setEditing(true);
              }}
            >
              <Pencil />
              Editar mis teclas guardadas
            </Button>
            <Button
              variant="secondary"
              className="min-h-11 justify-start"
              onClick={() => void toggleFullscreen()}
            >
              {fullscreen ? <Minimize /> : <Maximize />}
              {fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            </Button>
            <Button asChild variant="ghost" className="min-h-11 justify-start">
              <Link to="/">
                <ArrowLeft />
                Volver al inicio
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <GoogleHomeColorsDialog
        key={user._id}
        userId={user._id}
        open={lightsOpen}
        onOpenChange={setLightsOpen}
      />
    </div>
  );
}
