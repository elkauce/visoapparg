import {
  Component,
  lazy,
  Suspense,
  useDeferredValue,
  type ReactNode,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Check,
  ChevronRight,
  Compass,
  Image,
  Library,
  Loader2,
  Monitor,
  Package,
  PanelsTopLeft,
  Plug,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  X,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { MarketplaceCategory } from "@/convex/lib/marketplace_catalog";
import { Button } from "@/components/ui/button";
import { SignInButton } from "@/components/ui/signin";
import { VisoBrand } from "@/components/viso-brand";
import MarketProductDialog from "./product-detail";
import MarketLibrary from "./library";
import { MarketplaceOrders } from "./checkout";
import { CATEGORY_LABELS, productPrice, type MarketProduct } from "./types";
import PanelLayout from "../_components/panel-layout";
import "./marketplace.css";

const MarketplaceStudio = lazy(() => import("./studio"));
const MarketplaceAdmin = lazy(() => import("./admin"));
const CreatorDocs = lazy(() => import("./creator-docs"));

const CATEGORIES = [
  { id: "discover", label: "Descubrir", icon: Compass },
  { id: "icons", label: "Iconos", icon: Image },
  { id: "plugins", label: "Plugins", icon: Plug },
  { id: "profiles", label: "Perfiles", icon: PanelsTopLeft },
  { id: "screensavers", label: "Protectores", icon: Monitor },
  { id: "soundboards", label: "Sonidos", icon: AudioLines },
  { id: "hardware", label: "Hardware", icon: Package },
  { id: "used", label: "Usados", icon: Store },
  { id: "new", label: "Nuevo", icon: Sparkles },
  { id: "pages", label: "Página", icon: PanelsTopLeft },
] as const;

type Category = (typeof CATEGORIES)[number]["id"];
type View = "discover" | "library" | "studio" | "admin" | "docs";

function isCategory(value: string | null): value is Category {
  return CATEGORIES.some((category) => category.id === value);
}

export function ProductCard({
  product,
  onOpen,
}: {
  product: MarketProduct;
  onOpen: () => void;
}) {
  return (
    <button className="vm-product-card" type="button" onClick={onOpen}>
      <div
        className={`vm-product-cover${product.category === "hardware" ? " vm-hardware-cover" : ""}`}
      >
        {product.coverUrl ? (
          <img src={product.coverUrl} alt="" loading="lazy" />
        ) : (
          <Package aria-hidden="true" />
        )}
        {product.acquired && (
          <span className="vm-cover-badge">
            <Check aria-hidden="true" /> En tu biblioteca
          </span>
        )}
      </div>
      <div className="vm-product-copy">
        <span className="vm-product-category">
          {CATEGORY_LABELS[product.category]}
        </span>
        <h3>{product.title}</h3>
        <p className="vm-product-description">{product.description}</p>
        <div className="vm-product-footer">
          <span className="vm-creator-label">
            <span className="vm-creator-mark" aria-hidden="true">
              {product.creatorName.slice(0, 1).toUpperCase()}
            </span>
            {product.creatorName}
          </span>
          <span className="vm-product-price">
            {productPrice(product)}
            <ArrowUpRight aria-hidden="true" />
          </span>
        </div>
        {product.affiliate && (
          <span className="vm-affiliate-note">Enlace afiliado</span>
        )}
      </div>
    </button>
  );
}

export function MarketLoading() {
  return (
    <div className="vm-loading" role="status">
      <Loader2 className="animate-spin" aria-hidden="true" />
      <span>Cargando tu espacio…</span>
    </div>
  );
}

class MarketBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="vm-empty" role="alert">
          <Store aria-hidden="true" />
          <h2>No pudimos cargar el marketplace</h2>
          <p>Revisá tu conexión y volvé a intentarlo.</p>
          <Button onClick={() => window.location.reload()}>
            Intentar de nuevo
          </Button>
          <Link to="/">Volver al panel</Link>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function MarketplacePage() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="viso-marketplace vm-auth-shell">
        <MarketLoading />
      </div>
    );
  }
  if (!isAuthenticated) {
    return (
      <div className="viso-marketplace vm-auth-shell">
        <Link to="/" aria-label="Volver a VISO">
          <VisoBrand />
        </Link>
        <div className="vm-auth-card">
          <span className="vm-eyebrow">MARKETPLACE VISO</span>
          <h1>Un espacio para hacerlo tuyo.</h1>
          <p>
            Entrá a tu cuenta para descubrir recursos, guardarlos en tu
            biblioteca y personalizar tu deck.
          </p>
          <SignInButton signInText="Entrar al marketplace" />
          <Button variant="ghost" asChild>
            <Link to="/">
              <ArrowLeft /> Volver a VISO
            </Link>
          </Button>
        </div>
      </div>
    );
  }
  return (
    <PanelLayout section="marketplace" className="viso-marketplace">
      <MarketBoundary>
        <MarketplaceContent />
      </MarketBoundary>
    </PanelLayout>
  );
}

function MarketplaceContent() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const route = useParams<{ productId?: string }>();
  const session = useQuery(api.marketplace.session, {});
  const requestedView = params.get("view");
  const view: View =
    requestedView === "library" ||
    requestedView === "studio" ||
    requestedView === "admin" ||
    requestedView === "docs"
      ? requestedView
      : "discover";
  const category = isCategory(params.get("category"))
    ? (params.get("category") as Category)
    : "discover";
  const search = params.get("q") ?? "";
  const deferredSearch = useDeferredValue(search);
  const products = useQuery(
    api.marketplace.list,
    view === "discover"
      ? {
          ...(category !== "discover"
            ? { category: category as MarketplaceCategory }
            : {}),
          ...(deferredSearch.trim() ? { search: deferredSearch.trim() } : {}),
        }
      : "skip",
  );
  const productId = route.productId ?? params.get("product");

  const chooseView = (next: View) => {
    const update = new URLSearchParams(params);
    update.delete("product");
    if (next === "discover") update.delete("view");
    else update.set("view", next);
    navigate(`/marketplace${update.size ? `?${update}` : ""}`);
  };
  const chooseCategory = (next: Category) => {
    const update = new URLSearchParams();
    if (next !== "discover") update.set("category", next);
    navigate(`/marketplace${update.size ? `?${update}` : ""}`);
  };
  const openProduct = (id: string) => {
    const update = new URLSearchParams(params);
    update.delete("product");
    navigate(
      `/marketplace/products/${encodeURIComponent(id)}${update.size ? `?${update}` : ""}`,
    );
  };
  const closeProduct = () => {
    const update = new URLSearchParams(params);
    update.delete("product");
    navigate(`/marketplace${update.size ? `?${update}` : ""}`);
  };
  const changeSearch = (value: string) => {
    const update = new URLSearchParams(params);
    if (value) update.set("q", value);
    else update.delete("q");
    setParams(update, { replace: true });
  };
  const title =
    view === "library"
      ? "Mi biblioteca"
      : view === "studio"
        ? "Espacio creador"
        : view === "docs"
          ? "Documentación para creadores"
          : view === "admin"
            ? "Administración"
            : category === "discover"
              ? "Descubrí tu próximo favorito."
              : CATEGORY_LABELS[category];
  const featured =
    products?.find((product) => product.id === "viso-living-icons") ??
    products?.find((product) => product.category === "icons");

  return (
    <>
      <header className="viso-panel-header vm-workspace-header">
        <div>
          <VisoBrand className="viso-panel-mobile-brand" />
          <p className="vm-workspace-title">Marketplace</p>
          <p>Recursos para tu espacio VISO.</p>
        </div>
        <nav aria-label="Tu espacio en Marketplace" className="vm-header-nav">
          <button
            type="button"
            aria-label="Descubrir recursos"
            aria-current={view === "discover" ? "page" : undefined}
            onClick={() => chooseCategory("discover")}
          >
            <Compass /> <span>Descubrir</span>
          </button>
          <button
            type="button"
            aria-label="Mi biblioteca"
            aria-current={view === "library" ? "page" : undefined}
            onClick={() => chooseView("library")}
          >
            <Library /> <span>Mi biblioteca</span>
          </button>
          <button
            type="button"
            aria-label="Espacio creador"
            aria-current={view === "studio" ? "page" : undefined}
            onClick={() => chooseView("studio")}
          >
            <Users /> <span>Espacio creador</span>
          </button>
          {session?.isAdmin && (
            <button
              type="button"
              aria-label="Administrar marketplace"
              aria-current={view === "admin" ? "page" : undefined}
              onClick={() => chooseView("admin")}
            >
              <ShieldCheck /> <span>Administrar</span>
            </button>
          )}
        </nav>
      </header>

      <div className="vm-shell vm-unified-shell">
        <section className="vm-filters" aria-label="Explorar marketplace">
          <nav
            aria-label="Categorías del marketplace"
            className="vm-categories"
          >
            {CATEGORIES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-current={
                  view === "discover" && category === id ? "page" : undefined
                }
                onClick={() => chooseCategory(id)}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <button
            className="vm-docs-link"
            type="button"
            onClick={() => chooseView("docs")}
          >
            <BookOpen aria-hidden="true" /> Guía para creadores
          </button>
        </section>

        <main className="vm-main" id="marketplace-content">
          {!productId && (
            <div className="vm-page-heading">
              <div>
                <span className="vm-eyebrow">TU ECOSISTEMA VISO</span>
                <h1>{title}</h1>
                <p>
                  {view === "library"
                    ? "Tus recursos, listos para darles tu estilo."
                    : view === "studio"
                      ? "Creá, compartí y hacé crecer tu espacio."
                      : view === "admin"
                        ? "Cuidá lo que compartimos con la comunidad."
                        : category === "used"
                          ? "Oportunidades seleccionadas por VISO, con enlaces de afiliado."
                          : "Recursos originales, creadores y equipos para tu espacio."}
                </p>
              </div>
              {view === "discover" && (
                <label className="vm-search">
                  <Search aria-hidden="true" />
                  <span className="sr-only">Buscar en el marketplace</span>
                  <input
                    type="search"
                    placeholder="Buscar recursos o creadores"
                    maxLength={120}
                    value={search}
                    onChange={(event) => changeSearch(event.target.value)}
                  />
                  {search && (
                    <button
                      type="button"
                      aria-label="Limpiar búsqueda"
                      onClick={() => changeSearch("")}
                    >
                      <X />
                    </button>
                  )}
                </label>
              )}
            </div>
          )}

          {productId ? (
            <MarketProductDialog
              productId={productId}
              onClose={closeProduct}
              onAcquired={() => chooseView("library")}
            />
          ) : view === "docs" ? (
            <Suspense fallback={<MarketLoading />}>
              <CreatorDocs />
            </Suspense>
          ) : view === "discover" ? (
            <>
              {category === "discover" && !search && featured && (
                <section className="vm-featured" aria-label="Destacado de VISO">
                  <div className="vm-featured-copy">
                    <span className="vm-featured-label">
                      <Sparkles aria-hidden="true" /> ORIGINAL DE VISO
                    </span>
                    <h2>Que cada tecla hable de vos.</h2>
                    <p>
                      Imágenes y animaciones para darle vida a tu deck. Tu
                      estilo, con las funciones de siempre.
                    </p>
                    <Button onClick={() => openProduct(featured.id)}>
                      Descubrir VISO Pulso <ArrowUpRight />
                    </Button>
                  </div>
                  <button
                    className="vm-featured-art"
                    type="button"
                    onClick={() => openProduct(featured.id)}
                    aria-label={`Ver ${featured.title}`}
                  >
                    {featured.coverUrl && (
                      <img src={featured.coverUrl} alt="" />
                    )}
                    <span className="vm-featured-mobile-art" aria-hidden="true">
                      <img src="/marketplace/animated/libre.gif" alt="" />
                      <img src="/marketplace/animated/ocupado.gif" alt="" />
                      <img src="/marketplace/animated/reunion.gif" alt="" />
                    </span>
                  </button>
                </section>
              )}
              <div className="vm-section-heading">
                <h2>
                  {search
                    ? "Resultados de búsqueda"
                    : category === "discover"
                      ? "Hecho para tu espacio"
                      : `Explorá ${CATEGORY_LABELS[category].toLowerCase()}`}
                </h2>
                {category === "discover" && !search && (
                  <button type="button" onClick={() => chooseCategory("icons")}>
                    Ver iconos <ChevronRight />
                  </button>
                )}
              </div>
              {products === undefined ? (
                <MarketLoading />
              ) : products.length ? (
                <div className="vm-product-grid" aria-live="polite">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onOpen={() => openProduct(product.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="vm-empty" role="status">
                  {category === "used" ? <Store /> : <Search />}
                  <h2>
                    {search
                      ? "No encontramos coincidencias"
                      : category === "used"
                        ? "Pronto, oportunidades seleccionadas"
                        : "Este espacio está listo para crecer"}
                  </h2>
                  <p>
                    {search
                      ? "Probá con otro nombre o explorá las categorías."
                      : category === "used"
                        ? "VISO publicará aquí los usados con sus enlaces de afiliado a Mercado Libre."
                        : "Las nuevas publicaciones aparecerán acá después de su aprobación."}
                  </p>
                  {search ? (
                    <Button variant="outline" onClick={() => changeSearch("")}>
                      Limpiar búsqueda
                    </Button>
                  ) : category === "used" && session?.isAdmin ? (
                    <Button onClick={() => chooseView("admin")}>
                      Publicar una oportunidad
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => chooseCategory("discover")}
                    >
                      Seguir explorando
                    </Button>
                  )}
                </div>
              )}
            </>
          ) : view === "library" ? (
            <>
              <MarketLibrary onExplore={() => chooseCategory("discover")} />
              <MarketplaceOrders />
            </>
          ) : view === "admin" && session === undefined ? (
            <MarketLoading />
          ) : view === "admin" && !session?.isAdmin ? (
            <div className="vm-empty" role="alert">
              <ShieldCheck />
              <h2>Esta sección es para administradores</h2>
              <p>Podés explorar los recursos o abrir tu espacio de creador.</p>
              <Button onClick={() => chooseCategory("discover")}>
                Explorar recursos
              </Button>
            </div>
          ) : (
            <Suspense fallback={<MarketLoading />}>
              {view === "studio" ? <MarketplaceStudio /> : <MarketplaceAdmin />}
            </Suspense>
          )}
        </main>
      </div>
    </>
  );
}
