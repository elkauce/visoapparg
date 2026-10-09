import type { Id } from "@/convex/_generated/dataModel";
import type { StatusIconKey } from "@/lib/status-icons";

export type VisoStateDefinition = {
  key: "libre" | "ocupado" | "reunion" | "llamada" | "no-molestar" | "ausente";
  name: string;
  label: string;
  aliases: readonly string[];
  defaultColor: string;
  icon: StatusIconKey;
};

export type VisoStatusRecord = {
  _id: Id<"statuses">;
  name: string;
  color: string;
  icon: string;
};

// These are the six buttons of the Android state screen, not a replacement for
// the user's saved states. Existing custom states and their actions stay intact.
export const VISO_STATES = [
  {
    key: "libre",
    name: "Libre",
    label: "LIBRE",
    aliases: [],
    defaultColor: "#22c55e",
    icon: "check-circle",
  },
  {
    key: "ocupado",
    name: "Ocupado",
    label: "OCUPADO",
    aliases: [],
    defaultColor: "#ef4444",
    icon: "ban",
  },
  {
    key: "reunion",
    name: "Reunión",
    label: "REUNIÓN",
    aliases: ["En reunión"],
    defaultColor: "#f59e0b",
    icon: "users",
  },
  {
    key: "llamada",
    name: "Llamada",
    label: "LLAMADA",
    aliases: ["En llamada"],
    defaultColor: "#8b5cf6",
    icon: "phone",
  },
  {
    key: "no-molestar",
    name: "No molestar",
    label: "NO MOLESTAR",
    aliases: [],
    defaultColor: "#ec4899",
    icon: "bell-off",
  },
  {
    key: "ausente",
    name: "Ausente",
    label: "AUSENTE",
    aliases: [],
    defaultColor: "#64748b",
    icon: "moon",
  },
] as const satisfies readonly VisoStateDefinition[];

export function normalizeVisoStatusName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es");
}

export function findVisoStatus<T extends VisoStatusRecord>(
  definition: VisoStateDefinition,
  statuses: readonly T[],
): T | null {
  const canonicalName = normalizeVisoStatusName(definition.name);
  const exact = statuses.find(
    (status) => normalizeVisoStatusName(status.name) === canonicalName,
  );
  if (exact) return exact;

  for (const alias of definition.aliases) {
    const aliasName = normalizeVisoStatusName(alias);
    const match = statuses.find(
      (status) => normalizeVisoStatusName(status.name) === aliasName,
    );
    if (match) return match;
  }
  return null;
}
