import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useRef, useState, useMemo } from "react";
import { useMutation, useQuery, useConvexConnectionState } from "convex/react";
import { useAuthToken } from "@convex-dev/auth/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import StandbyScreen from "./standby-screen";
import SpotifyScreen from "./spotify-screen";
import ExtendedScreen from "./extended-screen";
import { useAndroidMedia } from "./use-android-media";
import {
  loadStandbySettings,
  normalizeStandbySettings,
  standbySettingsKey,
} from "../_lib/standby-settings";
import {
  listStandbyPhotos,
  validateStandbyPhotoBatch,
} from "../_lib/standby-photos";
import { uploadKeyMedia } from "../_lib/upload-media";

export default function SharedPresetScreen({
  pageId,
  editing = false,
  active = true,
  settingsOpen,
  onSettingsOpenChange,
}: {
  pageId: Id<"deckPages">;
  editing?: boolean;
  active?: boolean;
  settingsOpen?: boolean;
  onSettingsOpenChange?(open: boolean): void;
}) {
  const [customizing, setCustomizing] = useState(false);
  const layout = useQuery(api.deck_layout.get, { unified: true });
  const statuses = useQuery(api.statuses.list, {});
  const user = useQuery(api.users.getCurrentUser, {});
  const configure = useMutation(api.deck_layout.configureScreen);
  const token = useAuthToken();
  const connection = useConvexConnectionState();
  const page = layout?.pages.find((page) => page._id === pageId);
  const media = useAndroidMedia(
    active,
    page?.kind === "spotify" ? "com.spotify.music" : undefined,
  );
  const migrated = useRef(false);
  useEffect(() => {
    if (!page || page.kind !== "standby" || !user || !token || migrated.current)
      return;
    migrated.current = true;
    // Keep local data intact; import old preferences/photos only when cloud is unset.
    void (async () => {
      if (
        !page.standbySettings &&
        localStorage.getItem(standbySettingsKey(user._id))
      ) {
        await configure({ pageId, settings: loadStandbySettings(user._id) });
      }
      if (!page.standbyPhotos) {
        const old = await listStandbyPhotos(user._id);
        if (old.length) {
          const ids = [];
          for (const photo of old)
            ids.push(
              (
                await uploadKeyMedia(
                  new File([photo.blob], "foto", { type: photo.blob.type }),
                  token,
                )
              ).storageId,
            );
          await configure({ pageId, photos: ids, photoOperation: "append" });
        }
      }
    })().catch(() =>
      toast.error(
        "No se pudieron sincronizar los ajustes anteriores. Tus fotos locales se conservan.",
      ),
    );
  }, [page, user, token, pageId, configure]);
  const settings = useMemo(
    () =>
      page?.standbySettings
        ? normalizeStandbySettings(page.standbySettings)
        : undefined,
    [page?.standbySettings],
  );
  const photos = useMemo(
    () =>
      (page?.standbyPhotoUrls ?? []).filter(
        (photo): photo is { id: Id<"_storage">; url: string } =>
          Boolean(photo.url),
      ),
    [page?.standbyPhotoUrls],
  );
  if (!page || !statuses || !user) return <p>Cargando página…</p>;
  if (
    page.kind === "weather" ||
    page.kind === "visualizer" ||
    page.kind === "sports"
  )
    return <ExtendedScreen page={page} active={active} editing={editing} />;
  if (page.kind === "spotify")
    return (
      <>
        <div className={editing ? "h-full" : "h-full [&_button]:hidden"}>
          <SpotifyScreen
            media={media.media}
            loading={media.loading}
            error={media.error}
            pending={media.pending}
            onCommand={media.command}
            onRequestAccess={media.requestAccess}
            onRefresh={media.refresh}
          />
        </div>
        <Dialog
          open={settingsOpen ?? customizing}
          onOpenChange={(open) => {
            setCustomizing(open);
            onSettingsOpenChange?.(open);
          }}
        >
          <DialogContent management>
            <DialogHeader>
              <DialogTitle>Spotify</DialogTitle>
            </DialogHeader>
            <SpotifyScreen
              media={media.media}
              loading={media.loading}
              error={media.error}
              pending={media.pending}
              onCommand={media.command}
              onRequestAccess={media.requestAccess}
              onRefresh={media.refresh}
            />
          </DialogContent>
        </Dialog>
      </>
    );
  const activeStatus =
    statuses.statuses.find(
      (status) => status._id === statuses.activeStatusId,
    ) ?? null;
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      {editing && (
        <button
          type="button"
          className="relative z-10 shrink-0 rounded-md border p-2"
          onClick={() => setCustomizing(true)}
        >
          Personalizar Reloj
        </button>
      )}
      <div
        className={
          editing
            ? "min-h-0 flex-1 overflow-hidden"
            : "min-h-0 flex-1 overflow-hidden [&_button]:hidden"
        }
      >
        <StandbyScreen
          userId={user._id}
          media={media.media}
          mediaLoading={media.loading}
          activeStatus={activeStatus}
          connected={connection.isWebSocketConnected}
          mediaBusy={media.pending}
          onMediaCommand={media.command}
          settingsOpen={settingsOpen ?? customizing}
          onSettingsOpenChange={(open) => {
            setCustomizing(open);
            onSettingsOpenChange?.(open);
          }}
          sharedSettings={settings}
          sharedPhotos={page.standbyPhotos ? photos : undefined}
          onSettingsChange={(patch) => configure({ pageId, settings: patch })}
          onAddPhotos={async (files) => {
            const invalid = validateStandbyPhotoBatch(
              photos.map(() => ({ blob: new Blob([]) })),
              files,
            );
            if (invalid) throw new Error(invalid);
            const ids: Id<"_storage">[] = [];
            for (const file of files)
              ids.push((await uploadKeyMedia(file, token)).storageId);
            await configure({ pageId, photos: ids, photoOperation: "append" });
          }}
          onDeletePhoto={(id) =>
            configure({
              pageId,
              photos: [id as Id<"_storage">],
              photoOperation: "remove",
            })
          }
        />
      </div>
    </div>
  );
}
