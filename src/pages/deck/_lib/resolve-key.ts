import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { SPORTS_LEAGUES, isSportsLeague } from "@/convex/lib/sports_leagues.ts";
import type { KeyFace } from "../_components/deck-key.tsx";

export type DeckStatusInfo = {
  _id: string;
  name: string;
  color: string;
  icon: string;
};

export type KeyContent = Doc<"deckKeys">["content"];
export type KeyAppearance = NonNullable<Doc<"deckKeys">["appearance"]> & {
  mediaUrl?: string | null;
};

const VOLUME_FACES = {
  up: { label: "Volumen +", icon: "volume-up" },
  down: { label: "Volumen -", icon: "volume-down" },
  mute: { label: "Silencio", icon: "volume-mute" },
} as const;

// Convierte el contenido guardado de una tecla en lo que se dibuja.
// null = es un widget con contenido en vivo (reloj, clima) o la tecla ya no es válida
export function resolveKeyFace(
  content: KeyContent,
  statuses: DeckStatusInfo[],
  activeStatusId: string | null,
  volume: number,
  appearance?: KeyAppearance,
): KeyFace | null {
  const face = resolveContentFace(content, statuses, activeStatusId, volume);
  if (!appearance) return face;
  return {
    label:
      appearance.label ??
      face?.label ??
      (content.kind === "clock" ? "Reloj" : "Clima"),
    icon: appearance.icon ?? face?.icon ?? "calendar",
    color: appearance.color ?? face?.color ?? "#64748b",
    active: face?.active ?? false,
    mediaUrl: appearance.mediaUrl,
    mediaType: appearance.mediaType,
  };
}

function resolveContentFace(
  content: KeyContent,
  statuses: DeckStatusInfo[],
  activeStatusId: string | null,
  volume: number,
): KeyFace | null {
  switch (content.kind) {
    case "status": {
      const status = statuses.find((s) => s._id === content.statusId);
      return status
        ? {
            label: status.name,
            icon: status.icon,
            color: status.color,
            active: status._id === activeStatusId,
          }
        : null;
    }
    case "off":
      return {
        label: "Apagar",
        icon: "power",
        color: "#64748b",
        active: activeStatusId === null,
      };
    case "link":
    case "folder":
    case "action":
      return {
        label: content.label,
        icon: content.icon,
        color: content.color,
        active: false,
      };
    case "sports":
      return {
        label: isSportsLeague(content.league)
          ? SPORTS_LEAGUES[content.league].name
          : "Deportes",
        icon: "trophy",
        color: "#f97316",
        active: false,
      };
    case "volume": {
      const face = VOLUME_FACES[content.action];
      const label =
        content.action === "mute" ? face.label : `${face.label} (${volume}%)`;
      return {
        label,
        icon: face.icon,
        color: "#0ea5e9",
        active: content.action === "mute" && volume === 0,
      };
    }
    case "clock":
    case "weather":
      return null;
  }
}

export function isLiveWidget(content: KeyContent): boolean {
  return content.kind === "clock" || content.kind === "weather";
}
