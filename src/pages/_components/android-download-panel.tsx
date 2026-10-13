import { QRCodeSVG } from "qrcode.react";
import { Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ANDROID_APK_URL =
  "https://raw.githubusercontent.com/elkauce/visoapparg/fix/viso-deck-reference-layout/downloads/VISO-Deck-1.8.0-debug.apk";

export default function AndroidDownloadPanel() {
  return (
    <section
      className="flex flex-col items-center gap-6 rounded-2xl border bg-card/60 p-5 sm:flex-row sm:items-center"
      aria-label="Descargar VISO para Android"
    >
      <div className="shrink-0 rounded-xl bg-white p-4">
        <QRCodeSVG
          value={ANDROID_APK_URL}
          size={192}
          level="M"
          title="Escaneá para descargar VISO para Android"
        />
      </div>
      <div className="space-y-3 text-center sm:text-left">
        <h2 className="flex items-center justify-center gap-2 font-semibold sm:justify-start">
          <Smartphone className="size-5" /> VISO para Android
        </h2>
        <p className="text-sm text-muted-foreground">
          Escaneá el QR con tu celular para descargar la app. Desde el celular
          también podés usar el botón.
        </p>
        <Button asChild>
          <a href={ANDROID_APK_URL}>
            <Download /> Descargar APK
          </a>
        </Button>
        <p className="text-xs text-muted-foreground">Versión 1.8.0</p>
      </div>
    </section>
  );
}
