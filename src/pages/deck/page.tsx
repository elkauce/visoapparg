import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useConvexConnectionState, useMutation, useQuery } from "convex/react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  actions,
  immersive,
  isAndroidNative,
  nativeDeck,
} from "@/lib/android-native.ts";
import { cn } from "@/lib/utils.ts";
import DeckKey from "./_components/deck-key.tsx";
import CanvasBackdrop from "./_components/canvas-backdrop.tsx";
import KeyEditor, { type EditTarget } from "./_components/key-editor.tsx";
import PageSettings from "./_components/page-settings.tsx";
import SportsDialog from "./_components/sports-dialog.tsx";
import { ClockTile, WeatherTile } from "./_components/widget-tiles.tsx";
import { resolveKeyFace, type KeyContent } from "./_lib/resolve-key.ts";
import {
  deckErrorMessage,
  deckExtensionsEnabled,
  getDeckDeviceId,
} from "./_lib/deck-options.ts";
import { runDeckAction } from "./_lib/action-runner.ts";
import {
  getGridPreferenceStorage,
  readSavedGridPreference,
  DEFAULT_GRID_PREFERENCE,
  resolveDeckGrid,
  writeGridPreference,
  type GridPreference,
} from "./_lib/grid.ts";

type LiveTileProps = {
  content: KeyContent;
  editMode: boolean;
  onPress: () => void;
  canvas?: boolean;
};

function LiveTile({ content, editMode, onPress, canvas }: LiveTileProps) {
  if (content.kind === "weather") {
    return (
      <WeatherTile
        label={content.label}
        latitude={content.latitude}
        longitude={content.longitude}
        editMode={editMode}
        onPress={onPress}
        canvas={canvas}
      />
    );
  }
  return <ClockTile editMode={editMode} onPress={onPress} canvas={canvas} />;
}

// The original keys, status colours and page order come directly from Convex.
// A press never marks a status active locally: only confirmed query data does.
export default function DeckPage() {
  const layout = useQuery(api.deck_layout.get, {});
  const statusData = useQuery(api.statuses.list, {});
  const connection = useConvexConnectionState();
  const ensureDefault = useMutation(api.deck_layout.ensureDefault);
  const createDefaults = useMutation(api.statuses.createDefaults);
  const createPage = useMutation(api.deck_layout.createPage);
  const renamePage = useMutation(api.deck_layout.renamePage);
  const removePage = useMutation(api.deck_layout.removePage);
  const configurePage = useMutation(api.deck_layout.configurePage);
  const duplicatePage = useMutation(api.deck_layout.duplicatePage);
  const reorderPages = useMutation(api.deck_layout.reorderPages);
  const setActive = useMutation(api.statuses.setActive);
  const activateStatus = useMutation(api.deck_actions.activateStatus);
  const adjustVolume = useMutation(api.display.adjustVolume);
  const publicLink = useQuery(api.public_status.getMine, {});
  const navigate = useNavigate();
  const advanced = deckExtensionsEnabled();
  const connected = connection.isWebSocketConnected;

  const [pageId, setPageId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [target, setTarget] = useState<EditTarget | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sportsLeague, setSportsLeague] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [view, setView] = useState({ pageId: "", index: 0 });
  const [preferences, setPreferences] = useState<
    Record<string, GridPreference>
  >({});
  const [gridElement, setGridElement] = useState<HTMLElement | null>(null);
  const [available, setAvailable] = useState(() => ({
    width: Math.max(96, window.innerWidth - 32),
    height: Math.max(96, window.innerHeight - 96),
  }));

  useEffect(() => {
    if (!gridElement) return;
    const measure = () => {
      const rectangle = gridElement.getBoundingClientRect();
      if (rectangle.width > 0 && rectangle.height > 0) {
        setAvailable((current) =>
          current.width === rectangle.width &&
          current.height === rectangle.height
            ? current
            : { width: rectangle.width, height: rectangle.height },
        );
      }
    };
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(gridElement);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [gridElement]);

  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  // Native immersion is restored when leaving the Deck, including the Android
  // Back gesture and navigation to configuration.
  useEffect(
    () => () => {
      if (isAndroidNative()) void immersive.exit().catch(() => undefined);
    },
    [],
  );

  useEffect(() => {
    const onBack = (event: Event) => {
      if (isFullscreen && isAndroidNative()) {
        event.preventDefault();
        void immersive
          .exit()
          .then(() => setIsFullscreen(false))
          .catch((error: unknown) => toast.error(deckErrorMessage(error)));
      }
    };
    window.addEventListener("viso:android-back", onBack);
    return () => window.removeEventListener("viso:android-back", onBack);
  }, [isFullscreen]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (isAndroidNative()) {
        if (isFullscreen) await immersive.exit();
        else await immersive.enter();
        setIsFullscreen(!isFullscreen);
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      toast.error(
        deckErrorMessage(error, "La pantalla completa no está disponible"),
      );
    }
  }, [isFullscreen]);

  const run = async (
    operation: () => Promise<unknown>,
    needsConnection = true,
  ) => {
    if (pendingRef.current) return;
    if (needsConnection && !connected) {
      toast.error(
        "Sin conexión. Espera la reconexión antes de guardar o cambiar el estado.",
      );
      return;
    }
    pendingRef.current = true;
    setPending(true);
    try {
      await operation();
    } catch (error) {
      toast.error(deckErrorMessage(error));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  if (layout === undefined || statusData === undefined) {
    const loadingGrid = resolveDeckGrid({
      slots: 15,
      preferredColumns: 5,
      viewportWidth: available.width,
      viewportHeight: available.height,
    });
    return (
      <div
        className="grid h-dvh gap-3 p-4"
        style={{
          gridTemplateColumns: `repeat(${loadingGrid.columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${loadingGrid.rows}, minmax(96px, 1fr))`,
        }}
        aria-label="Cargando Deck"
      >
        {Array.from({ length: 15 }).map((_, i) => (
          <Skeleton key={i} className="rounded-2xl" />
        ))}
      </div>
    );
  }

  if (layout === null || statusData === null) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold">Inicia sesión para usar tu deck</p>
        <Button asChild>
          <Link to="/">Volver al inicio</Link>
        </Button>
      </div>
    );
  }

  const { pages, keys } = layout;
  const currentPage = pages.find((page) => page._id === pageId) ?? pages[0];
  if (!currentPage) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold">Prepara tu VISO Deck</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Crea la página principal con tus estados actuales. Si tu cuenta es
          nueva, se prepararán los estados originales de VISO.
        </p>
        <Button
          disabled={pending || !connected}
          onClick={() =>
            void run(async () => {
              if (statusData.statuses.length === 0) await createDefaults({});
              await ensureDefault({});
            })
          }
        >
          {pending ? "Preparando…" : "Preparar Deck"}
        </Button>
        <Button asChild variant="ghost">
          <Link to="/">Volver al inicio</Link>
        </Button>
      </div>
    );
  }

  const pageKeys = keys.filter((key) => key.pageId === currentPage._id);
  const accountId = currentPage.userId;
  const preference =
    preferences[currentPage._id] ??
    readSavedGridPreference(
      getGridPreferenceStorage(),
      accountId,
      currentPage._id,
    ) ??
    (currentPage.grid
      ? {
          slots: currentPage.grid.columns * currentPage.grid.rows,
          columns: currentPage.grid.columns,
        }
      : DEFAULT_GRID_PREFERENCE);
  const capacity = Math.max(
    currentPage.grid ? currentPage.grid.columns * currentPage.grid.rows : 15,
    ...pageKeys.map((key) => key.position + 1),
  );
  const viewCount = Math.ceil(capacity / preference.slots);
  const viewIndex = Math.min(
    view.pageId === currentPage._id ? view.index : 0,
    viewCount - 1,
  );
  const positionOffset = viewIndex * preference.slots;
  const grid = resolveDeckGrid({
    slots: preference.slots,
    preferredColumns: preference.columns,
    viewportWidth: available.width,
    viewportHeight: available.height,
  });
  const activeStatusId = statusData.activeStatusId;

  const selectStatus = async (statusId: Id<"statuses"> | null) => {
    if (!connected)
      throw new Error(
        "Sin conexión. Espera la reconexión antes de cambiar el estado.",
      );
    if (advanced) {
      const storage = getGridPreferenceStorage();
      const deviceId = isAndroidNative()
        ? await nativeDeck.getDeviceId()
        : storage
          ? getDeckDeviceId(storage)
          : crypto.randomUUID();
      await activateStatus({
        statusId,
        requestId: crypto.randomUUID(),
        deviceId,
      });
    } else {
      await setActive({ statusId });
    }
  };

  const openUrl = async (url: string) => {
    if (isAndroidNative()) return actions.openUrl(url);
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol))
      throw new Error("El enlace debe usar HTTP o HTTPS.");
    window.open(parsed.href, "_blank", "noopener,noreferrer");
  };

  const pressKey = (position: number) => {
    const key = pageKeys.find((item) => item.position === position);
    if (editMode || !key) {
      if (!advanced && position >= 15) {
        toast.error(
          "Esta posición requiere la actualización del servidor del Deck.",
        );
        return;
      }
      setTarget({
        pageId: currentPage._id,
        position,
        keyId: key?._id ?? null,
        content: key?.content ?? null,
        appearance: key?.appearance,
      });
      return;
    }
    const content = key.content;
    if (content.kind === "folder") {
      if (pages.some((page) => page._id === content.targetPageId))
        setPageId(content.targetPageId);
      else toast.error("La página de esta carpeta ya no está disponible");
    } else if (content.kind === "sports") {
      setSportsLeague(content.league);
    } else if (content.kind === "link") {
      void run(() => openUrl(content.url), false);
    } else if (content.kind === "status") {
      void run(() => selectStatus(content.statusId));
    } else if (content.kind === "off") {
      void run(() => selectStatus(null));
    } else if (content.kind === "volume") {
      void run(() => adjustVolume({ action: content.action }));
    } else if (content.kind === "action") {
      void run(
        () =>
          runDeckAction(content.action, {
            openDisplay: async () => {
              if (!publicLink)
                throw new Error(
                  "Crea primero el enlace de tu Display en Configuración.",
                );
              navigate(`/s/${publicLink}`);
            },
            openUrl,
            openApp: actions.openApp,
            media: actions.media,
            setStatus: selectStatus,
            selectPage: async (id) => {
              if (!pages.some((page) => page._id === id))
                throw new Error("La página ya no está disponible");
              setPageId(id);
            },
            rgb: async (action) => {
              if (!isAndroidNative())
                throw new Error(
                  "Esta acción RGB requiere Android y una integración Home Assistant autorizada.",
                );
              if (action.command === "scene")
                throw new Error(
                  "Las escenas RGB aún no están disponibles. Configura una acción de color, brillo o encendido.",
                );
              const lights = await nativeDeck.getHomeAssistantLights();
              const light = lights.find((item) => item.id === action.deviceId);
              if (!light)
                throw new Error(
                  "La lámpara no está disponible en la integración autorizada.",
                );
              if (action.command === "color" && !light.supportsColor)
                throw new Error("Esta lámpara no admite color RGB.");
              const result = await nativeDeck.controlLight(
                action.deviceId,
                action.command === "color"
                  ? { color: action.color }
                  : action.command === "brightness"
                    ? { brightness: action.brightness }
                    : { on: action.on },
              );
              if (!result.success)
                throw new Error("La lámpara no confirmó la operación.");
            },
          }),
        false,
      );
    }
  };

  const gridStyle = {
    height: "100%",
    minHeight: grid.minHeight,
    minWidth: grid.minWidth,
    gridTemplateColumns: `repeat(${grid.columns}, minmax(96px, 1fr))`,
    gridTemplateRows: `repeat(${grid.rows}, minmax(96px, 1fr))`,
    "--deck-icon-limit": `${Math.max(32, Math.min(grid.tileWidth - 16, grid.tileHeight - 24 - 2.5 * Math.min(24, Math.max(14, Math.min(grid.tileWidth, grid.tileHeight) * 0.16))))}px`,
    "--deck-text-limit": `${Math.max(14, Math.min(grid.tileWidth, grid.tileHeight) * 0.16)}px`,
    "--deck-widget-number-limit": `${Math.max(24, Math.min(grid.tileWidth, grid.tileHeight) * 0.25)}px`,
  } as CSSProperties;
  const canvas = currentPage.canvas?.mediaUrl ? currentPage.canvas : null;

  return (
    <div
      className="flex h-dvh flex-col gap-3 bg-background p-3 [--deck-padding:0.75rem] sm:p-4 sm:[--deck-padding:1rem]"
      style={{
        paddingTop: "max(env(safe-area-inset-top), var(--deck-padding))",
        paddingBottom: "max(env(safe-area-inset-bottom), var(--deck-padding))",
        paddingLeft: "max(env(safe-area-inset-left), var(--deck-padding))",
        paddingRight: "max(env(safe-area-inset-right), var(--deck-padding))",
      }}
    >
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Volver">
          <Link to="/">
            <ArrowLeft />
          </Link>
        </Button>
        <nav
          aria-label="Páginas del Deck"
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto"
        >
          {pages.map((page) => (
            <button
              key={page._id}
              type="button"
              onClick={() => setPageId(page._id)}
              aria-current={page._id === currentPage._id ? "page" : undefined}
              className={cn(
                "shrink-0 cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                page._id === currentPage._id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent",
              )}
            >
              {page.name}
            </button>
          ))}
          {editMode && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Nueva página"
              disabled={pending || !connected}
              onClick={() =>
                void run(async () => {
                  const id = await createPage({
                    name: `Página ${pages.length + 1}`,
                  });
                  setPageId(id);
                })
              }
            >
              <Plus />
            </Button>
          )}
        </nav>
        <span
          role="status"
          aria-live="polite"
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            connected ? "bg-green-500" : "bg-amber-500",
          )}
          aria-label={
            pending
              ? "Esperando confirmación"
              : connected
                ? "Conectado a VISO"
                : connection.hasEverConnected
                  ? "Reconectando con VISO"
                  : "Conectando con VISO"
          }
          title={
            pending
              ? "Esperando confirmación"
              : connected
                ? "Conectado a VISO"
                : "Reconectando con VISO"
          }
        />
        {editMode && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Página y cuadrícula"
            disabled={pending}
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 />
          </Button>
        )}
        {editMode && pages.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Borrar esta página"
            disabled={pending || !connected}
            onClick={() =>
              void run(async () => {
                await removePage({ pageId: currentPage._id });
                setPageId(null);
              })
            }
          >
            <Trash2 />
          </Button>
        )}
        <Button
          variant={editMode ? "default" : "secondary"}
          size="sm"
          onClick={() => setEditMode((editing) => !editing)}
        >
          <Pencil /> {editMode ? "Listo" : "Editar"}
        </Button>
        <Button
          variant="secondary"
          size="icon"
          aria-label={
            isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"
          }
          onClick={toggleFullscreen}
        >
          {isFullscreen ? <Minimize /> : <Maximize />}
        </Button>
      </header>
      <main
        ref={setGridElement}
        className="min-h-0 flex-1"
        style={{
          overflowY: grid.overflowY ? "auto" : "visible",
          overflowX: grid.overflowX ? "auto" : "visible",
        }}
        aria-label="Teclas del Deck"
      >
        <div className="relative grid gap-3" style={gridStyle}>
          {canvas?.mediaUrl && (
            <CanvasBackdrop
              mediaUrl={canvas.mediaUrl}
              mediaType={canvas.mediaType ?? "image"}
              columns={grid.columns}
              tileWidth={grid.tileWidth}
              tileHeight={grid.tileHeight}
              gap={grid.gap}
              positions={pageKeys
                .map((key) => key.position - positionOffset)
                .filter(
                  (position) => position >= 0 && position < preference.slots,
                )}
            />
          )}
          {Array.from({ length: preference.slots }).map((_, slot) => {
            const position = positionOffset + slot;
            const key = pageKeys.find((item) => item.position === position);
            const onPress = () => pressKey(position);
            if (
              key &&
              (key.content.kind === "clock" ||
                key.content.kind === "weather") &&
              !key.appearance
            )
              return (
                <LiveTile
                  key={position}
                  content={key.content}
                  editMode={editMode}
                  onPress={onPress}
                  canvas={!!canvas}
                />
              );
            const face = key
              ? resolveKeyFace(
                  key.content,
                  statusData.statuses,
                  activeStatusId,
                  layout.volume,
                  key.appearance,
                )
              : null;
            const requiresConnection =
              key &&
              (key.content.kind === "status" ||
                key.content.kind === "off" ||
                key.content.kind === "volume");
            return (
              <DeckKey
                key={position}
                face={face}
                editMode={editMode && (advanced || position < 15)}
                onPress={onPress}
                disabled={
                  !editMode && (pending || (!!requiresConnection && !connected))
                }
                pending={!editMode && pending}
                canvas={!!canvas}
              />
            );
          })}
        </div>
      </main>
      {viewCount > 1 && (
        <nav
          aria-label="Vistas de la página"
          className="flex items-center justify-center gap-2"
        >
          <Button
            variant="ghost"
            size="icon"
            aria-label="Vista anterior"
            disabled={viewIndex === 0}
            onClick={() =>
              setView({ pageId: currentPage._id, index: viewIndex - 1 })
            }
          >
            <ChevronLeft />
          </Button>
          <span className="text-xs text-muted-foreground">
            {viewIndex + 1} / {viewCount}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Vista siguiente"
            disabled={viewIndex + 1 >= viewCount}
            onClick={() =>
              setView({ pageId: currentPage._id, index: viewIndex + 1 })
            }
          >
            <ChevronRight />
          </Button>
        </nav>
      )}
      <SportsDialog
        league={sportsLeague}
        onClose={() => setSportsLeague(null)}
      />
      <KeyEditor
        target={target}
        statuses={statusData.statuses}
        pages={pages}
        keys={keys}
        connected={connected}
        advanced={advanced}
        onClose={() => setTarget(null)}
      />
      {settingsOpen && (
        <PageSettings
          key={currentPage._id}
          page={currentPage}
          pages={pages}
          preference={preference}
          advanced={advanced}
          connected={connected}
          canvas={currentPage.canvas}
          onClose={() => setSettingsOpen(false)}
          onSave={async (name, chosenGrid, canvasMedia) => {
            if (name !== currentPage.name)
              await renamePage({ pageId: currentPage._id, name });
            if (
              advanced &&
              (chosenGrid.slots !== preference.slots ||
                chosenGrid.columns !== preference.columns ||
                canvasMedia !== undefined)
            )
              await configurePage({
                pageId: currentPage._id,
                grid: {
                  columns: chosenGrid.columns,
                  rows: Math.ceil(chosenGrid.slots / chosenGrid.columns),
                },
                ...(canvasMedia !== undefined ? { canvas: canvasMedia } : {}),
              });
            setPreferences((previous) => ({
              ...previous,
              [currentPage._id]: chosenGrid,
            }));
            if (
              !writeGridPreference(
                getGridPreferenceStorage(),
                accountId,
                currentPage._id,
                chosenGrid,
              ) &&
              !advanced
            )
              toast.info(
                "La distribución se aplicó, pero el almacenamiento de este dispositivo no está disponible.",
              );
          }}
          onDuplicate={async () => {
            const id = await duplicatePage({ pageId: currentPage._id });
            setPageId(id);
          }}
          onReorder={async (direction) => {
            const ids = pages.map((page) => page._id);
            const index = ids.indexOf(currentPage._id);
            const neighbor = index + direction;
            if (neighbor < 0 || neighbor >= ids.length) return;
            [ids[index], ids[neighbor]] = [ids[neighbor], ids[index]];
            await reorderPages({ pageIds: ids });
          }}
        />
      )}
    </div>
  );
}
