// New server operations remain opt-in until the additive backend is deployed.
// This flag must be enabled only for a deployment that contains those operations.
export function deckExtensionsEnabled(): boolean {
  return import.meta.env.VITE_ANDROID_DECK_EXTENSIONS === "true";
}

export function deckErrorMessage(
  error: unknown,
  fallback = "No se pudo completar la acción",
): string {
  if (error && typeof error === "object" && "data" in error) {
    const data = error.data;
    if (
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof data.message === "string"
    ) {
      return data.message;
    }
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

// A device identifier is not an authentication token. Losing it never grants access.
export function getDeckDeviceId(
  storage: Pick<Storage, "getItem" | "setItem">,
): string {
  const key = "viso.android.deck.device.v1";
  try {
    const saved = storage.getItem(key);
    if (saved && /^[a-zA-Z0-9-]{8,80}$/.test(saved)) return saved;
    const id = crypto.randomUUID();
    storage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
