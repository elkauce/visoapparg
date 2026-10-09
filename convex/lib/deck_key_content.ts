import { v } from "convex/values";
import { deckAction } from "./deck_action_content.ts";

// Contenido de una tecla del deck de pantalla completa
export const deckKeyContent = v.union(
  // Activa uno de tus estados
  v.object({ kind: v.literal("status"), statusId: v.id("statuses") }),
  // Abre una dirección web
  v.object({
    kind: v.literal("link"),
    label: v.string(),
    url: v.string(),
    icon: v.string(),
    color: v.string(),
  }),
  // Salta a otra página del deck
  v.object({
    kind: v.literal("folder"),
    label: v.string(),
    targetPageId: v.id("deckPages"),
    icon: v.string(),
    color: v.string(),
  }),
  // Quita el estado activo
  v.object({ kind: v.literal("off") }),
  // Widgets
  v.object({ kind: v.literal("clock") }),
  v.object({
    kind: v.literal("weather"),
    label: v.string(),
    latitude: v.number(),
    longitude: v.number(),
  }),
  v.object({ kind: v.literal("sports"), league: v.string() }),
  // Volumen de los videos del Display
  v.object({
    kind: v.literal("volume"),
    action: v.union(v.literal("up"), v.literal("down"), v.literal("mute")),
  }),
  v.object({
    kind: v.literal("action"),
    label: v.string(),
    icon: v.string(),
    color: v.string(),
    action: deckAction,
  }),
);
