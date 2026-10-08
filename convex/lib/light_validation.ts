import { ConvexError } from "convex/values";

const PRIVATE_IPV4 =
  /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

function bad(message: string): never {
  throw new ConvexError({ code: "BAD_REQUEST", message });
}

// Valida la URL del webhook. Solo https y nunca hacia la red interna (el servidor hace la llamada)
export function validateWebhookUrl(raw: string): string | undefined {
  const value = raw.trim();
  if (value.length === 0) {
    return undefined;
  }
  if (value.length > 500) {
    bad("La URL del webhook es demasiado larga");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return bad("La URL del webhook no es válida");
  }
  const host = url.hostname.toLowerCase();
  const isInternal =
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.startsWith("[") ||
    PRIVATE_IPV4.test(host);
  if (url.protocol !== "https:" || isInternal) {
    bad("El webhook debe ser una URL https pública");
  }
  return url.toString();
}

// IP o nombre de la Key Light (sin puerto, ruta ni símbolos raros)
export function validateLightHost(raw: string): string | undefined {
  const value = raw.trim();
  if (value.length === 0) {
    return undefined;
  }
  if (!/^[a-zA-Z0-9.-]{1,100}$/.test(value)) {
    bad("Escribe solo la IP de la luz, por ejemplo 192.168.1.50");
  }
  return value;
}

export function validateLight(light: {
  on: boolean;
  brightness: number;
  temperature: number;
}): void {
  const { brightness, temperature } = light;
  if (!Number.isInteger(brightness) || brightness < 3 || brightness > 100) {
    bad("El brillo debe estar entre 3 y 100");
  }
  if (!Number.isInteger(temperature) || temperature < 143 || temperature > 344) {
    bad("La temperatura de color no es válida");
  }
}
