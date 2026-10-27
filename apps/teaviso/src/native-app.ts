import { Capacitor, registerPlugin } from "@capacitor/core";

export const isTeavisoAndroid = () =>
  import.meta.env.VITE_TEAVISO_ANDROID === "true" &&
  Capacitor.isNativePlatform() &&
  Capacitor.getPlatform() === "android";

const native = registerPlugin<{
  saveFile(options: {
    filename: string;
    mimeType: string;
    base64: string;
  }): Promise<{ saved: boolean }>;
}>("VisoNative");

export async function saveNativeQr(
  filename: string,
  kind: "png" | "svg",
  contents: string,
) {
  if (!isTeavisoAndroid())
    throw new Error("Esta descarga requiere Te Aviso Android.");
  const base64 =
    kind === "png"
      ? contents.replace(/^data:image\/png;base64,/, "")
      : btoa(
          Array.from(new TextEncoder().encode(contents), (byte) =>
            String.fromCharCode(byte),
          ).join(""),
        );
  return native.saveFile({
    filename,
    mimeType: kind === "png" ? "image/png" : "image/svg+xml",
    base64,
  });
}
