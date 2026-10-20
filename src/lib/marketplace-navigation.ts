import type { MouseEvent } from "react";
import { toast } from "sonner";
import { actions, isAndroidNative } from "./android-native";

export function marketplaceConnectionsPath(): string {
  return isAndroidNative() ? "/android/stream-deck" : "/?section=connections";
}

export function marketplaceWebUrl(path: string): string {
  const base = new URL(
    import.meta.env.VITE_VISO_WEB_URL || "https://viso-deck-android.vercel.app",
  );
  if (base.protocol !== "https:" || base.username || base.password)
    throw new Error("La dirección de VISO no está disponible.");
  const url = new URL(path, base);
  if (url.origin !== base.origin)
    throw new Error("La dirección de VISO no es válida.");
  return url.href;
}

export async function openMarketplaceAsset(source: string): Promise<void> {
  const url = new URL(
    source.startsWith("/marketplace/") ? marketplaceWebUrl(source) : source,
  );
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("El archivo no tiene una dirección segura.");
  await actions.openUrl(url.href);
}

export function externalMarketplaceNavigation(
  event: Pick<MouseEvent, "preventDefault" | "defaultPrevented">,
  href: string,
): void {
  if (!isAndroidNative() || event.defaultPrevented) return;
  event.preventDefault();
  void openMarketplaceAsset(href).catch(() =>
    toast.error("No se pudo abrir el enlace. Intentá de nuevo."),
  );
}
