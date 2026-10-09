import type { Id } from "@/convex/_generated/dataModel.d.ts";

export type SimpleDeckAction =
  | { type: "display" }
  | { type: "url"; url: string }
  | { type: "android-app"; packageName: string }
  | {
      type: "media";
      command:
        | "play-pause"
        | "next"
        | "previous"
        | "volume-up"
        | "volume-down"
        | "mute";
    }
  | { type: "status"; statusId: Id<"statuses"> }
  | { type: "off" }
  | { type: "page"; pageId: Id<"deckPages"> }
  | {
      type: "rgb";
      command: "color" | "brightness" | "power" | "scene";
      deviceId: string;
      color?: string;
      brightness?: number;
      on?: boolean;
      scene?: string;
    };

export type DeckAction =
  SimpleDeckAction | { type: "automation"; steps: SimpleDeckAction[] };

export type DeckActionServices = {
  openDisplay: () => Promise<void>;
  openUrl: (url: string) => Promise<void>;
  openApp: (packageName: string) => Promise<void>;
  media: (
    command: Extract<SimpleDeckAction, { type: "media" }>["command"],
  ) => Promise<void>;
  setStatus: (statusId: Id<"statuses"> | null) => Promise<void>;
  selectPage: (pageId: Id<"deckPages">) => Promise<void>;
  rgb?: (action: Extract<SimpleDeckAction, { type: "rgb" }>) => Promise<void>;
};

async function runStep(
  action: SimpleDeckAction,
  services: DeckActionServices,
): Promise<void> {
  switch (action.type) {
    case "display":
      return services.openDisplay();
    case "url":
      return services.openUrl(action.url);
    case "android-app":
      return services.openApp(action.packageName);
    case "media":
      return services.media(action.command);
    case "status":
      return services.setStatus(action.statusId);
    case "off":
      return services.setStatus(null);
    case "page":
      return services.selectPage(action.pageId);
    case "rgb":
      if (services.rgb) return services.rgb(action);
      throw new Error(
        "Control RGB no disponible: configura y autoriza una integración compatible.",
      );
  }
}

// Each awaited operation must confirm success. An automation stops at the first
// failed step, without retrying actions that have already reached a device.
export async function runDeckAction(
  action: DeckAction,
  services: DeckActionServices,
): Promise<void> {
  if (action.type !== "automation") return runStep(action, services);
  for (let index = 0; index < action.steps.length; index++) {
    try {
      await runStep(action.steps[index], services);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Acción rechazada";
      throw new Error(
        `Automatización detenida en el paso ${index + 1}: ${message}`,
        { cause: error },
      );
    }
  }
}
