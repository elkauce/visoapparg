import { BACKGROUND_STATUS_EVENT } from "@/components/background-presence";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { isAndroidNative } from "@/lib/android-native";
import {
  presenceNative,
  readPresencePreferences,
  savePresencePreferences,
  type PresenceCalendar,
  type PresencePreferences,
} from "@/lib/presence-native";
export default function PresenceSettings({
  accountId,
  open,
  onOpenChange,
}: {
  accountId: string;
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const [preferences, setPreferences] = useState(() =>
    readPresencePreferences(accountId),
  );
  const [calendars, setCalendars] = useState<PresenceCalendar[]>([]);
  const [pending, setPending] = useState(false);
  const [backgroundStatus, setBackgroundStatus] = useState("");
  useEffect(() => {
    const changed = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.accountId === accountId) setBackgroundStatus(detail.message);
    };
    window.addEventListener(BACKGROUND_STATUS_EVENT, changed);
    return () => window.removeEventListener(BACKGROUND_STATUS_EVENT, changed);
  }, [accountId]);
  const save = (next: PresencePreferences) => {
    savePresencePreferences(accountId, next);
    setPreferences(next);
  };
  const perform = async (action: () => Promise<void>) => {
    if (pending) return;
    setPending(true);
    try {
      await action();
    } catch (failure) {
      toast.error(
        failure instanceof Error
          ? failure.message
          : "No se pudo activar la detección. Revisá los permisos Android.",
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent management className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Estado automático</DialogTitle>
          <DialogDescription>
            Llamadas reales y reuniones programadas mientras usás el Deck.
          </DialogDescription>
        </DialogHeader>
        {!isAndroidNative() ? (
          <p>
            Configurá esta detección en la APK Android. El estado se compartirá
            con tus otros dispositivos.
          </p>
        ) : (
          <>
            <label className="flex items-center justify-between gap-3">
              <span>Llamadas telefónicas → LLAMADA</span>
              <Switch
                aria-label="Detectar llamadas telefónicas"
                checked={preferences.calls}
                disabled={pending}
                onCheckedChange={(enabled) =>
                  void perform(async () => {
                    if (
                      enabled &&
                      !(await presenceNative.requestPhoneAccess()).granted
                    )
                      throw new Error(
                        "Android no autorizó el estado de llamadas.",
                      );
                    save({
                      ...preferences,
                      calls: enabled,
                      backgroundCalls: enabled
                        ? preferences.backgroundCalls
                        : false,
                    });
                  })
                }
              />
            </label>
            <p className="text-xs text-muted-foreground">
              No usa el micrófono ni lee números, contactos o el historial de
              llamadas.
            </p>
            <label className="flex items-center justify-between gap-3">
              <span>Detectar llamadas en segundo plano</span>
              <Switch
                aria-label="Detectar llamadas en segundo plano"
                checked={preferences.backgroundCalls === true}
                disabled={pending || !preferences.calls}
                onCheckedChange={(enabled) =>
                  void perform(async () => {
                    if (
                      enabled &&
                      !(await presenceNative.requestBackgroundAccess()).granted
                    )
                      throw new Error(
                        "Permití la notificación de VISO para activar la detección en segundo plano.",
                      );
                    save({ ...preferences, backgroundCalls: enabled });
                  })
                }
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Funciona sin abrir el Deck, incluso si usás Elgato. Android
              muestra una notificación para abrir VISO o desactivar el servicio.
              No detecta llamadas si forzás la detención de la app. Las
              reuniones de calendario mantienen su funcionamiento actual.
            </p>
            {backgroundStatus && (
              <p role="status" className="text-xs text-muted-foreground">
                {backgroundStatus}
              </p>
            )}
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                void perform(async () => {
                  if (!(await presenceNative.requestCalendarAccess()).granted)
                    throw new Error("Android no autorizó el calendario.");
                  setCalendars(
                    (await presenceNative.listCalendars()).calendars,
                  );
                })
              }
            >
              Elegir calendarios sincronizados
            </Button>
            {calendars.map((calendar) => (
              <label
                key={calendar.id}
                className="flex items-center gap-3 rounded-xl border p-3"
              >
                <Checkbox
                  checked={preferences.calendarIds.includes(calendar.id)}
                  onCheckedChange={(selected) =>
                    save({
                      ...preferences,
                      calendarIds:
                        selected === true
                          ? [
                              ...new Set([
                                ...preferences.calendarIds,
                                calendar.id,
                              ]),
                            ]
                          : preferences.calendarIds.filter(
                              (id) => id !== calendar.id,
                            ),
                    })
                  }
                />
                <span>
                  {calendar.name}
                  <span className="block text-xs text-muted-foreground">
                    {calendar.account}
                  </span>
                </span>
              </label>
            ))}
            {preferences.calendarIds.length > 0 && (
              <p className="text-sm">
                {preferences.calendarIds.length} calendarios seleccionados.
              </p>
            )}
            <label className="flex items-center justify-between gap-3">
              <span>Usar todos los eventos ocupados</span>
              <Switch
                aria-label="Usar todos los eventos ocupados"
                checked={preferences.allBusyEvents}
                onCheckedChange={(enabled) =>
                  save({ ...preferences, allBusyEvents: enabled })
                }
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Por defecto se usan eventos con enlace Meet/Zoom o la palabra
              reunión/meeting. Se ignoran eventos de todo el día, libres,
              cancelados o rechazados. Esto sigue el horario de la agenda, no
              confirma asistencia.
            </p>
            <p className="text-xs text-muted-foreground">
              La llamada tiene prioridad sobre la agenda. Al terminar se
              recupera el estado anterior si no lo cambiaste manualmente. Activá
              el detector en un dispositivo por cuenta. Android puede detenerlo
              si cierra VISO. Mientras el Deck siga activo, la sincronización
              mantiene tus luces seleccionadas aunque una llamada cubra la app.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
