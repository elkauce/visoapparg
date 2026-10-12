import { parseActionUrl } from "./request.mjs";
export const PRESETS = [
  {
    key: "libre",
    name: "LIBRE",
    color: "#22c55e",
    aliases: ["libre"],
    glyph: "M23 39l11 11 23-25",
  },
  {
    key: "ocupado",
    name: "OCUPADO",
    color: "#ef4444",
    aliases: ["ocupado"],
    glyph: "M25 25l30 30M55 25L25 55",
  },
  {
    key: "reunion",
    name: "REUNIÓN",
    color: "#eab308",
    aliases: ["reunion", "en reunion"],
    glyph:
      "M28 49v-6a12 12 0 0124 0v6M18 49v-5a9 9 0 018-9M62 49v-5a9 9 0 00-8-9",
  },
  {
    key: "llamada",
    name: "LLAMADA",
    color: "#8b5cf6",
    aliases: ["llamada", "en llamada"],
    glyph:
      "M24 20l11 14-7 7q7 12 17 17l8-8 13 11q-4 9-12 8Q23 57 17 29q-1-6 7-9",
  },
  {
    key: "no-molestar",
    name: "NO MOLESTAR",
    color: "#ec4899",
    aliases: ["no molestar"],
    glyph:
      "M24 52h32l-5-9V32a11 11 0 00-19-8M29 32v11l-5 9M37 59h6M19 19l43 43",
  },
  {
    key: "ausente",
    name: "AUSENTE",
    color: "#64748b",
    aliases: ["ausente"],
    glyph: "M52 18a25 25 0 11-29 30A22 22 0 0052 18z",
  },
  {
    key: "off",
    name: "APAGAR",
    color: "#475569",
    aliases: [],
    glyph: "M40 18v23M25 26a23 23 0 1030 0",
  },
];
export const normalize = (name) =>
  String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
export function parseConfiguration(value) {
  if (
    value?.format !== "viso-streamdeck-v1" ||
    !Array.isArray(value.actions) ||
    !value.actions.length ||
    value.actions.length > 25
  )
    throw new Error("Configuración inválida");
  let owner;
  const actions = value.actions.map((action) => {
    if (
      typeof action.name !== "string" ||
      !action.name.trim() ||
      action.name.length > 100
    )
      throw new Error("Estado inválido");
    const url = parseActionUrl(action.url);
    const identity = `${url.origin}|${url.searchParams.get("token")}`;
    if (owner && owner !== identity)
      throw new Error("La configuración mezcla cuentas");
    owner = identity;
    return {
      name: action.name,
      url: url.href,
      ...(typeof action.color === "string" &&
      /^#[a-f0-9]{6}$/i.test(action.color)
        ? { color: action.color }
        : {}),
    };
  });
  return { format: "viso-streamdeck-v1", actions };
}
export function resolveControl(preset, settings = {}, configuration = null) {
  // Explicit per-key URLs from 1.0 remain intact; new keys share only the imported account.
  if (settings.url) {
    const url = parseActionUrl(settings.url);
    return {
      url: url.href,
      label: settings.label || preset?.name || "VISO",
      color: preset?.color,
    };
  }
  const actions = configuration?.actions ?? [];
  const exact =
    preset && preset.key !== "off"
      ? actions.find(
          (action) => normalize(action.name) === normalize(preset.name),
        )
      : null;
  const selected =
    exact ||
    (preset
      ? actions.find((action) =>
          preset.key === "off"
            ? new URL(action.url).searchParams.get("status") === "off"
            : preset.aliases.includes(normalize(action.name)),
        )
      : actions.find(
          (action) =>
            new URL(action.url).searchParams.get("status") ===
            settings.selectedStatus,
        ));
  if (!selected && !preset && !settings.selectedStatus && configuration)
    throw new Error("Elegí un estado para esta tecla.");
  if (!selected)
    throw new Error(
      configuration
        ? "El estado no figura en tu archivo VISO. Actualizá la configuración."
        : "Importá tu configuración VISO para activar esta tecla.",
    );
  return {
    url: selected.url,
    label: settings.label || preset?.name || selected.name,
    color: selected.color || preset?.color,
  };
}
