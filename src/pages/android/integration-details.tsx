import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Check, ListMusic, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  actions,
  isAndroidNative,
  nativeDeck,
  type HomeAssistantLight,
  type MediaCommand,
} from "@/lib/android-native.ts";
import { AndroidScreen } from "./shared.tsx";
import { VisoDevicesPanel } from "./_components/viso-devices-panel.tsx";
import {
  integrationStatusLabel,
  mediaStatusLabel,
  useNativeIntegrations,
} from "./_components/integration-state.ts";

const titles: Record<string, string> = {
  "google-home": "Google Home",
  alexa: "Amazon Alexa",
  devices: "Dispositivos VISO",
  "home-assistant": "Home Assistant",
  media: "Spotify y multimedia",
  apps: "Aplicaciones y automatizaciones",
};

function useOperation() {
  const [pending, setPending] = useState(false);
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const perform = useCallback(async (operation: () => Promise<unknown>) => {
    if (running.current) return;
    running.current = true;
    if (mounted.current) setPending(true);
    try {
      await operation();
    } catch (failure) {
      if (mounted.current)
        toast.error(
          failure instanceof Error
            ? failure.message
            : "No se pudo completar la acción. Volvé a intentarlo.",
        );
    } finally {
      running.current = false;
      if (mounted.current) setPending(false);
    }
  }, []);
  return { pending, perform };
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      {children}
    </section>
  );
}

function GoogleHomePanel() {
  return (
    <Panel>
      <p role="status" className="text-sm font-medium text-primary">
        Pendiente de habilitación
      </p>
      <p className="text-sm text-muted-foreground">
        La conexión directa con Google Home todavía no está disponible en esta
        versión. No hay una cuenta Google vinculada ni dispositivos autorizados
        desde VISO.
      </p>
      <p className="text-sm text-muted-foreground">
        Cuando esté disponible, podrás elegir tu cuenta y dar permiso para
        acceder a tu casa.
      </p>
      <Button asChild variant="outline">
        <Link to="/android/integrations/home-assistant">
          Usar Home Assistant
        </Link>
      </Button>
    </Panel>
  );
}

function AlexaPanel() {
  const settings = useQuery(api.lights.getSettings);
  const setWebhook = useMutation(api.lights.setHomeWebhook);
  const testWebhook = useMutation(api.lights.testHomeWebhook);
  const [draft, setDraft] = useState<string | null>(null);
  const { pending, perform } = useOperation();
  const savedUrl = settings?.homeWebhookUrl ?? "";
  const url = draft ?? savedUrl;
  const run = (operation: () => Promise<unknown>, success: string) =>
    perform(async () => {
      try {
        await operation();
        toast.success(success);
      } catch (failure) {
        throw new Error(
          failure instanceof ConvexError
            ? String(
                (failure.data as { message?: string })?.message ??
                  "No se pudo guardar la configuración",
              )
            : failure instanceof Error
              ? failure.message
              : "El servicio no respondió",
          { cause: failure },
        );
      }
    });

  return (
    <>
      <Panel>
        <p role="status" className="text-sm font-medium text-primary">
          {settings === undefined
            ? "Comprobando…"
            : savedUrl
              ? "Servicio configurado · cuenta sin vincular"
              : "Sin vincular"}
        </p>
        <p className="text-sm text-muted-foreground">
          Podés activar rutinas de Alexa con un servicio compatible, como Voice
          Monkey, al cambiar de estado en VISO. Esta opción no conecta tu cuenta
          de Amazon ni controla dispositivos directamente.
        </p>
        <div className="space-y-2">
          <Label htmlFor="alexa-service-url">
            Dirección de activación de tu servicio
          </Label>
          <Input
            id="alexa-service-url"
            type="password"
            autoComplete="off"
            value={url}
            disabled={settings === undefined || pending}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Pegá la dirección HTTPS de tu rutina"
          />
          <p className="text-xs text-muted-foreground">
            Se sincroniza con tu cuenta. Es la misma dirección general que
            utiliza la web para avisar cambios de estado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={settings === undefined || pending || url === savedUrl}
            onClick={() =>
              void run(
                async () => {
                  await setWebhook({ url });
                  setDraft(null);
                },
                url.trim() ? "Servicio guardado" : "Servicio desconectado",
              )
            }
          >
            <Check />
            Guardar
          </Button>
          <Button
            variant="outline"
            disabled={pending || !savedUrl}
            onClick={() =>
              void run(
                () => testWebhook({}),
                "Prueba solicitada. Comprobá la rutina en Alexa.",
              )
            }
          >
            <Send />
            Probar rutina
          </Button>
          {savedUrl && (
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() =>
                void run(async () => {
                  await setWebhook({ url: "" });
                  setDraft(null);
                }, "Servicio desconectado")
              }
            >
              Desconectar servicio
            </Button>
          )}
        </div>
        {savedUrl && (
          <p className="text-xs text-muted-foreground">
            Una dirección guardada no confirma que Alexa haya recibido o
            ejecutado la rutina.
          </p>
        )}
      </Panel>
      <details className="rounded-xl border border-border p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Configurar una rutina con Voice Monkey
        </summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            En Voice Monkey, creá un dispositivo de activación de rutinas.
          </li>
          <li>
            En Alexa, creá una rutina que se active con ese dispositivo y elegí
            qué debe hacer.
          </li>
          <li>
            Copiá la dirección de activación del servicio y guardala aquí. Cada
            cambio de estado de VISO le enviará un aviso.
          </li>
          <li>
            Para acciones distintas en cada estado, configurá su dirección
            propia desde el editor de estados de la web.
          </li>
        </ol>
      </details>
    </>
  );
}

function LightControls({
  light,
  refresh,
}: {
  light: HomeAssistantLight;
  refresh: () => Promise<unknown>;
}) {
  const { pending, perform } = useOperation();
  const control = (options: Parameters<typeof nativeDeck.controlLight>[1]) =>
    perform(async () => {
      await nativeDeck.controlLight(light.id, options);
      await refresh();
    });
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 break-words text-sm font-medium">
          {light.name}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !light.available}
          onClick={() => void control({ on: !light.on })}
        >
          {light.available
            ? light.on
              ? "Apagar"
              : "Encender"
            : "No disponible"}
        </Button>
      </div>
      {light.brightness !== undefined && (
        <label className="flex flex-wrap items-center justify-between gap-3 text-sm">
          Brillo
          <input
            aria-label={`Brillo de ${light.name}`}
            type="range"
            min="0"
            max="100"
            defaultValue={light.brightness}
            key={light.brightness}
            disabled={pending || !light.available}
            onPointerUp={(event) =>
              void control({ brightness: Number(event.currentTarget.value) })
            }
            onKeyUp={(event) => {
              if (event.key.startsWith("Arrow"))
                void control({ brightness: Number(event.currentTarget.value) });
            }}
          />
        </label>
      )}
      {light.supportsColor && (
        <label className="flex items-center justify-between text-sm">
          Color
          <input
            aria-label={`Color de ${light.name}`}
            type="color"
            defaultValue="#ffffff"
            disabled={pending || !light.available}
            onChange={(event) => void control({ color: event.target.value })}
          />
        </label>
      )}
    </div>
  );
}

function HomeAssistantPanel() {
  const { capabilities, lights, loading, error, refresh } =
    useNativeIntegrations({
      verifyHomeAssistant: true,
      discoverHomeAssistantLights: true,
    });
  const { pending, perform } = useOperation();
  const native = isAndroidNative();
  return (
    <>
      <Panel>
        <p role="status" className="text-sm font-medium text-primary">
          {capabilities
            ? integrationStatusLabel(capabilities.homeAssistant)
            : error
              ? "No se pudo comprobar"
              : "Comprobando…"}
        </p>
        <p className="text-sm text-muted-foreground">
          Conectá tu instancia de Home Assistant para consultar y controlar sus
          luces. Es una conexión independiente de Google Home.
        </p>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0" />
          La dirección y el token se configuran y guardan de forma segura en
          este dispositivo Android.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {capabilities?.homeAssistant.configured &&
          capabilities.homeAssistant.status === "disconnected" && (
            <p role="alert" className="text-sm text-destructive">
              Revisá la dirección del servidor, su conexión y la autorización.
              Tu configuración se conserva.
            </p>
          )}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!native || pending || loading}
            onClick={() =>
              void perform(async () => {
                await nativeDeck.configureHomeAssistant();
                await refresh();
              })
            }
          >
            {capabilities?.homeAssistant.configured
              ? "Cambiar servidor"
              : "Conectar servidor"}
          </Button>
          <Button
            variant="outline"
            disabled={
              !native ||
              pending ||
              loading ||
              !capabilities?.homeAssistant.configured
            }
            onClick={() => void perform(refresh)}
          >
            <RefreshCw />
            Comprobar conexión
          </Button>
          {capabilities?.homeAssistant.configured && (
            <Button
              variant="ghost"
              disabled={!native || pending || loading}
              onClick={() =>
                void perform(async () => {
                  await nativeDeck.disconnectHomeAssistant();
                  await refresh();
                })
              }
            >
              Desconectar
            </Button>
          )}
        </div>
        {!native && (
          <p className="text-sm text-muted-foreground">
            Abrí esta configuración desde la APK de VISO Deck.
          </p>
        )}
      </Panel>
      {lights.length > 0 && (
        <section aria-labelledby="ha-lights-heading" className="space-y-3">
          <h2 id="ha-lights-heading" className="font-semibold">
            Tus luces
          </h2>
          {lights.map((light) => (
            <LightControls key={light.id} light={light} refresh={refresh} />
          ))}
        </section>
      )}
      {capabilities?.homeAssistant.status === "connected" &&
        !error &&
        !loading &&
        lights.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No hay luces disponibles para mostrar.
          </p>
        )}
    </>
  );
}

const mediaButtons: {
  label: string;
  command: MediaCommand;
  session?: boolean;
}[] = [
  { label: "Anterior", command: "previous", session: true },
  { label: "Play / pausa", command: "play-pause", session: true },
  { label: "Siguiente", command: "next", session: true },
  { label: "Volumen −", command: "volume-down" },
  { label: "Volumen +", command: "volume-up" },
  { label: "Silenciar", command: "mute" },
];

function MediaPanel() {
  const { capabilities, loading, error, refresh } = useNativeIntegrations();
  const { pending, perform } = useOperation();
  const native = isAndroidNative();
  const hasSession =
    !!capabilities?.mediaPermissionGranted &&
    !!capabilities?.mediaSession &&
    capabilities.activeMediaSessions > 0;
  return (
    <Panel>
      <p role="status" className="text-sm font-medium text-primary">
        {capabilities
          ? mediaStatusLabel(capabilities)
          : error
            ? "No se pudo comprobar"
            : "Comprobando…"}
      </p>
      <p className="text-sm text-muted-foreground">
        Controlá Spotify y otros reproductores compatibles que estén abiertos en
        tu teléfono. Se utiliza el control multimedia de Android, sin vincular
        una cuenta Spotify.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        variant="outline"
        disabled={!native || pending || loading}
        onClick={() =>
          void perform(async () => {
            await nativeDeck.openMediaPermissionSettings();
            await refresh();
          })
        }
      >
        {capabilities?.mediaPermissionGranted
          ? "Administrar acceso multimedia"
          : "Permitir control multimedia"}
      </Button>
      {!capabilities?.mediaPermissionGranted && native && (
        <p className="text-xs text-muted-foreground">
          Para controlar la reproducción, habilitá el acceso a notificaciones de
          VISO. El volumen funciona sin ese permiso.
        </p>
      )}
      {capabilities?.mediaPermissionGranted && !hasSession && (
        <p className="text-sm text-muted-foreground">
          Abrí Spotify u otro reproductor compatible y comenzá la reproducción.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {mediaButtons.map(({ label, command, session }) => (
          <Button
            key={command}
            variant="secondary"
            disabled={
              pending ||
              loading ||
              !native ||
              (session ? !hasSession : !capabilities?.mediaVolume)
            }
            onClick={() =>
              void perform(async () => {
                await actions.media(command);
                await refresh();
              })
            }
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <ListMusic className="size-4 shrink-0" />
        <p>
          También podés asignar estos controles a una tecla desde su editor en
          el Deck.
        </p>
      </div>
    </Panel>
  );
}

function ApplicationsPanel() {
  const native = isAndroidNative();
  const [allowedCount, setAllowedCount] = useState<number | null>(null);
  const { pending, perform } = useOperation();
  useEffect(() => {
    let active = true;
    if (native)
      void nativeDeck
        .getAllowedApps()
        .then((apps) => {
          if (active) setAllowedCount(apps.length);
        })
        .catch(() => {
          if (active) setAllowedCount(null);
        });
    return () => {
      active = false;
    };
  }, [native]);
  return (
    <>
      <Panel>
        <p role="status" className="text-sm font-medium text-primary">
          {native
            ? allowedCount === null
              ? "Disponible en este dispositivo"
              : `${allowedCount} ${allowedCount === 1 ? "aplicación permitida" : "aplicaciones permitidas"}`
            : "Requiere Android"}
        </p>
        <p className="text-sm text-muted-foreground">
          Elegí qué aplicaciones puede abrir VISO. Después, seleccioná «Abrir
          aplicación» en el editor de una tecla.
        </p>
        <Button
          disabled={!native || pending}
          onClick={() =>
            void perform(async () => {
              const apps = await nativeDeck.manageAllowedApps();
              setAllowedCount(apps.length);
            })
          }
        >
          Aplicaciones permitidas
        </Button>
        {!native && (
          <p className="text-sm text-muted-foreground">
            La selección y apertura de aplicaciones funciona en la APK Android.
          </p>
        )}
      </Panel>
      <Panel>
        <h2 className="font-semibold">Automatizaciones</h2>
        <p className="text-sm text-muted-foreground">
          Combiná varias acciones desde el editor de una tecla. Si un paso
          falla, VISO te informa el motivo y detiene esa secuencia; podés seguir
          usando las demás teclas.
        </p>
        <Button asChild variant="outline">
          <Link to="/deck">Abrir Deck</Link>
        </Button>
      </Panel>
    </>
  );
}

export default function AndroidIntegrationDetails() {
  const { integration } = useParams();
  const title = titles[integration ?? ""] ?? "Integración";
  const panel =
    integration === "google-home" ? (
      <GoogleHomePanel />
    ) : integration === "alexa" ? (
      <AlexaPanel />
    ) : integration === "devices" ? (
      <VisoDevicesPanel />
    ) : integration === "home-assistant" ? (
      <HomeAssistantPanel />
    ) : integration === "media" ? (
      <MediaPanel />
    ) : integration === "apps" ? (
      <ApplicationsPanel />
    ) : (
      <p>Esta integración no está disponible.</p>
    );
  return (
    <AndroidScreen
      title={title}
      backTo="/android/integrations"
      backLabel="Volver a integraciones"
    >
      {panel}
    </AndroidScreen>
  );
}
