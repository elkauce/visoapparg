import { useEffect, useRef, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { googleHomeNative, notifyGoogleHomeConfigurationChanged, type GoogleHomeConfiguration, type GoogleHomeLight, type GoogleHomeStatus } from "@/lib/google-home-native.ts";
import { VISO_STATES } from "../_lib/viso-states.ts";
import { readGoogleHomeColors } from "../_lib/google-home-colors.ts";

interface Snapshot {
  status: GoogleHomeStatus | null;
  configuration: GoogleHomeConfiguration;
  lights: GoogleHomeLight[];
  discovered: boolean;
  loading: boolean;
  error: string | null;
}

const errorMessage = (failure: unknown): string =>
  failure instanceof Error ? failure.message : "Google Home no pudo completar la operación.";

/** Configuration stays inside the state screen; every listed light is an SDK result. */
export default function GoogleHomeColorsDialog({ userId, open, onOpenChange }: {
  userId: string;
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({
    status: null,
    configuration: { selectedIds: [], colorsByState: readGoogleHomeColors(userId), enabled: false, revision: "" },
    lights: [],
    discovered: false,
    loading: true,
    error: null,
  }));
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    const request = ++generation.current;
    if (!open) return;
    const load = async () => {
      await Promise.resolve();
      if (generation.current !== request) return;
      setSnapshot((current) => ({ ...current, status: null, lights: [], discovered: false, loading: true, error: null }));
      try {
        const [status, configuration] = await Promise.all([
          googleHomeNative.getStatus({ accountId: userId }),
          googleHomeNative.getConfiguration({ accountId: userId }),
        ]);
        if (generation.current !== request) return;
        let lights: GoogleHomeLight[] = [];
        let currentStatus = status;
        let discovered = false;
        let error: string | null = null;
        if (status.authorized && status.available) {
          try {
            const result = await googleHomeNative.discoverLights({ accountId: userId });
            lights = result.lights.filter((light) => light.colorCapable === true);
            currentStatus = result;
            discovered = true;
          } catch (failure) { error = errorMessage(failure); }
        }
        if (generation.current === request) setSnapshot({ status: currentStatus, configuration, lights, discovered, loading: false, error });
      } catch (failure) {
        if (generation.current === request) setSnapshot((current) => ({ ...current, status: null, lights: [], discovered: false, loading: false, error: errorMessage(failure) }));
      }
    };
    void load();
    return () => { generation.current += 1; };
  }, [open, userId]);

  async function perform(task: (request: number) => Promise<void>) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    const request = generation.current;
    try { await task(request); }
    catch (failure) {
      if (request === generation.current) {
        let status: GoogleHomeStatus | null = null;
        try { status = await googleHomeNative.getStatus({ accountId: userId }); }
        catch { /* Keep permissions unverified if the official read also fails. */ }
        if (request === generation.current) setSnapshot((current) => ({ ...current, status, lights: [], discovered: false, error: errorMessage(failure) }));
      }
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  async function discover(request: number) {
    const result = await googleHomeNative.discoverLights({ accountId: userId });
    if (request !== generation.current) return;
    setSnapshot((current) => ({ ...current, status: result, lights: result.lights.filter((light) => light.colorCapable === true), discovered: true, error: null }));
  }

  const selected = snapshot.configuration.selectedIds;
  const canAuthorize = !!(snapshot.status?.sdkPresent && snapshot.status.available);
  const authorized = !!(snapshot.status?.authorized && snapshot.status.available);
  const missingSelected = snapshot.discovered ? selected.filter((id) => !snapshot.lights.some((light) => light.id === id)) : [];
  const canSave = !busy && !snapshot.loading && (authorized || selected.length === 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Luces Google Home</DialogTitle>
          <DialogDescription>Autoriza Google y elige únicamente las luces que usarás con tus estados VISO.</DialogDescription>
        </DialogHeader>
        {snapshot.loading ? <p role="status" className="flex items-center gap-2 text-sm"><LoaderCircle className="size-4 animate-spin" />Consultando Google Home…</p> : (
          <div role="status" className="rounded-xl border border-border bg-secondary/40 p-3 text-sm">
            {snapshot.status?.message ?? "No se pudo verificar la conexión con Google Home."}
          </div>
        )}
        {snapshot.error && <p role="alert" className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive">{snapshot.error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || snapshot.loading || !canAuthorize} onClick={() => void perform(async (request) => {
            const status = await googleHomeNative.authorize({ accountId: userId });
            if (request !== generation.current) return;
            setSnapshot((current) => ({ ...current, status, error: null }));
            notifyGoogleHomeConfigurationChanged(userId);
            if (status.authorized && status.available) await discover(request);
          })}>{authorized ? "Revisar permisos de Google" : canAuthorize ? "Autorizar Google Home" : "Autorizar Google Home — pendiente"}</Button>
          {authorized && <Button variant="outline" disabled={busy} onClick={() => void perform(discover)}><RefreshCw className="size-4" />Actualizar luces</Button>}
        </div>
        {authorized && (
          <fieldset className="space-y-2" disabled={busy}>
            <legend className="mb-2 text-sm font-semibold">Luces compatibles con color</legend>
            {snapshot.lights.length === 0 ? <p className="text-sm text-muted-foreground">{snapshot.discovered ? "Google no devolvió luces compatibles con cambio de color entre los dispositivos autorizados." : "Consulta las luces autorizadas para seleccionar cuáles utilizar."}</p> : snapshot.lights.map((light) => (
              <label key={light.id} className="flex cursor-pointer items-center gap-3 rounded-xl bg-secondary/50 px-3 py-3">
                <Checkbox aria-label={`Utilizar ${light.name}`} checked={selected.includes(light.id)} onCheckedChange={(checked) => setSnapshot((current) => ({ ...current, configuration: { ...current.configuration, selectedIds: checked === true ? [...new Set([...current.configuration.selectedIds, light.id])] : current.configuration.selectedIds.filter((id) => id !== light.id) } }))} />
                <span className="min-w-0 flex-1 text-sm font-medium">{light.name}</span>
                {!light.online && <span className="text-xs text-muted-foreground">Sin conexión</span>}
              </label>
            ))}
          </fieldset>
        )}
        {!authorized && selected.length > 0 && <p className="text-sm text-muted-foreground">Hay {selected.length} luces guardadas. Vuelve a autorizar Google para comprobarlas; no se enviarán colores mientras falten los permisos.</p>}
        {missingSelected.length > 0 && <p role="alert" className="text-sm text-muted-foreground">{missingSelected.length} luces guardadas ya no aparecen entre las autorizadas. Se quitarán de la selección si guardas esta configuración.</p>}
        <fieldset className="space-y-2" disabled={busy || snapshot.loading}>
          <legend className="mb-2 text-sm font-semibold">Color de cada estado</legend>
          {VISO_STATES.map((state) => (
            <label key={state.key} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 px-3 py-2">
              <span className="text-sm font-medium">{state.label}</span>
              <input type="color" aria-label={`Color Google Home ${state.label}`} value={snapshot.configuration.colorsByState[state.key]} onChange={(event) => setSnapshot((current) => ({ ...current, configuration: { ...current.configuration, colorsByState: { ...current.configuration.colorsByState, [state.key]: event.target.value } } }))} className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent" />
            </label>
          ))}
        </fieldset>
        <p className="text-xs text-muted-foreground">Solo cambiará el color de las luces seleccionadas. La sincronización recibe cambios de tus otros dispositivos mientras VISO está abierto y al volver a la app. Android no garantiza controles con la app cerrada.</p>
        <Button disabled={!canSave} onClick={() => void perform(async (request) => {
          const selectedIds = snapshot.discovered ? selected.filter((id) => snapshot.lights.some((light) => light.id === id)) : selected;
          const configuration = await googleHomeNative.saveConfiguration({ accountId: userId, selectedIds, colorsByState: snapshot.configuration.colorsByState });
          if (request !== generation.current) return;
          setSnapshot((current) => ({ ...current, configuration, error: null }));
          notifyGoogleHomeConfigurationChanged(userId);
          toast.success(configuration.enabled ? "Luces seleccionadas y colores guardados." : "Colores guardados. No hay luces seleccionadas para sincronizar.");
          onOpenChange(false);
        })}>{selected.length > 0 ? "Guardar selección y colores" : "Guardar colores"}</Button>
        {snapshot.status?.authorized && <Button variant="outline" disabled={busy} onClick={() => void perform(async (request) => {
          await googleHomeNative.disconnect({ accountId: userId });
          notifyGoogleHomeConfigurationChanged(userId);
          const [status, configuration] = await Promise.all([
            googleHomeNative.getStatus({ accountId: userId }),
            googleHomeNative.getConfiguration({ accountId: userId }),
          ]);
          if (request === generation.current) setSnapshot({ status, configuration, lights: [], discovered: false, loading: false, error: null });
        })}>Dejar de usar estas luces en VISO</Button>}
      </DialogContent>
    </Dialog>
  );
}
