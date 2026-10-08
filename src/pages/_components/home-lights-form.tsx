import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { Home, Send } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";

type Option = { id: string; name: string; steps: string[]; example: string };

const OPTIONS: Option[] = [
  {
    id: "ifttt",
    name: "Google Home, Alexa, Hue, Tuya, Smart Life, LIFX (IFTTT)",
    example: "https://maker.ifttt.com/trigger/viso/with/key/TU_CLAVE",
    steps: [
      "Crea una cuenta gratis en ifttt.com y conecta tu servicio de luces (Philips Hue, Smart Life/Tuya, LIFX, Google Home, etc.).",
      "Crea un Applet: en \"If This\" elige Webhooks > \"Receive a web request\" y ponle el nombre de evento \"viso\".",
      "En \"Then That\" elige tu luz y la acción de cambiar el color. En el campo del color pon el ingrediente Value1 (VISO envía ahí el color en HEX, ej. #22c55e).",
      "En Webhooks > Documentation copia tu clave y pega arriba la dirección con tu clave.",
    ],
  },
  {
    id: "voicemonkey",
    name: "Alexa (Voice Monkey)",
    example: "https://api-v3.voicemonkey.io/trigger?token=TU_TOKEN&device=ID_DEL_DISPOSITIVO",
    steps: [
      "Crea una cuenta en voicemonkey.io y un dispositivo de tipo \"Routine Trigger\".",
      "En la app Alexa crea una Rutina que se active con ese dispositivo y que ponga tus luces en el color que quieras.",
      "Pega arriba la dirección de Voice Monkey. Con esta opción la rutina se dispara en cada cambio; para un color distinto por estado, pon una dirección distinta en el webhook de cada estado.",
    ],
  },
  {
    id: "homeassistant",
    name: "Home Assistant (Google Home y Alexa vía Nabu Casa)",
    example: "https://hooks.nabu.casa/TU_ID_DE_WEBHOOK",
    steps: [
      "En Home Assistant crea una automatización con disparador \"Webhook\" y copia su dirección pública (por ejemplo con Nabu Casa).",
      "VISO envía un JSON con status, color (HEX), rgb (ej. 34,197,94) y off (true al apagar).",
      "Usa esos datos en la acción de tu luz, y tu luz ya aparece en Google Home y Alexa.",
    ],
  },
];

// Una sola dirección que VISO avisa en cada cambio de estado, para luces de casa con Google Home o Alexa
export default function HomeLightsForm({ savedUrl }: { savedUrl: string }) {
  const setHomeWebhook = useMutation(api.lights.setHomeWebhook);
  const testHomeWebhook = useMutation(api.lights.testHomeWebhook);
  const [url, setUrl] = useState(savedUrl);
  const [openId, setOpenId] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error(
        error instanceof ConvexError
          ? (error.data as { message: string }).message
          : "No se pudo completar la acción",
      );
    }
  };

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex items-start gap-3">
        <Home className="mt-0.5 size-5 text-primary" />
        <div>
          <h3 className="font-semibold">Luces de la casa (Google Home y Alexa)</h3>
          <p className="text-sm text-muted-foreground">
            Cuando cambies de estado, tus luces se ponen del color del estado:
            verde si estás libre, rojo si estás ocupado, y se apagan al apagar el
            deck.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://maker.ifttt.com/trigger/viso/with/key/..."
          className="min-w-64 flex-1 font-mono text-xs"
        />
        <Button
          variant="secondary"
          onClick={() => run(() => setHomeWebhook({ url }), "Dirección guardada")}
        >
          Guardar
        </Button>
        <Button
          variant="ghost"
          disabled={savedUrl === ""}
          onClick={() => run(() => testHomeWebhook({}), "Enviado: mira si cambió tu luz")}
        >
          <Send /> Probar
        </Button>
      </div>

      <div className="space-y-2">
        {OPTIONS.map((option) => (
          <div key={option.id} className="rounded-xl bg-muted/50">
            <button
              type="button"
              onClick={() => setOpenId(openId === option.id ? null : option.id)}
              className="w-full cursor-pointer px-3 py-2.5 text-left text-sm font-medium"
            >
              {option.name}
            </button>
            {openId === option.id && (
              <div className="space-y-2 px-3 pb-3">
                <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
                  {option.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <p className="break-all font-mono text-xs text-muted-foreground">
                  Ejemplo: {option.example}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
