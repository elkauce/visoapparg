import { useEffect, useRef, useState } from "react";
import { useConvexConnectionState, useMutation, useQuery } from "convex/react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Lightbulb,
  Maximize,
  Minimize,
  Pencil,
  Plus,
  Plug,
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
import { immersive, isAndroidNative, nativeDeck } from "@/lib/android-native";
import { cn } from "@/lib/utils";
import DeckPage from "./page.tsx";
import StreamDeckPanel from "../_components/stream-deck-panel.tsx";
import PresenceSettings from "./_components/presence-settings";
import GoogleHomeColorsDialog from "./_components/google-home-colors-dialog.tsx";
import DeckSlide from "./_components/deck-slide.tsx";
import { deckErrorMessage } from "./_lib/deck-options.ts";
import SharedPresetScreen from "./_components/shared-preset-screen";

type Screen = string;

/** Three defaults followed by the account’s saved pages, with the original editor. */
export default function AndroidDeck() {
  const user = useQuery(api.users.getCurrentUser, {});
  const statusData = useQuery(api.statuses.list, {});
  const layout = useQuery(api.deck_layout.get, { unified: true });
  const ensureCatalogue = useMutation(api.deck_layout.ensureCatalogue);
  useEffect(() => {
    if (layout?.catalogReady === false)
      void ensureCatalogue({}).catch(() =>
        toast.error("No se pudieron sincronizar las páginas."),
      );
  }, [layout?.catalogReady, ensureCatalogue]);
  const createPage = useMutation(api.deck_layout.createPage);
  const connection = useConvexConnectionState();
  const [presenceOpen, setPresenceOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>("estados");
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [standbySettingsOpen, setStandbySettingsOpen] = useState(false);
  const [elgatoOpen, setElgatoOpen] = useState(false);
  const [lightsOpen, setLightsOpen] = useState(false);
  const connected = connection.isWebSocketConnected;

  useEffect(() => {
    const handleBack = (event: Event) => {
      if (
        elgatoOpen ||
        settingsOpen ||
        standbySettingsOpen ||
        lightsOpen ||
        editing ||
        fullscreen
      ) {
        event.preventDefault();
        if (elgatoOpen) setElgatoOpen(false);
        else if (lightsOpen) setLightsOpen(false);
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
  }, [
    editing,
    fullscreen,
    settingsOpen,
    standbySettingsOpen,
    lightsOpen,
    elgatoOpen,
  ]);

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
        <DeckPage startEditing fullEditor initialPageId={screen} />
        <Button
          className="fixed bottom-[max(var(--viso-safe-bottom),1rem)] left-1/2 z-40 -translate-x-1/2 shadow-lg"
          onClick={() => setEditing(false)}
        >
          Volver al Deck
        </Button>
      </div>
    );
  const screens = (layout?.pages ?? []).map((page) => ({
    id: page._id,
    name: page.name,
  }));
  if (!screens.length) return <p>Sincronizando tus páginas…</p>;
  const pageIndex = Math.max(
    0,
    screens.findIndex((item) => item.id === screen),
  );
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
        <span className="flex h-11 min-w-11 items-center gap-1.5 px-3 text-xs font-medium text-white/70">
          <span
            aria-label={`Página ${pageIndex + 1} de ${screens.length}`}
            aria-live="polite"
          >
            {String(pageIndex + 1).padStart(2, "0")}
          </span>
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
        </span>
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
      <DeckSlide
        index={pageIndex}
        pageKeys={screens.map((item) => item.id)}
        onIndexChange={(index) => setScreen(screens[index].id)}
        label={screens[pageIndex].name}
      >
        {(layout?.pages ?? []).map((page) =>
          page.kind && page.kind !== "grid" ? (
            <SharedPresetScreen
              key={page._id}
              pageId={page._id}
              active={screens[pageIndex].id === page._id}
              settingsOpen={
                screens[pageIndex].id === page._id ? standbySettingsOpen : false
              }
              onSettingsOpenChange={setStandbySettingsOpen}
            />
          ) : (
            <DeckPage
              key={page._id}
              embeddedPageId={page._id}
              onSelectPage={setScreen}
            />
          ),
        )}
      </DeckSlide>
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
              disabled={
                !connected || pending || (layout?.pages.length ?? 0) >= 11
              }
              onClick={() => {
                if (pendingRef.current) return;
                pendingRef.current = true;
                setPending(true);
                void createPage({
                  name: `Página ${(layout?.pages.length ?? 0) + 1}`,
                })
                  .then((id) => {
                    setScreen(id);
                    setSettingsOpen(false);
                    setEditing(true);
                  })
                  .catch((error: unknown) =>
                    toast.error(deckErrorMessage(error)),
                  )
                  .finally(() => {
                    pendingRef.current = false;
                    setPending(false);
                  });
              }}
            >
              <Plus /> Agregar página
            </Button>
            <Button
              variant="secondary"
              className="min-h-11 justify-start"
              onClick={() => {
                setSettingsOpen(false);
                setElgatoOpen(true);
              }}
            >
              <Plug /> Elgato Stream Deck
            </Button>
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
                setPresenceOpen(true);
              }}
            >
              <Clock />
              Estado automático: llamadas y agenda
            </Button>
            <Button
              variant="secondary"
              className="min-h-11 justify-start"
              onClick={() => {
                setSettingsOpen(false);
                const page = layout?.pages.find(
                  (page) => page.kind === "standby",
                );
                if (!page) return;
                setScreen(page._id);
                setStandbySettingsOpen(true);
              }}
            >
              <Clock />
              Personalizar Reloj
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
              Editar mis páginas y teclas
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
      <Dialog open={elgatoOpen} onOpenChange={setElgatoOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Elgato Stream Deck</DialogTitle>
            <DialogDescription>
              Vinculá tus teclas a tu cuenta VISO.
            </DialogDescription>
          </DialogHeader>
          {elgatoOpen && <StreamDeckPanel pluginOnly />}
        </DialogContent>
      </Dialog>
      <PresenceSettings
        key={`presence:${user._id}`}
        accountId={user._id}
        open={presenceOpen}
        onOpenChange={setPresenceOpen}
      />
      <GoogleHomeColorsDialog
        key={user._id}
        userId={user._id}
        open={lightsOpen}
        onOpenChange={setLightsOpen}
      />
    </div>
  );
}
