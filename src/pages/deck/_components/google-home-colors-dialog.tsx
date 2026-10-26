import { useCallback, useEffect, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import { isAndroidNative } from "@/lib/android-native.ts";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  googleHomeNative,
  notifyGoogleHomeConfigurationChanged,
  type GoogleHomeConfiguration,
  type GoogleHomeLight,
  type GoogleHomeStatus,
} from "@/lib/google-home-native.ts";
import { VISO_STATES } from "../_lib/viso-states.ts";
import { readGoogleHomeColors } from "../_lib/google-home-colors.ts";

interface Snapshot {
  status: GoogleHomeStatus | null;
  configuration: GoogleHomeConfiguration;
  configurationLoaded: boolean;
  configurationEdited: boolean;
  savedSelectedIds: string[];
  lights: GoogleHomeLight[];
  discovered: boolean;
  loading: boolean;
  error: string | null;
}

const errorMessage = (failure: unknown): string =>
  failure instanceof Error
    ? failure.message
    : "Google Home no pudo completar la operación.";

interface DialogProps {
  userId: string;
  open: boolean;
  onOpenChange(open: boolean): void;
}

/** Never expose a previous owner's configuration while a different account loads. */
export default function GoogleHomeColorsDialog(props: DialogProps) {
  return <GoogleHomeAccountDialog key={props.userId} {...props} />;
}

/** Configuration opens from Deck settings; every listed light is an SDK result. */
function GoogleHomeAccountDialog({ userId, open, onOpenChange }: DialogProps) {
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({
    status: null,
    configuration: {
      selectedIds: [],
      colorsByState: readGoogleHomeColors(userId),
      enabled: false,
      revision: "",
    },
    configurationLoaded: false,
    configurationEdited: false,
    savedSelectedIds: [],
    lights: [],
    discovered: false,
    loading: true,
    error: null,
  }));
  const [busy, setBusy] = useState(false);
  const operation = useRef<number | null>(null);
  const generation = useRef(0);
  const verificationRetries = useRef(0);

  const discover = useCallback(
    async (request: number) => {
      const result = await googleHomeNative.discoverLights({
        accountId: userId,
      });
      if (request !== generation.current) return;
      setSnapshot((current) => ({
        ...current,
        status: result,
        lights: result.lights.filter((light) => light.colorCapable === true),
        discovered: true,
        error: null,
      }));
    },
    [userId],
  );

  const recheck = useCallback(
    async (request: number) => {
      // A transient permission lookup must not discard an independently readable,
      // owner-scoped configuration or overwrite local edits made before resuming.
      const [statusResult, configurationResult] = await Promise.allSettled([
        googleHomeNative.getStatus({ accountId: userId }),
        googleHomeNative.getConfiguration({ accountId: userId }),
      ]);
      if (request !== generation.current) return;
      const status =
        statusResult.status === "fulfilled" ? statusResult.value : null;
      const configuration =
        configurationResult.status === "fulfilled"
          ? configurationResult.value
          : null;
      const failures = [statusResult, configurationResult]
        .filter((result) => result.status === "rejected")
        .map((result) =>
          errorMessage((result as PromiseRejectedResult).reason),
        );
      setSnapshot((current) => ({
        ...current,
        status,
        configuration:
          configuration && !current.configurationEdited
            ? configuration
            : current.configuration,
        configurationLoaded: !!configuration || current.configurationLoaded,
        savedSelectedIds:
          configuration?.selectedIds ?? current.savedSelectedIds,
        lights: [],
        discovered: false,
        loading: false,
        error: failures.length ? [...new Set(failures)].join(" ") : null,
      }));
      if (configuration) notifyGoogleHomeConfigurationChanged(userId);
      if (!failures.length && status?.available && status.authorized)
        await discover(request);
    },
    [discover, userId],
  );

  const perform = useCallback(
    async (task: (request: number) => Promise<void>) => {
      const request = generation.current;
      if (operation.current === request) return;
      operation.current = request;
      setBusy(true);
      try {
        await task(request);
      } catch (failure) {
        if (request === generation.current) {
          let status: GoogleHomeStatus | null = null;
          try {
            status = await googleHomeNative.getStatus({ accountId: userId });
          } catch {
            /* Keep permissions unverified if the official read also fails. */
          }
          if (request === generation.current)
            setSnapshot((current) => ({
              ...current,
              status,
              lights: [],
              discovered: false,
              loading: false,
              error: errorMessage(failure),
            }));
        }
      } finally {
        if (operation.current === request) {
          operation.current = null;
          if (request === generation.current) setBusy(false);
        }
      }
    },
    [userId],
  );

  useEffect(() => {
    const request = ++generation.current;
    if (!open) return;
    void Promise.resolve().then(async () => {
      if (generation.current !== request) return;
      setSnapshot((current) => ({
        ...current,
        status: null,
        lights: [],
        discovered: false,
        configurationEdited: false,
        loading: true,
        error: null,
      }));
      verificationRetries.current = 0;
      await perform(recheck);
    });
    return () => {
      generation.current += 1;
    };
  }, [open, perform, recheck]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    let listener: PluginListenerHandle | undefined;
    const refresh = () => {
      if (active && !document.hidden) {
        verificationRetries.current = 0;
        void perform(recheck);
      }
    };
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    if (isAndroidNative()) {
      void CapacitorApp.addListener("resume", refresh)
        .then((handle) => {
          if (active) listener = handle;
          else void handle.remove();
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      if (listener) void listener.remove();
    };
  }, [open, perform, recheck]);

  useEffect(() => {
    if (!open || busy || snapshot.loading) return;
    const needsRecheck =
      !snapshot.status?.requiresAuthorization &&
      (snapshot.status?.verificationPending ||
        (!!snapshot.error && (!snapshot.status || snapshot.status.authorized)));
    if (!needsRecheck) {
      verificationRetries.current = 0;
      return;
    }
    if (verificationRetries.current >= 2) return;
    const timer = window.setTimeout(
      () => {
        verificationRetries.current += 1;
        void perform(recheck);
      },
      1500 * (verificationRetries.current + 1),
    );
    return () => window.clearTimeout(timer);
  }, [open, busy, snapshot, perform, recheck]);

  const selected = snapshot.configuration.selectedIds;
  const verificationPending =
    snapshot.status?.verificationPending ?? !snapshot.status;
  const canAuthorize = !!(
    snapshot.status?.sdkPresent &&
    snapshot.status.available &&
    !verificationPending
  );
  const authorized = !!(
    snapshot.status?.authorized &&
    snapshot.status.available &&
    !snapshot.status.verificationPending &&
    !snapshot.status.requiresAuthorization
  );
  const missingSelected = snapshot.discovered
    ? selected.filter((id) => !snapshot.lights.some((light) => light.id === id))
    : [];
  const unavailableSaved = snapshot.discovered
    ? [...new Set([...snapshot.savedSelectedIds, ...selected])].filter(
        (id) => !snapshot.lights.some((light) => light.id === id),
      )
    : [];
  const canSave =
    !busy &&
    !snapshot.loading &&
    snapshot.configurationLoaded &&
    (authorized ||
      selected.every((id) => snapshot.savedSelectedIds.includes(id)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent management className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Luces Google Home</DialogTitle>
          <DialogDescription>
            Autoriza Google y elige únicamente las luces que usarás con tus
            estados VISO.
          </DialogDescription>
        </DialogHeader>
        {snapshot.loading ? (
          <p role="status" className="flex items-center gap-2 text-sm">
            <LoaderCircle className="size-4 animate-spin" />
            Consultando Google Home…
          </p>
        ) : (
          <div
            role="status"
            className="rounded-xl border border-border bg-secondary/40 p-3 text-sm"
          >
            {snapshot.status?.message ??
              "No se pudo verificar la conexión con Google Home."}
          </div>
        )}
        {snapshot.error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive"
          >
            {snapshot.error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy || snapshot.loading}
            onClick={() => {
              verificationRetries.current = 0;
              void perform(recheck);
            }}
          >
            <RefreshCw className="size-4" />
            Comprobar de nuevo
          </Button>
          <Button
            disabled={busy || snapshot.loading || !canAuthorize}
            onClick={() =>
              void perform(async (request) => {
                const status = await googleHomeNative.authorize({
                  accountId: userId,
                  ...(authorized ? { force: true } : {}),
                });
                if (request !== generation.current) return;
                setSnapshot((current) => ({ ...current, status, error: null }));
                notifyGoogleHomeConfigurationChanged(userId);
                if (status.authorized && status.available)
                  await discover(request);
              })
            }
          >
            {authorized
              ? "Revisar permisos de Google"
              : canAuthorize
                ? "Autorizar Google Home"
                : "Autorizar Google Home — pendiente"}
          </Button>
          {authorized && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void perform(discover)}
            >
              <RefreshCw className="size-4" />
              Actualizar luces
            </Button>
          )}
        </div>
        {authorized && (
          <fieldset
            className="space-y-2"
            disabled={busy || !snapshot.configurationLoaded}
          >
            <legend className="mb-2 text-sm font-semibold">
              Luces compatibles con color
            </legend>
            {snapshot.lights.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {snapshot.discovered
                  ? "Google no devolvió luces compatibles con cambio de color entre los dispositivos autorizados."
                  : "Consulta las luces autorizadas para seleccionar cuáles utilizar."}
              </p>
            ) : (
              snapshot.lights.map((light) => (
                <label
                  key={light.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl bg-secondary/50 px-3 py-3"
                >
                  <Checkbox
                    aria-label={`Utilizar ${light.name}`}
                    checked={selected.includes(light.id)}
                    onCheckedChange={(checked) =>
                      setSnapshot((current) => ({
                        ...current,
                        configurationEdited: true,
                        configuration: {
                          ...current.configuration,
                          selectedIds:
                            checked === true
                              ? [
                                  ...new Set([
                                    ...current.configuration.selectedIds,
                                    light.id,
                                  ]),
                                ]
                              : current.configuration.selectedIds.filter(
                                  (id) => id !== light.id,
                                ),
                        },
                      }))
                    }
                  />
                  <span className="min-w-0 flex-1 text-sm font-medium">
                    {light.name}
                  </span>
                  {!light.online && (
                    <span className="text-xs text-muted-foreground">
                      Sin conexión
                    </span>
                  )}
                </label>
              ))
            )}
            {unavailableSaved.map((id, index) => (
              <label
                key={id}
                className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-3"
              >
                <Checkbox
                  aria-label={`Conservar luz guardada ${index + 1}`}
                  checked={selected.includes(id)}
                  onCheckedChange={(checked) =>
                    setSnapshot((current) => ({
                      ...current,
                      configurationEdited: true,
                      configuration: {
                        ...current.configuration,
                        selectedIds:
                          checked === true
                            ? [
                                ...new Set([
                                  ...current.configuration.selectedIds,
                                  id,
                                ]),
                              ]
                            : current.configuration.selectedIds.filter(
                                (selectedId) => selectedId !== id,
                              ),
                      },
                    }))
                  }
                />
                <span className="text-sm">
                  Luz guardada {index + 1} · No disponible en esta consulta
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {!authorized && selected.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Hay {selected.length} luces guardadas; tu selección y colores se
            conservan.
            {snapshot.status?.requiresAuthorization ||
            (!verificationPending && snapshot.status?.status === "disconnected")
              ? " Volvé a autorizar Google para usarlas."
              : " Comprobá la conexión para verificar los permisos antes de usarlas."}
          </p>
        )}
        {missingSelected.length > 0 && (
          <p role="alert" className="text-sm text-muted-foreground">
            {missingSelected.length} luces guardadas no aparecieron en esta
            consulta. Se conservarán; desmarcalas únicamente si querés dejar de
            usarlas.
          </p>
        )}
        <fieldset
          className="space-y-2"
          disabled={busy || snapshot.loading || !snapshot.configurationLoaded}
        >
          <legend className="mb-2 text-sm font-semibold">
            Color de cada estado
          </legend>
          {VISO_STATES.map((state) => (
            <label
              key={state.key}
              className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 px-3 py-2"
            >
              <span className="text-sm font-medium">{state.label}</span>
              <input
                type="color"
                aria-label={`Color Google Home ${state.label}`}
                value={snapshot.configuration.colorsByState[state.key]}
                onChange={(event) =>
                  setSnapshot((current) => ({
                    ...current,
                    configurationEdited: true,
                    configuration: {
                      ...current.configuration,
                      colorsByState: {
                        ...current.configuration.colorsByState,
                        [state.key]: event.target.value,
                      },
                    },
                  }))
                }
                className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent"
              />
            </label>
          ))}
        </fieldset>
        <p className="text-xs text-muted-foreground">
          Los estados personalizados, como Jugando, usan el color RGB que elegís
          al crearlos.
        </p>
        <p className="text-xs text-muted-foreground">
          Solo cambiará el color de las luces seleccionadas. La sincronización
          recibe cambios de tus otros dispositivos mientras VISO está abierto y
          al volver a la app. Android no garantiza controles con la app cerrada.
        </p>
        <Button
          disabled={!canSave}
          onClick={() =>
            void perform(async (request) => {
              const configuration = await googleHomeNative.saveConfiguration({
                accountId: userId,
                selectedIds: selected,
                colorsByState: snapshot.configuration.colorsByState,
              });
              if (request !== generation.current) return;
              setSnapshot((current) => ({
                ...current,
                configuration,
                configurationLoaded: true,
                configurationEdited: false,
                savedSelectedIds: configuration.selectedIds,
                error: null,
              }));
              notifyGoogleHomeConfigurationChanged(userId);
              toast.success(
                configuration.enabled
                  ? "Luces seleccionadas y colores guardados."
                  : "Colores guardados. No hay luces seleccionadas para sincronizar.",
              );
              onOpenChange(false);
            })
          }
        >
          {selected.length > 0
            ? "Guardar selección y colores"
            : "Guardar colores"}
        </Button>
        {snapshot.status?.authorized && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void perform(async (request) => {
                await googleHomeNative.disconnect({ accountId: userId });
                notifyGoogleHomeConfigurationChanged(userId);
                const [status, configuration] = await Promise.all([
                  googleHomeNative.getStatus({ accountId: userId }),
                  googleHomeNative.getConfiguration({ accountId: userId }),
                ]);
                if (request === generation.current)
                  setSnapshot({
                    status,
                    configuration,
                    configurationLoaded: true,
                    configurationEdited: false,
                    savedSelectedIds: configuration.selectedIds,
                    lights: [],
                    discovered: false,
                    loading: false,
                    error: null,
                  });
              })
            }
          >
            Dejar de usar estas luces en VISO
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
