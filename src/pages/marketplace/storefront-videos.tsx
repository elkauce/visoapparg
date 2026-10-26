import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Play, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { productVideo, storeMediaSource } from "./storefront-model";
import { productPrice, type MarketProduct } from "./types";

export default function StoreVideos({
  products,
}: {
  products: MarketProduct[] | undefined;
}) {
  const [params, setParams] = useSearchParams();
  const ref = useRef<HTMLVideoElement>(null);
  const videos = products?.filter((p) => productVideo(p)) ?? [];
  const selected = videos.find((p) => p.id === params.get("video"));
  const preview = selected ? productVideo(selected) : undefined;
  useEffect(() => {
    const stop = () => {
      if (document.hidden) ref.current?.pause();
    };
    document.addEventListener("visibilitychange", stop);
    return () => document.removeEventListener("visibilitychange", stop);
  }, []);
  function choose(id: string | null) {
    const next = new URLSearchParams(params);
    if (id) next.set("video", id);
    else next.delete("video");
    setParams(next);
  }
  if (products === undefined) return <p role="status">Cargando videos…</p>;
  if (selected && preview)
    return (
      <section className="vm-video-viewer" aria-label="Video de producto">
        <button className="vm-text-back" onClick={() => choose(null)}>
          <ArrowLeft /> Volver a videos
        </button>
        <div className="vm-video-stage">
          <video
            ref={ref}
            key={selected.id}
            src={storeMediaSource(preview)!}
            controls
            autoPlay
            playsInline
            preload="metadata"
            poster={selected.coverUrl ?? undefined}
            aria-label={preview.name || selected.title}
          />
        </div>
        <div className="vm-video-product">
          <div>
            <small>{selected.creatorName}</small>
            <h1>{selected.title}</h1>
            <strong>{productPrice(selected)}</strong>
          </div>
          <Button asChild>
            <Link
              to={`/marketplace/products/${encodeURIComponent(selected.id)}?view=videos`}
            >
              Ver producto <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    );
  return (
    <section>
      <header className="vm-store-heading">
        <div>
          <h1>Videos</h1>
          <p>Descubrí productos en movimiento.</p>
        </div>
      </header>
      {!videos.length ? (
        <div className="vm-empty">
          <Video />
          <h2>Pronto, más demostraciones</h2>
          <p>Los videos de los productos publicados aparecerán acá.</p>
        </div>
      ) : (
        <div className="vm-video-grid">
          {videos.map((p) => (
            <button
              key={p.id}
              className="vm-video-card"
              onClick={() => choose(p.id)}
            >
              <div>
                {p.coverUrl ? (
                  <img src={p.coverUrl} alt="" loading="lazy" />
                ) : (
                  <Video />
                )}
                <span>
                  <Play /> Ver video
                </span>
              </div>
              <h2>{p.title}</h2>
              <p>{p.creatorName}</p>
              <strong>{productPrice(p)}</strong>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
