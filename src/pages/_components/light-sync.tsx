import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import { applyKeyLight } from "@/lib/key-light.ts";

// Mientras VISO está abierto, aplica en la Key Light el ajuste del estado activo.
// Funciona también cuando el cambio llega desde el Stream Deck o desde una URL
export default function LightSync() {
  const data = useQuery(api.statuses.list, {});
  const settings = useQuery(api.lights.getSettings, {});
  const lastApplied = useRef<string | null>(null);
  const warned = useRef(false);

  const ip = settings?.keyLightIp ?? null;
  const activeStatus = data?.statuses.find((s) => s._id === data.activeStatusId);
  const light = activeStatus?.light;
  const signature =
    ip && activeStatus && light
      ? `${ip}|${activeStatus._id}|${light.on}|${light.brightness}|${light.temperature}`
      : null;

  useEffect(() => {
    if (!ip || !light || !signature || signature === lastApplied.current) {
      return;
    }
    lastApplied.current = signature;
    applyKeyLight(ip, light).catch(() => {
      // Avisamos una sola vez para no llenar la pantalla de errores
      if (!warned.current) {
        warned.current = true;
        toast.error("No se pudo controlar la luz. Revisa la IP y que estés en la misma red");
      }
    });
  }, [ip, light, signature]);

  return null;
}
