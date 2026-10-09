import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import {
  ChevronRight,
  House,
  Lightbulb,
  ListMusic,
  Mic,
  RefreshCw,
  Smartphone,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { isAndroidNative } from "@/lib/android-native.ts";
import { AndroidScreen } from "./shared.tsx";
import {
  useNativeIntegrations,
  integrationStatusLabel,
  mediaStatusLabel,
} from "./_components/integration-state.ts";

function IntegrationRow({
  icon: Icon,
  name,
  description,
  status,
  route,
}: {
  icon: LucideIcon;
  name: string;
  description: string;
  status: string;
  route: string;
}) {
  return (
    <Link
      to={`/android/integrations/${route}`}
      className="flex min-h-20 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={`Configurar ${name}`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block font-semibold">{name}</span>
        <span className="block text-sm leading-snug text-muted-foreground">
          {description}
        </span>
        <span className="block text-xs text-muted-foreground">{status}</span>
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </Link>
  );
}

function IntegrationMenu() {
  const { capabilities, loading, error, refresh } = useNativeIntegrations();
  const settings = useQuery(api.lights.getSettings);
  const android = isAndroidNative();
  const homeAssistantStatus = capabilities
    ? integrationStatusLabel(capabilities.homeAssistant)
    : error
      ? "No se pudo comprobar"
      : "Comprobando…";

  return (
    <>
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => void refresh()}
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <section aria-labelledby="smart-home-heading" className="space-y-2">
        <h2
          id="smart-home-heading"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Hogar inteligente
        </h2>
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          <IntegrationRow
            icon={House}
            name="Google Home"
            description="Tus dispositivos y tu casa conectada."
            status="Pendiente de habilitación"
            route="google-home"
          />
          <IntegrationRow
            icon={Mic}
            name="Amazon Alexa"
            description="Activá rutinas al cambiar de estado."
            status={
              settings === undefined
                ? "Comprobando…"
                : settings?.homeWebhookUrl
                  ? "Servicio configurado · sin vincular cuenta"
                  : "Sin vincular"
            }
            route="alexa"
          />
          <IntegrationRow
            icon={Lightbulb}
            name="Dispositivos VISO"
            description="Conectá, administrá y controlá tus dispositivos VISO."
            status="Ver dispositivos"
            route="devices"
          />
          <IntegrationRow
            icon={Smartphone}
            name="Home Assistant"
            description="Conectá tu servidor y controlá tus luces."
            status={homeAssistantStatus}
            route="home-assistant"
          />
        </div>
      </section>
      <section aria-labelledby="apps-media-heading" className="space-y-2">
        <h2
          id="apps-media-heading"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Aplicaciones y multimedia
        </h2>
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          <IntegrationRow
            icon={ListMusic}
            name="Spotify y multimedia"
            description="Controlá la reproducción y el volumen de tu dispositivo."
            status={
              capabilities
                ? mediaStatusLabel(capabilities)
                : error
                  ? "No se pudo comprobar"
                  : "Comprobando…"
            }
            route="media"
          />
          <IntegrationRow
            icon={Workflow}
            name="Aplicaciones y automatizaciones"
            description="Abrí tus apps y ejecutá acciones desde el Deck."
            status={
              android ? "Disponible en este dispositivo" : "Requiere Android"
            }
            route="apps"
          />
        </div>
      </section>
    </>
  );
}

export default function AndroidIntegrations() {
  return (
    <AndroidScreen title="Integraciones">
      <IntegrationMenu />
    </AndroidScreen>
  );
}
