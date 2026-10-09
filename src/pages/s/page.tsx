import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import { useParams } from "react-router-dom";
import { Maximize, Minimize, MoonStar } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import StatusIcon from "@/components/status-icon.tsx";
import { readableTextColor } from "@/lib/color.ts";
import { immersive, isAndroidNative } from "@/lib/android-native.ts";

type PublicStatus = {
  id: string;
  name: string;
  color: string;
  icon: string;
  mediaUrl: string | null;
  mediaType: "image" | "video" | null;
};

// Imagen o video que cubre toda la pantalla
function MediaBackground({ status, volume }: { status: PublicStatus; volume: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // El volumen se aplica por propiedad: React no actualiza "muted" de forma fiable
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = volume / 100;
      video.muted = volume === 0;
    }
  }, [volume, status.mediaUrl]);

  if (!status.mediaUrl) {
    return null;
  }
  return (
    <>
      {status.mediaType === "video" ? (
        <video
          ref={videoRef}
          key={status.mediaUrl}
          src={status.mediaUrl}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <img
          key={status.mediaUrl}
          src={status.mediaUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      )}
      {/* Degradado para que el texto se lea sobre cualquier imagen */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30" />
    </>
  );
}

// Pantalla pública: ocupa toda la ventana y cambia en vivo con el estado marcado
export default function PublicStatusPage() {
  const { slug = "" } = useParams();
  const data = useQuery(api.public_status.getPublicStatus, { slug });
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const enterFullscreen = async () => {
    if (isAndroidNative()) {
      await immersive.enter();
      setIsFullscreen(true);
      return;
    }
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => undefined);
    }
  };

  const toggleFullscreen = async () => {
    if (isAndroidNative()) {
      if (isFullscreen) { await immersive.exit(); setIsFullscreen(false); }
      else await enterFullscreen();
      return;
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await enterFullscreen();
    }
  };

  useEffect(() => {
    if (!isAndroidNative()) return;
    const back = (event: Event) => {
      if (!isFullscreen) return;
      event.preventDefault();
      void immersive.exit().then(() => setIsFullscreen(false));
    };
    window.addEventListener("viso:android-back", back);
    return () => window.removeEventListener("viso:android-back", back);
  }, [isFullscreen]);

  useEffect(() => () => { if (isAndroidNative()) void immersive.exit().catch(() => undefined); }, []);

  if (data === undefined) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!data.found) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <MoonStar className="size-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Este link ya no existe</h1>
        <p className="max-w-sm text-muted-foreground">
          Pide a la persona un link nuevo: es posible que lo haya renovado.
        </p>
      </div>
    );
  }

  const { status, ownerName } = data;
  const hasMedia = status?.mediaUrl != null;
  const background = status?.color ?? "#0b0c10";
  const textColor = hasMedia ? "#ffffff" : status ? readableTextColor(status.color) : "#ffffff";

  return (
    // El navegador solo permite pantalla completa tras un toque: un toque en cualquier parte la activa
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden p-8 text-center"
      animate={{ backgroundColor: background }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      style={{ color: textColor }}
      onClick={() => void enterFullscreen()}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={status?.id ?? "none"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="absolute inset-0 flex flex-col items-center justify-center p-8"
        >
          {status && <MediaBackground status={status} volume={data.volume} />}
          {!hasMedia && (
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgb(255_255_255/0.18),transparent_65%)]" />
          )}

          <div
            className={
              hasMedia
                ? "relative mt-auto flex flex-col items-center gap-3 pb-6"
                : "relative flex flex-col items-center gap-8"
            }
          >
            {status ? (
              <>
                <StatusIcon
                  name={status.icon}
                  strokeWidth={1.25}
                  className={
                    hasMedia
                      ? "size-[clamp(3rem,8vw,6rem)]"
                      : "size-[clamp(6rem,22vw,16rem)]"
                  }
                />
                <h1
                  className={
                    hasMedia
                      ? "text-balance text-[clamp(2rem,7vw,5rem)] font-bold uppercase leading-none tracking-tight drop-shadow-lg"
                      : "text-balance text-[clamp(3rem,13vw,11rem)] font-bold uppercase leading-none tracking-tight"
                  }
                >
                  {status.name}
                </h1>
              </>
            ) : (
              <>
                <MoonStar
                  strokeWidth={1.25}
                  className="size-[clamp(5rem,16vw,12rem)] opacity-60"
                />
                <h1 className="text-[clamp(2rem,8vw,6rem)] font-semibold opacity-60">
                  Sin estado
                </h1>
              </>
            )}
            {ownerName && (
              <p className="text-lg opacity-80 sm:text-2xl">{ownerName}</p>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {!isFullscreen && (
        <p className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 text-sm text-white backdrop-blur">
          Toca la pantalla para verla completa
        </p>
      )}

      <Button
        variant="secondary"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          void toggleFullscreen();
        }}
        aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
        className="absolute bottom-5 right-5 opacity-30 transition-opacity hover:opacity-100 focus-visible:opacity-100"
      >
        {isFullscreen ? <Minimize /> : <Maximize />}
      </Button>
    </motion.div>
  );
}
