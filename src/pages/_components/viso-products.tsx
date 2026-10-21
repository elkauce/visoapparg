import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const VISO_PRODUCTS = [
  {
    id: "mini",
    name: "VISO Mini",
    image: "/products/viso-mini.png",
    caption: "Compacto, elegante y siempre visible.",
    shortCaption: "Estado al instante",
    detail:
      "Una pantalla compacta para mostrar tu estado en el escritorio o junto a tu espacio de trabajo.",
  },
  {
    id: "display",
    name: "VISO Display",
    image: "/products/viso-display.png",
    caption: "Toda tu agenda, en gran formato.",
    shortCaption: "Tu estado y tus widgets",
    detail:
      "Una pantalla horizontal para reunir tu estado y la información que elegís mostrar.",
  },
  {
    id: "matrix",
    name: "VISO Matrix",
    image: "/products/viso-matrix.png",
    caption: "Simple, claro y expresivo.",
    shortCaption: "Indicador en grande",
    detail:
      "Una matriz de luces para expresar tus estados con iconos y colores personalizados.",
  },
] as const;

export function ProductHero({
  color,
  demo = false,
}: {
  color: string;
  demo?: boolean;
}) {
  const reduced = useReducedMotion();
  const mobile = useIsMobile();
  const section = useRef<HTMLElement>(null);
  const inputMode = useRef<"keyboard" | "pointer">("keyboard");
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [interaction, setInteraction] = useState(0);
  const [viewport, carousel] = useEmblaCarousel({
    loop: true,
    startIndex: 1,
    duration: reduced ? 0 : 25,
  });
  const [selected, setSelected] = useState(1);
  const sync = useCallback(() => {
    if (carousel) setSelected(carousel.selectedScrollSnap());
  }, [carousel]);
  useEffect(() => {
    if (!carousel) return;
    const startDrag = () => setDragging(true);
    const endDrag = () => setDragging(false);
    carousel
      .on("select", sync)
      .on("reInit", sync)
      .on("pointerDown", startDrag)
      .on("pointerUp", endDrag);
    return () => {
      carousel
        .off("select", sync)
        .off("reInit", sync)
        .off("pointerDown", startDrag)
        .off("pointerUp", endDrag);
    };
  }, [carousel, sync]);
  useEffect(() => {
    const updateVisibility = () => setPageVisible(!document.hidden);
    const keyboardInteraction = () => {
      inputMode.current = "keyboard";
      if (section.current?.contains(document.activeElement)) setFocused(true);
    };
    document.addEventListener("visibilitychange", updateVisibility);
    document.addEventListener("keydown", keyboardInteraction);
    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
      document.removeEventListener("keydown", keyboardInteraction);
    };
  }, []);
  useEffect(() => {
    if (!section.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
    });
    observer.observe(section.current);
    return () => observer.disconnect();
  }, []);
  const autoplay =
    mobile &&
    !reduced &&
    visible &&
    pageVisible &&
    !paused &&
    !dragging &&
    !hovered &&
    !focused;
  useEffect(() => {
    if (!carousel || !autoplay) return;
    const timer = window.setTimeout(() => {
      if (carousel.canScrollNext()) carousel.scrollNext();
      else carousel.scrollTo(0);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [carousel, autoplay, selected, interaction]);
  return (
    <section
      ref={section}
      className="viso-product-hero"
      aria-label="Productos VISO"
      aria-roledescription="carrusel"
      style={{ backgroundColor: color }}
      data-state-color={color}
      onPointerEnter={(event) =>
        event.pointerType === "mouse" && setHovered(true)
      }
      onPointerLeave={() => setHovered(false)}
      onPointerDownCapture={() => {
        inputMode.current = "pointer";
        setFocused(false);
        setInteraction((value) => value + 1);
      }}
      onPointerCancel={() => setDragging(false)}
      onFocusCapture={() => setFocused(inputMode.current === "keyboard")}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      {demo && <span className="viso-demo-label">Demo</span>}
      <div ref={viewport} className="viso-carousel-viewport">
        <div className="viso-carousel-track">
          {VISO_PRODUCTS.map((product, index) => (
            <div
              key={product.id}
              className={`viso-carousel-slide viso-slide-${product.id}`}
              aria-hidden={selected !== index}
              inert={selected !== index}
            >
              <img
                src={product.image}
                alt={product.name}
                draggable={false}
                decoding="async"
                width={product.id === "display" ? 1666 : 1024}
                height={product.id === "display" ? 938 : 1024}
              />
              <div className="viso-carousel-copy">
                <h2>{product.name}</h2>
                <p>{product.shortCaption}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <button
        className="viso-carousel-arrow viso-arrow-left"
        aria-label="Producto anterior"
        onClick={() => carousel?.scrollPrev()}
      >
        <ChevronLeft />
      </button>
      <button
        className="viso-carousel-arrow viso-arrow-right"
        aria-label="Producto siguiente"
        onClick={() => carousel?.scrollNext()}
      >
        <ChevronRight />
      </button>
      <div className="viso-carousel-dots" aria-label="Elegir producto">
        {VISO_PRODUCTS.map((product, index) => (
          <button
            key={product.id}
            aria-label={`Mostrar ${product.name}`}
            aria-pressed={selected === index}
            onClick={() => carousel?.scrollTo(index)}
          >
            <span />
          </button>
        ))}
      </div>
      {mobile && !reduced && (
        <button
          className="viso-carousel-playback"
          aria-label={
            paused
              ? "Reanudar carrusel automático"
              : "Pausar carrusel automático"
          }
          aria-pressed={paused}
          onClick={() => {
            setPaused(!paused);
            // An explicit resume also allows playback while this control has focus.
            if (paused) setFocused(false);
          }}
        >
          {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
        </button>
      )}
    </section>
  );
}

export function ProductCollection() {
  const [selected, setSelected] = useState<
    (typeof VISO_PRODUCTS)[number] | null
  >(null);
  return (
    <>
      <section
        id="viso-products"
        className="viso-products-section"
        aria-label="Dispositivos VISO"
      >
        <div className="viso-products-heading">
          <h2>
            <span className="viso-desktop-copy">Tu estado, también en el </span>
            <span className="viso-desktop-copy">mundo real.</span>
            <span className="viso-mobile-copy">Dispositivos VISO</span>
          </h2>
          <p className="viso-desktop-copy">
            Tres formas de hacer visible tu espacio.
          </p>
        </div>
        <div className="viso-product-cards">
          {VISO_PRODUCTS.map((product) => (
            <button
              key={product.id}
              className={`viso-product-card viso-card-${product.id}`}
              onClick={() => setSelected(product)}
              aria-label={`Conocer ${product.name}`}
            >
              <div className="viso-product-card-copy">
                <h3>{product.name}</h3>
                <p className="viso-product-caption-desktop viso-desktop-copy">
                  {product.caption}
                </p>
                <p className="viso-product-caption-mobile viso-mobile-copy">
                  {product.shortCaption}
                </p>
              </div>
              <img src={product.image} alt="" loading="lazy" decoding="async" />
              <span className="viso-product-more viso-desktop-copy">
                Conocer más →
              </span>
            </button>
          ))}
        </div>
      </section>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.name}</DialogTitle>
                <DialogDescription>{selected.caption}</DialogDescription>
              </DialogHeader>
              <img
                src={selected.image}
                alt={selected.name}
                className="h-56 w-full object-contain"
              />
              <p>{selected.detail}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
