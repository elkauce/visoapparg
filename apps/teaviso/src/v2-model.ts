import { Building2, CalendarDays, MessageCircle, Package } from "lucide-react";
export const solutions = [
  {
    id: "negocios",
    title: "Para tu negocio",
    label: "Plan pago",
    icon: CalendarDays,
    color: "orange",
    description: "Sumá horarios, reservas y una agenda para atender mejor.",
    features: [
      "Timbre digital y avisos de llegada",
      "Servicios y profesionales",
      "Horarios y agenda de reservas",
    ],
    action: "Conocer el plan",
  },
  {
    id: "whatsapp",
    title: "Con tu WhatsApp",
    label: "Base gratis",
    icon: MessageCircle,
    color: "green",
    description: "Tu visita escanea y te escribe a tu WhatsApp.",
    features: [
      "QR y mensaje general gratuitos",
      "Diseños descargables y QR editable",
      "Mejoras de pago: mensajes preguardados y número dedicado",
    ],
    action: "Crear mi timbre",
  },
  {
    id: "hardware",
    title: "Con hardware VISO",
    label: "Timbre incluido",
    icon: Package,
    color: "blue",
    description: "Incluido con equipos VISO participantes.",
    features: [
      "Equipos participantes",
      "Vinculación a tu cuenta",
      "Funciones y vigencia según tu compra",
    ],
    action: "Ver equipos",
  },
  {
    id: "edificios",
    title: "Para edificios",
    label: "Mensual · Con asistencia",
    icon: Building2,
    color: "purple",
    description: "Un timbre por unidad y ayuda para configurarlo.",
    features: [
      "Departamentos y residentes",
      "Responsables y permisos",
      "Asistencia de configuración",
    ],
    action: "Consultar opciones",
  },
] as const;

export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function visitorNonce(token: string) {
  const key = `teaviso:visitor:${token}`;
  try {
    const saved = sessionStorage.getItem(key);
    if (saved && /^[a-f0-9]{64}$/.test(saved)) return saved;
    const next = randomToken();
    sessionStorage.setItem(key, next);
    return next;
  } catch {
    return randomToken();
  }
}
