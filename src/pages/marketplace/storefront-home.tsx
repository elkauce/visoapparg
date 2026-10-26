import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Store,
  Users,
} from "lucide-react";
import { STORE_CATEGORIES } from "./store-categories";
import {
  storefrontTargetUrl,
  type StorefrontConfiguration,
} from "./storefront-model";
import StoreMedia from "./store-media";

export function StoreCarousel({
  configuration,
}: {
  configuration: StorefrontConfiguration;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);
  const touch = useRef<number | null>(null);
  const swiped = useRef(false);
  const slides = configuration.slides;
  const count = slides.length;
  const active = count ? index % count : 0;
  useEffect(() => {
    const change = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", change);
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const motion = () => setReduced(mq?.matches ?? false);
    motion();
    mq?.addEventListener("change", motion);
    return () => {
      document.removeEventListener("visibilitychange", change);
      mq?.removeEventListener("change", motion);
    };
  }, []);
  useEffect(() => {
    if (
      !configuration.showSlider ||
      count < 2 ||
      paused ||
      hover ||
      hidden ||
      reduced
    )
      return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % count),
      configuration.intervalSeconds * 1000,
    );
    return () => clearInterval(timer);
  }, [
    configuration.showSlider,
    configuration.intervalSeconds,
    count,
    paused,
    hover,
    hidden,
    reduced,
  ]);
  if (!configuration.showSlider || !count) return null;
  const slide = slides[active];
  const move = (delta: number) => setIndex((active + delta + count) % count);
  return (
    <section
      className="vm-store-carousel"
      aria-label="Destacados de VISO"
      aria-roledescription="carrusel"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setHover(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHover(false);
      }}
      onTouchStart={(e) => {
        touch.current = e.touches[0]?.clientX ?? null;
        swiped.current = false;
      }}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const d =
          (e.changedTouches[0]?.clientX ?? touch.current) - touch.current;
        if (Math.abs(d) > 40) {
          move(d < 0 ? 1 : -1);
          swiped.current = true;
        }
        touch.current = null;
      }}
    >
      <Link
        to={storefrontTargetUrl(slide.target)}
        className="vm-carousel-slide"
        onClick={(e) => {
          if (swiped.current) e.preventDefault();
        }}
      >
        <div className="vm-carousel-copy">
          <span>VISO · DESTACADOS</span>
          <h2>{slide.title}</h2>
          <p>{slide.subtitle}</p>
          <strong>
            {slide.buttonLabel || "Descubrir"}
            <ChevronRight />
          </strong>
        </div>
        {slide.media?.builtinPath === "/marketplace/covers/living-icons.png" ? (
          <div className="vm-hero-keys" aria-hidden="true">
            {[
              "libre",
              "ocupado",
              "reunion",
              "llamada",
              "no-molestar",
              "ausente",
            ].map((id) => (
              <img key={id} src={`/marketplace/originals/${id}.png`} alt="" />
            ))}
          </div>
        ) : (
          <StoreMedia
            key={slide.id}
            media={slide.media}
            className="vm-carousel-media"
          />
        )}
      </Link>
      {count > 1 && (
        <>
          <button
            className="vm-carousel-arrow vm-prev"
            aria-label="Slide anterior"
            onClick={() => move(-1)}
          >
            <ChevronLeft />
          </button>
          <button
            className="vm-carousel-arrow vm-next"
            aria-label="Slide siguiente"
            onClick={() => move(1)}
          >
            <ChevronRight />
          </button>
          <div className="vm-carousel-pagination">
            {slides.map((s, i) => (
              <button
                key={s.id}
                aria-label={`Ir al slide ${i + 1}: ${s.title}`}
                aria-pressed={active === i}
                onClick={() => setIndex(i)}
              />
            ))}
            <button
              className="vm-carousel-pause"
              aria-label={paused ? "Reanudar carrusel" : "Pausar carrusel"}
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? <Play /> : <Pause />}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
export function CategoryTiles({
  configuration,
}: {
  configuration: StorefrontConfiguration;
}) {
  return (
    <nav className="vm-category-tiles" aria-label="Accesos de categorías">
      {configuration.categories
        .filter((c) => c.visible)
        .map((c) => {
          const Icon =
            STORE_CATEGORIES.find((x) => x.id === c.category)?.icon ?? Store;
          return (
            <Link
              key={c.category}
              to={storefrontTargetUrl({ kind: "category", value: c.category })}
              aria-label={c.label}
            >
              <span>{c.media ? <StoreMedia media={c.media} /> : <Icon />}</span>
              {c.showName && <small>{c.label}</small>}
            </Link>
          );
        })}
    </nav>
  );
}
