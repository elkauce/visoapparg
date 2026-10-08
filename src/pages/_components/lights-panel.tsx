import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Lightbulb, Zap } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import HomeLightsForm from "./home-lights-form.tsx";
import { applyKeyLight, DEFAULT_LIGHT } from "@/lib/key-light.ts";

function LightsForm({ savedIp }: { savedIp: string }) {
  const setKeyLightIp = useMutation(api.lights.setKeyLightIp);
  const [ip, setIp] = useState(savedIp);
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    try {
      await setKeyLightIp({ ip });
      toast.success("Luz guardada");
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "No se pudo guardar",
      );
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await applyKeyLight(ip.trim(), DEFAULT_LIGHT);
      toast.success("La luz respondió");
    } catch {
      toast.error(
        "No se pudo hablar con la luz. Revisa la IP, que estés en su misma red y que el navegador permita contenido no seguro en este sitio",
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="192.168.1.50"
          className="max-w-56 font-mono"
        />
        <Button variant="secondary" onClick={handleSave}>
          Guardar
        </Button>
        <Button variant="ghost" onClick={handleTest} disabled={testing || ip.trim() === ""}>
          <Zap /> Probar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        La IP de tu Elgato Key Light está en la app Control Center, en los
        ajustes de la luz. El cambio de luz lo hace tu navegador, así que VISO
        debe estar abierto en un dispositivo de tu misma red. Si el navegador
        lo bloquea, permite "contenido no seguro" para este sitio en sus
        ajustes. Luego elige la luz de cada estado al editarlo.
      </p>
    </div>
  );
}

export default function LightsPanel() {
  const settings = useQuery(api.lights.getSettings, {});

  return (
    <section className="space-y-4 rounded-2xl border bg-card/60 p-5">
      <div className="flex items-start gap-3">
        <Lightbulb className="mt-0.5 size-5 text-primary" />
        <div>
          <h2 className="font-semibold">Luces</h2>
          <p className="text-sm text-muted-foreground">
            Cada estado puede encender tu Key Light con el brillo y color que
            quieras. Más abajo conectas las luces de tu casa.
          </p>
        </div>
      </div>
      {settings ? (
        <>
          <LightsForm key={`ip-${settings.keyLightIp ?? "none"}`} savedIp={settings.keyLightIp ?? ""} />
          <HomeLightsForm
            key={`home-${settings.homeWebhookUrl ?? "none"}`}
            savedUrl={settings.homeWebhookUrl ?? ""}
          />
        </>
      ) : (
        <Skeleton className="h-10 w-full rounded-xl" />
      )}
    </section>
  );
}
