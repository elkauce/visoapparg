import { v } from "convex/values";

// Acciones nativas/RGB son planes de configuración; guardarlos no ejecuta permisos.
export const deckSimpleAction = v.union(
  v.object({ type: v.literal("status"), statusId: v.id("statuses") }),
  v.object({ type: v.literal("off") }),
  v.object({ type: v.literal("display") }),
  v.object({ type: v.literal("page"), pageId: v.id("deckPages") }),
  v.object({ type: v.literal("url"), url: v.string() }),
  v.object({ type: v.literal("android-app"), packageName: v.string() }),
  v.object({
    type: v.literal("media"),
    command: v.union(
      v.literal("play-pause"),
      v.literal("next"),
      v.literal("previous"),
      v.literal("volume-up"),
      v.literal("volume-down"),
      v.literal("mute"),
    ),
  }),
  v.object({
    type: v.literal("rgb"),
    command: v.union(
      v.literal("color"),
      v.literal("brightness"),
      v.literal("power"),
      v.literal("scene"),
    ),
    deviceId: v.string(),
    color: v.optional(v.string()),
    brightness: v.optional(v.number()),
    on: v.optional(v.boolean()),
    scene: v.optional(v.string()),
  }),
);

export const deckAction = v.union(
  deckSimpleAction,
  v.object({ type: v.literal("automation"), steps: v.array(deckSimpleAction) }),
);
