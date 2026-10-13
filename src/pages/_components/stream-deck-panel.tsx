import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, Copy, Download, Plug, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { usePhysicalDeck } from "@/hooks/use-physical-deck.ts";

import { isAndroidNative, nativeDeck } from "@/lib/android-native.ts";
import { createElgatoKeyImages } from "@/lib/elgato-key-images";
import { personalizeElgato } from "@/lib/personal-elgato.ts";
import { getSiteUrl } from "@/lib/site-url.ts";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar, cópialo manualmente");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-sm font-medium">{label}</span>
      <Input
        readOnly
        value={value}
        onFocus={(e) => e.target.select()}
        className="font-mono text-xs"
      />
      <Button
        variant="secondary"
        size="icon"
        onClick={handleCopy}
        aria-label={`Copiar ${label}`}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}

function PhysicalDeckSection() {
  const data = useQuery(api.statuses.list, {});
  const setActive = useMutation(api.statuses.setActive);

  const handleSelect = useCallback(
    (statusId: string) => {
      setActive({ statusId: statusId as Id<"statuses"> }).catch(() =>
        toast.error("No se pudo cambiar el estado"),
      );
    },
    [setActive],
  );

  const { supported, connected, modelName, error, connect, disconnect } =
    usePhysicalDeck({
      statuses: data?.statuses ?? [],
      activeStatusId: data?.activeStatusId ?? null,
      onSelect: handleSelect,
    });

  if (!supported) {
    return (
      <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
        Tu navegador no permite conectar el Stream Deck directamente. Usa Chrome
        o Edge en un computador, o configura las URLs de abajo con el software
        de Elgato.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`size-2.5 rounded-full ${connected ? "bg-primary shadow-[0_0_10px_var(--primary)]" : "bg-muted-foreground"}`}
          />
          <p className="text-sm">
            {connected
              ? `Conectado: ${modelName}`
              : "Ningún Stream Deck conectado"}
          </p>
        </div>
        {connected ? (
          <Button variant="secondary" size="sm" onClick={disconnect}>
            <Unplug /> Desconectar
          </Button>
        ) : (
          <Button size="sm" onClick={connect}>
            <Plug /> Conectar Stream Deck
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Tus estados aparecen en las teclas, en el mismo orden del deck. Cierra
        el programa de Elgato mientras uses esta página: solo uno puede
        controlar el dispositivo a la vez.
      </p>
    </div>
  );
}

function UrlSection() {
  const token = useQuery(api.deck_api.getMine, {});
  const ensureMine = useMutation(api.deck_api.ensureMine);
  const regenerate = useMutation(api.deck_api.regenerate);
  const statuses = useQuery(api.statuses.list, {});
  const [preparingPlugin, setPreparingPlugin] = useState(false);

  useEffect(() => {
    if (token === null) {
      ensureMine({}).catch(() => toast.error("No se pudo crear tu token"));
    }
  }, [token, ensureMine]);

  if (!token || !statuses) {
    return <Skeleton className="h-24 w-full rounded-xl" />;
  }

  const base = `${getSiteUrl()}/deck/set?token=${token}&status=`;

  const downloadPersonalPlugin = async () => {
    if (preparingPlugin) return;
    setPreparingPlugin(true);
    try {
      const response = await fetch(
        "/downloads/VISO-Elgato-1.2.streamDeckPlugin",
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Download failed");
      const configuration = {
        format: "viso-streamdeck-v1" as const,
        actions: [
          ...statuses.statuses.map((status) => ({
            name: status.name,
            color: status.color,
            icon: status.icon,
            url: `${base}${encodeURIComponent(status._id)}`,
          })),
          {
            name: "Apagar",
            color: "#64748b",
            icon: "power",
            url: `${base}off`,
          },
        ],
      };
      const images = [];
      for (const entry of configuration.actions) {
        images.push(await createElgatoKeyImages(entry.icon, entry.color));
      }
      const bytes = personalizeElgato(
        new Uint8Array(await response.arrayBuffer()),
        configuration,
        images,
      );
      const objectUrl = URL.createObjectURL(
        new Blob([new Uint8Array(bytes).buffer], {
          type: "application/octet-stream",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "Mi-VISO.streamDeckPlugin";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
      toast.success(
        "Plugin listo con tu cuenta y tus estados. Abrilo en Elgato en tu computadora.",
      );
    } catch {
      toast.error(
        "No se pudo preparar el plugin. Intentá de nuevo desde la web en tu computadora.",
      );
    } finally {
      setPreparingPlugin(false);
    }
  };

  const downloadConfiguration = async () => {
    const actions = [
      ...statuses.statuses.map((status) => ({
        name: status.name,
        url: `${base}${encodeURIComponent(status._id)}`,
      })),
      { name: "Apagar", url: `${base}off` },
    ];
    const contents = JSON.stringify(
      { format: "viso-streamdeck-v1", actions },
      null,
      2,
    );
    if (isAndroidNative()) {
      try {
        await nativeDeck.exportDeckConfiguration(contents);
        toast.success("Configuración guardada");
      } catch {
        toast.error("No se guardó la configuración");
      }
      return;
    }
    const objectUrl = URL.createObjectURL(
      new Blob(
        [JSON.stringify({ format: "viso-streamdeck-v1", actions }, null, 2)],
        { type: "application/json" },
      ),
    );
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "Mi-configuracion-VISO-Elgato.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  const handleRegenerate = async () => {
    try {
      await regenerate({});
      toast.success("Token renovado. Actualiza las URLs en tu Stream Deck");
    } catch {
      toast.error("No se pudo renovar el token");
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Plugin VISO para Elgato</h3>
        <p className="text-xs text-muted-foreground">
          Descargá tu plugin listo para usar: incluye tu cuenta y tus estados.
          Abrilo en Elgato y arrastrá tus controles a las teclas que prefieras.
        </p>
      </div>
      <div className="space-y-2">
        <Button
          onClick={downloadPersonalPlugin}
          disabled={preparingPlugin}
          className="h-auto max-w-full whitespace-normal py-2 text-center"
        >
          <Download />{" "}
          {preparingPlugin
            ? "Preparando tu plugin…"
            : "Descargar mi plugin configurado"}
        </Button>
        <p className="text-xs text-muted-foreground">
          No necesitás importar archivos ni pegar enlaces. Este instalador es
          personal: no lo compartas. Abrilo en tu computadora.
        </p>
        <details>
          <summary className="text-xs cursor-pointer">
            Opciones avanzadas y plugin anterior
          </summary>
          <Button onClick={downloadConfiguration}>
            <Download /> Descargar mi configuración para el plugin
          </Button>
          <p className="text-xs text-muted-foreground">
            Importá este archivo en la acción «Estado VISO» del plugin. Es
            personal: no lo compartas. Renovar el token revoca las
            configuraciones anteriores.
          </p>
          <p className="text-xs text-muted-foreground">
            Alternativa: pegá una de estas URLs en el plugin o en la acción
            «Sitio web» de Elgato con «Acceder en segundo plano».
          </p>
          <div className="space-y-2">
            {statuses.statuses.map((status) => (
              <CopyField
                key={status._id}
                label={status.name}
                value={`${base}${encodeURIComponent(status.name)}`}
              />
            ))}
            <CopyField label="Apagar" value={`${base}off`} />
          </div>
        </details>
      </div>
      <Button variant="ghost" size="sm" onClick={handleRegenerate}>
        <RefreshCw /> Renovar token
      </Button>
    </div>
  );
}

export default function StreamDeckPanel({
  pluginOnly = false,
}: { pluginOnly?: boolean } = {}) {
  return (
    <section className="space-y-5 rounded-2xl border bg-card/60 p-5">
      <div>
        <h2 className="font-semibold">Stream Deck de Elgato</h2>
        <p className="text-sm text-muted-foreground">
          Controla tu estado con las teclas físicas.
        </p>
      </div>
      {!pluginOnly && <PhysicalDeckSection />}
      <div className="border-t pt-5">
        <UrlSection />
      </div>
    </section>
  );
}
