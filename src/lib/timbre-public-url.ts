import { isAndroidNative } from "./android-native";

/** Capacitor's https://localhost origin is private to the device. Never put it
 * on a plaque or invitation that another person's browser must open. */
export function timbrePublicOrigin() {
  const native = isAndroidNative();
  const configured =
    import.meta.env.VITE_PUBLIC_APP_URL || import.meta.env.VITE_VISO_WEB_URL;
  const url = new URL(
    configured ||
      (native
        ? "https://viso-deck-android.vercel.app"
        : window.location.origin),
  );
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && loopback && !native)) ||
    (loopback && native)
  ) {
    throw new Error(
      "Configurá la dirección pública HTTPS de VISO antes de compartir o imprimir un Timbre.",
    );
  }
  return url.origin;
}

export function timbrePublicQrUrl(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new Error("El identificador del QR no es válido.");
  return `${timbrePublicOrigin()}/t/${token}`;
}
