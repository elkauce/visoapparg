import { useState } from "react";
import { useQuery } from "convex/react";
import { Check, Copy, Cpu } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { buildEsp32Sketch } from "@/lib/esp32-sketch.ts";
import { getSiteUrl } from "@/lib/site-url.ts";

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("No se pudo copiar, cópialo manualmente");
    }
  };
  return { copied, copy };
}

// URLs públicas (sin contraseña) para que ESP32, Arduino o luces RGB lean el estado
export default function DevicesPanel() {
  const slug = useQuery(api.public_status.getMine, {});
  const { copied, copy } = useCopy();
  const [showCode, setShowCode] = useState(false);

  if (!slug) {
    return <Skeleton className="h-40 w-full rounded-2xl" />;
  }

  const base = `${getSiteUrl()}/public/status?slug=${slug}`;
  const formats = [
    { key: "rgb", label: "Color RGB", hint: "Devuelve: 255,0,0", url: `${base}&format=rgb` },
    { key: "hex", label: "Color HEX", hint: "Devuelve: #ef4444", url: `${base}&format=hex` },
    { key: "name", label: "Nombre", hint: "Devuelve: Ocupado", url: `${base}&format=name` },
    { key: "json", label: "Todo (JSON)", hint: "Estado, color y dueño", url: base },
  ];
  const sketch = buildEsp32Sketch(`${base}&format=rgb`);

  return (
    <section className="space-y-4 rounded-2xl border bg-card/60 p-5">
      <div className="flex items-start gap-3">
        <Cpu className="mt-0.5 size-5 text-primary" />
        <div>
          <h2 className="font-semibold">ESP32 y luces RGB</h2>
          <p className="text-sm text-muted-foreground">
            Estas direcciones son públicas y no piden contraseña. Tu ESP32,
            Arduino, Home Assistant o cualquier luz RGB puede consultarlas para
            copiar el color de tu estado. Sin estado activo devuelven negro
            (0,0,0).
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {formats.map((format) => (
          <div key={format.key} className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium">{format.label}</span>
              <span className="text-xs text-muted-foreground">{format.hint}</span>
            </div>
            <div className="flex gap-2">
              <Input
                readOnly
                value={format.url}
                onFocus={(e) => e.target.select()}
                className="font-mono text-xs"
              />
              <Button
                variant="secondary"
                size="icon"
                aria-label={`Copiar ${format.label}`}
                onClick={() => copy(format.key, format.url)}
              >
                {copied === format.key ? <Check /> : <Copy />}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Código de ejemplo para ESP32</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowCode((s) => !s)}>
              {showCode ? "Ocultar" : "Ver código"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => copy("sketch", sketch)}>
              {copied === "sketch" ? <Check /> : <Copy />} Copiar código
            </Button>
          </div>
        </div>
        {showCode && (
          <pre className="max-h-80 overflow-auto rounded-xl bg-muted p-3 text-xs">
            <code>{sketch}</code>
          </pre>
        )}
        <p className="text-xs text-muted-foreground">
          Para una tira WS2812 (NeoPixel) en el pin 5. En Arduino IDE instala la
          librería "Adafruit NeoPixel", cambia tu WiFi y súbelo. Consulta cada 5
          segundos. Si renuevas tu link público, actualiza también estas
          direcciones.
        </p>
      </div>
    </section>
  );
}
