import { useRef, useState } from "react";
import { Download, FileArchive, FileJson, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isAndroidNative } from "@/lib/android-native";
import { openMarketplaceAsset } from "@/lib/marketplace-navigation";
import MarketplaceDisplayApply from "./display-apply";
import MarketplaceKeyApply from "./key-apply";
import {
  assetSource,
  type MarketAsset,
  type MarketLibraryEntry,
} from "./types";

const EXTENSIONS: Record<MarketAsset["mediaType"], string> = {
  image: "png",
  video: "mp4",
  audio: "wav",
  archive: "zip",
  profile: "json",
};

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/webm": "webm",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "application/json": "json",
};

function downloadName(asset: MarketAsset, source: string, contentType: string) {
  const elgatoBundle =
    asset.mediaType === "archive"
      ? asset.name.match(/\.(streamDeckPlugin|streamDeckProfile)$/i)?.[1]
      : undefined;
  const extension =
    elgatoBundle ??
    MIME_EXTENSIONS[contentType.split(";")[0].trim().toLowerCase()] ??
    new URL(source, window.location.origin).pathname.match(
      /\.([a-z0-9]{2,8})$/i,
    )?.[1];
  const name = [...asset.name]
    .map((character) =>
      character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character)
        ? "_"
        : character,
    )
    .join("")
    .replace(
      /\.(png|jpe?g|gif|webp|avif|mp4|webm|mp3|wav|ogg|m4a|zip|json|streamDeckPlugin|streamDeckProfile)$/i,
      "",
    )
    .slice(0, 100);
  return `${name || "recurso-viso"}.${extension ?? EXTENSIONS[asset.mediaType]}`;
}

export function LibraryAsset({
  asset,
  product,
}: {
  asset: MarketAsset;
  product: Pick<MarketLibraryEntry, "category" | "productId">;
}) {
  const [downloading, setDownloading] = useState(false);
  const busy = useRef(false);
  const source = assetSource(asset);

  const download = async () => {
    if (!source || busy.current) return;
    busy.current = true;
    setDownloading(true);
    let temporaryUrl: string | null = null;
    try {
      if (isAndroidNative()) {
        await openMarketplaceAsset(source);
        return;
      }
      const response = await fetch(source);
      if (!response.ok) throw new Error("Download unavailable");
      const blob = await response.blob();
      if (!blob.size) throw new Error("Empty download");
      temporaryUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = temporaryUrl;
      anchor.download = downloadName(asset, source, blob.type);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Keep the object URL available while the browser starts the download.
      const completedUrl = temporaryUrl;
      setTimeout(() => URL.revokeObjectURL(completedUrl), 30_000);
      temporaryUrl = null;
    } catch {
      toast.error("No se pudo descargar el archivo. Volvé a intentarlo.");
    } finally {
      if (temporaryUrl) URL.revokeObjectURL(temporaryUrl);
      busy.current = false;
      setDownloading(false);
    }
  };

  if (!source) {
    return (
      <div className="vm-asset-unavailable">
        <strong>{asset.name}</strong>
        <span>Archivo no disponible.</span>
      </div>
    );
  }

  return (
    <article className={`vm-asset-card vm-asset-${asset.mediaType}`}>
      <div className="vm-asset-preview">
        {asset.mediaType === "image" ? (
          <img src={source} alt={asset.name} loading="lazy" />
        ) : asset.mediaType === "video" ? (
          <video
            src={source}
            poster={
              asset.builtinPath?.startsWith("/marketplace/animated/")
                ? asset.builtinPath
                    .replace("/animated/", "/originals/")
                    .replace(/\.mp4$/, ".png")
                : asset.builtinPath === "/marketplace/screensavers/aurora.mp4"
                  ? "/marketplace/covers/ambient-screen.png"
                  : undefined
            }
            controls
            muted
            loop
            playsInline
            preload="metadata"
            aria-label={`Vista previa de ${asset.name}`}
          />
        ) : asset.mediaType === "audio" ? (
          <audio
            src={source}
            controls
            preload="metadata"
            aria-label={`Escuchar ${asset.name}`}
          />
        ) : asset.mediaType === "profile" ? (
          <FileJson aria-hidden="true" />
        ) : (
          <FileArchive aria-hidden="true" />
        )}
      </div>
      <div className="vm-asset-copy">
        <h4>{asset.name}</h4>
        <div className="vm-asset-actions">
          <Button
            variant="outline"
            size="sm"
            disabled={downloading}
            onClick={() => void download()}
          >
            {downloading ? <Loader2 className="animate-spin" /> : <Download />}
            {downloading
              ? "Abriendo…"
              : isAndroidNative()
                ? "Abrir archivo"
                : "Descargar"}
          </Button>
          {(asset.mediaType === "image" || asset.mediaType === "video") && (
            <>
              <MarketplaceKeyApply
                productId={product.productId}
                asset={asset}
              />
              <MarketplaceDisplayApply
                productId={product.productId}
                asset={asset}
              />
            </>
          )}
        </div>
      </div>
    </article>
  );
}
