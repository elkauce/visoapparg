import { Building2, CalendarDays, House } from "lucide-react";

export const servicePlans = [
  {
    id: "hogares",
    title: "Casas y departamentos",
    short: "Mi casa",
    icon: House,
    description: "Tu puerta, tu WhatsApp. Tu número, privado.",
    features: [
      "La visita escribe desde la web, sin instalar nada.",
      "Respuesta desde tu WhatsApp, con el número protegido.",
      "Vos autorizás el contacto directo.",
    ],
    availability: "Puente WhatsApp en preparación",
    detail:
      "La integración con el WhatsApp actual del propietario necesita validación antes de habilitarse. Hoy podés usar las llamadas de Te Aviso con un plan compatible.",
  },
  {
    id: "negocios",
    title: "Profesionales y consultorios",
    short: "Mi consultorio",
    icon: CalendarDays,
    description: "Tu espacio profesional, siempre a mano.",
    features: [
      "Tu WhatsApp profesional para consultas.",
      "Reservas online y agenda en un solo lugar.",
      "Cartel con nombre, especialidad y matrícula.",
    ],
    availability: "Funciones según contratación",
    detail:
      "Las reservas se pueden hacer desde cualquier lugar. Tu WhatsApp profesional es visible al continuar el contacto directo.",
  },
  {
    id: "edificios",
    title: "Edificios",
    short: "Mi edificio",
    icon: Building2,
    description: "Cada visita, con la persona indicada.",
    features: [
      "Un QR y un directorio de departamentos.",
      "Audio y video en la app del residente.",
      "Personas y permisos por departamento.",
    ],
    availability: "Apertura con equipo por validar",
    detail:
      "La apertura remota todavía requiere implementar y validar un controlador y una cerradura. El QR no autoriza la apertura de la puerta.",
  },
] as const;
export type ServiceInterest = (typeof servicePlans)[number]["id"];
export function serviceInterest(value: string | null): ServiceInterest | "" {
  if (servicePlans.some((plan) => plan.id === value))
    return value as ServiceInterest;
  if (["avisos", "videollamada", "familia", "portal"].includes(value ?? ""))
    return "hogares";
  return "";
}
