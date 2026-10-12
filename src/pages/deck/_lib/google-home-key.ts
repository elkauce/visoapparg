import type { GoogleHomeBridge } from "@/lib/google-home-native";
import type { SimpleDeckAction } from "./action-runner";

/** A personal RGB key changes selected lights, never the shared account status. */
export async function applyGoogleHomeKeyColor(
  action: Extract<SimpleDeckAction, { type: "rgb" }>,
  accountId: string | null,
  android: boolean,
  bridge: GoogleHomeBridge,
): Promise<void> {
  if (!android || !accountId)
    throw new Error("Abrí esta tecla en la APK Android con tu cuenta VISO.");
  if (
    action.command !== "color" ||
    !action.color ||
    !/^#[0-9a-fA-F]{6}$/.test(action.color)
  )
    throw new Error("Elegí un color RGB para la tecla.");
  const result = await bridge.applyState({
    accountId,
    stateKey: null,
    customColor: action.color,
    revision: `key:${crypto.randomUUID()}`,
  });
  if (
    !result.applied ||
    result.results.length === 0 ||
    result.results.some((light) => !light.success)
  )
    throw new Error(
      result.results.find((light) => !light.success)?.error ??
        "No se pudo aplicar el color. Revisá las luces seleccionadas en Ajustes del Deck.",
    );
}
