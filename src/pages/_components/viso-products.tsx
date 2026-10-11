import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
    caption: "Compacto. Tu estado siempre visible.",
    detail:
      "Una pantalla compacta para mostrar tu estado en el escritorio o junto a tu espacio de trabajo.",
  },
  {
    id: "display",
    name: "VISO Display",
    image: "/products/viso-display.png",
    caption: "Tu estado, agenda y widgets en un solo lugar.",
    detail:
      "Una pantalla horizontal para reunir tu estado y la información que elegís mostrar.",
  },
  {
    id: "matrix",
    name: "VISO Matrix",
    image: "/products/viso-matrix.png",
    caption: "Iconos y colores que hablan por vos.",
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
  const [viewport, carousel] = useEmblaCarousel({
    loop: true,
    duration: reduced ? 0 : 25,
  });
  const [selected, setSelected] = useState(0);
  const sync = useCallback(() => {
    if (carousel) setSelected(carousel.selectedScrollSnap());
  }, [carousel]);
  useEffect(() => {
    if (!carousel) return;
    carousel.on("select", sync).on("reInit", sync);
    return () => {
      carousel.off("select", sync).off("reInit", sync);
    };
  }, [carousel, sync]);
  return (
    <section
      className="viso-product-hero"
      aria-label="Productos VISO"
      aria-roledescription="carrusel"
      style={{ backgroundColor: color }}
      data-state-color={color}
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
              <div>
                <h2>{product.name}</h2>
                <p>{product.caption}</p>
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
            <span className="viso-desktop-copy viso-green">mundo real</span>
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
              <img src={product.image} alt="" loading="lazy" decoding="async" />
              <h3>{product.name}</h3>
              <p className="viso-desktop-copy">{product.caption}</p>
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
