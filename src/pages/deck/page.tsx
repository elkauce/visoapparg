import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Link } from "react-router-dom";
import { ArrowLeft, Maximize, Minimize, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import DeckKey from "./_components/deck-key.tsx";
import KeyEditor, { type EditTarget } from "./_components/key-editor.tsx";
import SportsDialog from "./_components/sports-dialog.tsx";
import { ClockTile, WeatherTile } from "./_components/widget-tiles.tsx";
import { resolveKeyFace, type KeyContent } from "./_lib/resolve-key.ts";

const SLOTS = 15;
const COLUMNS = 5;

type LiveTileProps = {
  content: KeyContent;
  editMode: boolean;
  onPress: () => void;
};

// Widgets con contenido en vivo (no son botones de acción)
function LiveTile({ content, editMode, onPress }: LiveTileProps) {
  if (content.kind === "weather") {
    return (
      <WeatherTile
        label={content.label}
        latitude={content.latitude}
        longitude={content.longitude}
        editMode={editMode}
        onPress={onPress}
      />
    );
  }
  return <ClockTile editMode={editMode} onPress={onPress} />;
}

function errorMessage(error: unknown): string {
  return error instanceof ConvexError
    ? (error.data as { message: string }).message
    : "Algo salió mal, inténtalo de nuevo";
}

// Deck a pantalla completa: cuadrícula de teclas por página, con páginas navegables
export default function DeckPage() {
  const layout = useQuery(api.deck_layout.get, {});
  const statusData = useQuery(api.statuses.list, {});
  const ensureDefault = useMutation(api.deck_layout.ensureDefault);
  const createPage = useMutation(api.deck_layout.createPage);
  const removePage = useMutation(api.deck_layout.removePage);
  const setActive = useMutation(api.statuses.setActive);
  const adjustVolume = useMutation(api.display.adjustVolume);

  const [pageId, setPageId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [target, setTarget] = useState<EditTarget | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sportsLeague, setSportsLeague] = useState<string | null>(null);

  // Primera vez: crea la página principal con los estados existentes
  const needsDefault = layout !== undefined && layout !== null && layout.pages.length === 0;
  useEffect(() => {
    if (needsDefault && statusData) {
      ensureDefault({}).catch(() => toast.error("No se pudo preparar tu deck"));
    }
  }, [needsDefault, statusData, ensureDefault]);

  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen().catch(() => undefined);
    }
  }, []);

  if (layout === undefined || statusData === undefined) {
    return (
      <div className="grid h-screen grid-cols-5 gap-3 p-4">
        {Array.from({ length: SLOTS }).map((_, i) => (
          <Skeleton key={i} className="rounded-2xl" />
        ))}
      </div>
    );
  }

  if (layout === null || statusData === null) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold">Inicia sesión para usar tu deck</p>
        <Button asChild>
          <Link to="/">Volver al inicio</Link>
        </Button>
      </div>
    );
  }

  const { pages, keys } = layout;
  const currentPage = pages.find((p) => p._id === pageId) ?? pages[0];
  if (!currentPage) {
    return <Skeleton className="h-screen w-full" />;
  }
  const pageKeys = keys.filter((k) => k.pageId === currentPage._id);
  const activeStatusId = statusData.activeStatusId;

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const pressKey = (position: number) => {
    const key = pageKeys.find((k) => k.position === position);
    if (editMode || !key) {
      setTarget({
        pageId: currentPage._id,
        position,
        keyId: key?._id ?? null,
        content: key?.content ?? null,
      });
      return;
    }
    const content = key.content;
    if (content.kind === "status") {
      void run(() => setActive({ statusId: content.statusId }));
    } else if (content.kind === "off") {
      void run(() => setActive({ statusId: null }));
    } else if (content.kind === "link") {
      window.open(content.url, "_blank", "noopener,noreferrer");
    } else if (content.kind === "folder") {
      setPageId(content.targetPageId);
    } else if (content.kind === "sports") {
      setSportsLeague(content.league);
    } else if (content.kind === "volume") {
      void run(() => adjustVolume({ action: content.action }));
    }
  };

  const handleAddPage = () => {
    void run(async () => {
      const id = await createPage({ name: `Página ${pages.length + 1}` });
      setPageId(id);
    });
  };

  const handleRemovePage = () => {
    void run(async () => {
      await removePage({ pageId: currentPage._id as Id<"deckPages"> });
      setPageId(null);
    });
  };

  return (
    <div className="flex h-dvh flex-col gap-3 bg-background p-3 sm:p-4">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Volver">
          <Link to="/">
            <ArrowLeft />
          </Link>
        </Button>
        <nav className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          {pages.map((page) => (
            <button
              key={page._id}
              type="button"
              onClick={() => setPageId(page._id)}
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
            <Button variant="ghost" size="icon" aria-label="Nueva página" onClick={handleAddPage}>
              <Plus />
            </Button>
          )}
        </nav>
        {editMode && pages.length > 1 && (
          <Button variant="ghost" size="icon" aria-label="Borrar esta página" onClick={handleRemovePage}>
            <Trash2 />
          </Button>
        )}
        <Button
          variant={editMode ? "default" : "secondary"}
          size="sm"
          onClick={() => setEditMode((e) => !e)}
        >
          <Pencil /> {editMode ? "Listo" : "Editar"}
        </Button>
        <Button variant="secondary" size="icon" aria-label="Pantalla completa" onClick={toggleFullscreen}>
          {isFullscreen ? <Minimize /> : <Maximize />}
        </Button>
      </header>

      <main
        className="grid min-h-0 flex-1 gap-3"
        style={{
          gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${SLOTS / COLUMNS}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: SLOTS }).map((_, position) => {
          const key = pageKeys.find((k) => k.position === position);
          const onPress = () => pressKey(position);
          if (key && (key.content.kind === "clock" || key.content.kind === "weather")) {
            return (
              <LiveTile key={position} content={key.content} editMode={editMode} onPress={onPress} />
            );
          }
          const face = key
            ? resolveKeyFace(key.content, statusData.statuses, activeStatusId, layout.volume)
            : null;
          return <DeckKey key={position} face={face} editMode={editMode} onPress={onPress} />;
        })}
      </main>

      <SportsDialog league={sportsLeague} onClose={() => setSportsLeague(null)} />

      <KeyEditor
        target={target}
        statuses={statusData.statuses}
        pages={pages}
        onClose={() => setTarget(null)}
      />
    </div>
  );
}
