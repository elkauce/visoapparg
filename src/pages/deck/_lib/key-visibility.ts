/**
 * Keep per-key visibility in the existing appearance.icon string so the new
 * APK can use the live backend without deploying a schema or migrating data.
 * Legacy icons retain both visible elements. The reserved, versioned value is
 * viso1:<icon>:<showLabel><showIcon>, with a maximum of 60 characters. Plain
 * icons are retained when both elements are visible. Unknown/malformed values
 * are treated as legacy icons instead of hiding existing content.
 *
 * "android-app" is the visual default for a launchable Android application;
 * its package remains exclusively in the existing action, never in this field.
 * Media, Canvas, labels and actions are intentionally outside this codec.
 * The published web needs the corresponding frontend update to read the flags.
 */
const PREFIX = "viso1:";
const MAX_ICON_LENGTH = 51;
const ENCODED_ICON = /^viso1:([a-z0-9][a-z0-9-]{0,50}):([01])([01])$/;

export type KeyVisibility = {
  icon: string | undefined;
  showLabel: boolean;
  showIcon: boolean;
};

export function decodeKeyVisibility(icon?: string): KeyVisibility {
  const match = icon?.match(ENCODED_ICON);
  return match
    ? {
        icon: match[1],
        showLabel: match[2] === "1",
        showIcon: match[3] === "1",
      }
    : { icon, showLabel: true, showIcon: true };
}

export function encodeKeyVisibility(
  icon: string,
  showLabel: boolean,
  showIcon: boolean,
): string {
  if (icon.length > 60) {
    throw new Error("Elige un icono de la lista para guardar su visibilidad.");
  }
  if (showLabel && showIcon && !icon.startsWith(PREFIX)) return icon;
  if (icon.length > MAX_ICON_LENGTH || !/^[a-z0-9][a-z0-9-]*$/.test(icon)) {
    throw new Error("Elige un icono de la lista para guardar su visibilidad.");
  }
  return `${PREFIX}${icon}:${Number(showLabel)}${Number(showIcon)}`;
}
