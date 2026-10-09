import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { SPORTS_LEAGUES, isSportsLeague } from "@/convex/lib/sports_leagues.ts";
import type { KeyFace } from "../_components/deck-key.tsx";
import { decodeKeyVisibility } from "./key-visibility.ts";

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
  const visibility = decodeKeyVisibility(appearance.icon);
  const icon = visibility.icon ?? face?.icon ?? "calendar";
  return {
    label:
      appearance.label ??
      face?.label ??
      (content.kind === "clock" ? "Reloj" : "Clima"),
    icon,
    color: appearance.color ?? face?.color ?? "#64748b",
    active: face?.active ?? false,
    mediaUrl: appearance.mediaUrl,
    mediaType: appearance.mediaType,
    showLabel: visibility.showLabel,
    showIcon: visibility.showIcon,
    ...(content.kind === "action" &&
    content.action.type === "android-app" &&
    icon === "android-app"
      ? { appPackageName: content.action.packageName }
      : {}),
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
      return {
        label: content.label,
        icon: content.icon,
        color: content.color,
        active: false,
      };
    case "action": {
      // A saved custom icon is preserved; the former generic globe uses the
      // application's real icon by default on Android.
      const isApp = content.action.type === "android-app";
      const icon =
        isApp && (content.icon === "globe" || content.icon === "android-app")
          ? "android-app"
          : content.icon;
      return {
        label: content.label,
        icon,
        color: content.color,
        active: false,
        ...(isApp &&
        icon === "android-app" &&
        content.action.type === "android-app"
          ? { appPackageName: content.action.packageName }
          : {}),
      };
    }
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
