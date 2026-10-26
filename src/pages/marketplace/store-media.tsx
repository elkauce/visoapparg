import { useEffect, useRef, type CSSProperties } from "react";
import { storeMediaSource, type StorefrontMedia } from "./storefront-model";
/** Decorative previews play only while visible; the product's main player has explicit controls. */
export default function StoreMedia({
  media,
  alt = "",
  className = "",
  style,
}: {
  media?: StorefrontMedia;
  alt?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const source = storeMediaSource(media);
  useEffect(() => {
    const video = ref.current;
    if (
      !video ||
      !source ||
      typeof IntersectionObserver === "undefined" ||
      typeof matchMedia === "undefined"
    )
      return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const update = (visible: boolean) => {
      if (visible && !reduced.matches && !document.hidden)
        void video.play().catch(() => undefined);
      else video.pause();
    };
    let visible = false;
    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      update(visible);
    });
    observer.observe(video);
    const visibility = () => update(visible);
    document.addEventListener("visibilitychange", visibility);
    reduced.addEventListener("change", visibility);
    return () => {
      observer.disconnect();
      video.pause();
      document.removeEventListener("visibilitychange", visibility);
      reduced.removeEventListener("change", visibility);
    };
  }, [source]);
  if (!source) return null;
  return media?.mediaType === "video" ? (
    <video
      ref={ref}
      src={source}
      muted
      loop
      playsInline
      preload="metadata"
      className={className}
      style={style}
      aria-label={alt || undefined}
      aria-hidden={!alt}
    />
  ) : (
    <img
      src={source}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
    />
  );
}
