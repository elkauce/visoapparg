import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, Copy, Plug, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { usePhysicalDeck } from "@/hooks/use-physical-deck.ts";

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
      <Input readOnly value={value} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
      <Button variant="secondary" size="icon" onClick={handleCopy} aria-label={`Copiar ${label}`}>
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
            {connected ? `Conectado: ${modelName}` : "Ningún Stream Deck conectado"}
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

  useEffect(() => {
    if (token === null) {
      ensureMine({}).catch(() => toast.error("No se pudo crear tu token"));
    }
  }, [token, ensureMine]);

  if (!token || !statuses) {
    return <Skeleton className="h-24 w-full rounded-xl" />;
  }

  const base = `${getSiteUrl()}/deck/set?token=${token}&status=`;

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
        <h3 className="text-sm font-semibold">Con el programa de Elgato</h3>
        <p className="text-xs text-muted-foreground">
          En el programa Stream Deck arrastra la acción "Sitio web" a una
          tecla, pega la URL y activa "Acceder en segundo plano".
        </p>
      </div>
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
      <Button variant="ghost" size="sm" onClick={handleRegenerate}>
        <RefreshCw /> Renovar token
      </Button>
    </div>
  );
}

export default function StreamDeckPanel() {
  return (
    <section className="space-y-5 rounded-2xl border bg-card/60 p-5">
      <div>
        <h2 className="font-semibold">Stream Deck de Elgato</h2>
        <p className="text-sm text-muted-foreground">
          Controla tu estado con las teclas físicas.
        </p>
      </div>
      <PhysicalDeckSection />
      <div className="border-t pt-5">
        <UrlSection />
      </div>
    </section>
  );
}
