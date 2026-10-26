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
  ArrowRight,
  BookOpen,
  Check,
  Heart,
  Library,
  Loader2,
  Package,
  Play,
  Settings2,
  ShoppingCart,
  Store,
  Users,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { MarketplaceCategory } from "@/convex/lib/marketplace_catalog";
import { Button } from "@/components/ui/button";
import { SignInButton } from "@/components/ui/signin";
import { isAndroidNative } from "@/lib/android-native";
import MarketProductPage from "./product-detail";
import MarketLibrary from "./library";
import { MarketplaceOrders } from "./checkout";
import { CATEGORY_LABELS, productPrice, type MarketProduct } from "./types";
import StorefrontShell from "./storefront-shell";
import { CategoryTiles, StoreCarousel } from "./storefront-home";
import { DEFAULT_STOREFRONT, productVideo } from "./storefront-model";
import { STORE_CATEGORIES, type StoreCategory } from "./store-categories";
import { ShoppingProvider } from "./shopping-context";
import { useShopping } from "./use-shopping";
import StoreVideos from "./storefront-videos";
import StoreCart, { StoreCheckout } from "./storefront-cart";
import StoreCreator, {
  FollowingStores,
  CreatorDirectory,
} from "./storefront-creator";
import TimbreMarketplaceOffer from "../timbre/offers";
import "./marketplace.css";
import "./storefront.css";
const MarketplaceStudio = lazy(() => import("./studio"));
const MarketplaceAdmin = lazy(() => import("./admin"));
const CreatorDocs = lazy(() => import("./creator-docs"));
const VIEWS = [
  "discover",
  "library",
  "studio",
  "admin",
  "docs",
  "videos",
  "cart",
  "checkout",
  "account",
  "orders",
  "creator",
  "saved",
  "following",
  "creators",
] as const;
type View = (typeof VIEWS)[number];

export function ProductCard({
  product,
  onOpen,
}: {
  product: MarketProduct;
  onOpen: () => void;
}) {
  const shopping = useShopping();
  const video = productVideo(product);
  const saved = shopping?.saved.includes(product.id);
  const inCart = shopping?.cart.some((x) => x.productId === product.id);
  return (
    <article className="vm-product-card">
      <button className="vm-product-open" type="button" onClick={onOpen}>
        <div
          className={`vm-product-cover${["hardware", "new", "used"].includes(product.category) ? " vm-hardware-cover" : ""}`}
        >
          {product.coverUrl ? (
            <img src={product.coverUrl} alt="" loading="lazy" />
          ) : (
            <Package aria-hidden="true" />
          )}
          {video && (
            <span className="vm-video-badge">
              <Play /> Video
            </span>
          )}
          {product.acquired && (
            <span className="vm-cover-badge">
              <Check /> En tu biblioteca
            </span>
          )}
        </div>
        <div className="vm-product-copy">
          <small>{CATEGORY_LABELS[product.category]}</small>
          <h3>{product.title}</h3>
          <p className="vm-creator-label">{product.creatorName}</p>
          <strong
            className={`vm-product-price ${product.priceMode === "free" ? "is-free" : ""}`}
          >
            {productPrice(product)}
          </strong>
          {product.affiliate && (
            <small className="vm-affiliate-note">
              Compra externa · Enlace afiliado
            </small>
          )}
        </div>
      </button>
      {shopping && (
        <>
          <button
            className="vm-save-product"
            aria-label={`${saved ? "Quitar" : "Guardar"} ${product.title} ${saved ? "de" : "en"} favoritos`}
            aria-pressed={saved}
            onClick={() => void shopping.set(product.id, "saved", !saved)}
          >
            <Heart fill={saved ? "currentColor" : "none"} />
          </button>
          {!product.acquired && product.priceMode !== "info" && (
            <button
              className="vm-add-cart"
              aria-label={`${inCart ? "Quitar" : "Agregar"} ${product.title} ${inCart ? "del" : "al"} carrito`}
              aria-pressed={inCart}
              onClick={() => void shopping.set(product.id, "cart", !inCart)}
            >
              {inCart ? <Check /> : <ShoppingCart />}
            </button>
          )}
        </>
      )}
    </article>
  );
}
export function MarketLoading() {
  return (
    <div className="vm-loading" role="status">
      <Loader2 className="animate-spin" />
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
    return this.state.failed ? (
      <div className="vm-empty" role="alert">
        <Store />
        <h2>No pudimos cargar el marketplace</h2>
        <p>Revisá tu conexión y volvé a intentarlo.</p>
        <Button onClick={() => window.location.reload()}>
          Intentar de nuevo
        </Button>
        <Link to="/">Volver a VISO</Link>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function MarketplacePage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading)
    return (
      <div className="viso-marketplace vm-auth-shell">
        <MarketLoading />
      </div>
    );
  if (!isAuthenticated)
    return (
      <div className="viso-marketplace vm-auth-shell">
        <Link to="/" aria-label="Volver a VISO">
          <img src="/brand/viso-icon.png" alt="VISO" width="48" height="48" />
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
  return (
    <MarketBoundary>
      <ShoppingProvider>
        <MarketplaceContent />
      </ShoppingProvider>
    </MarketBoundary>
  );
}
function MarketplaceContent() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const route = useParams<{ productId?: string }>();
  const shopping = useShopping();
  const session = useQuery(api.marketplace.session, {});
  const settings = useQuery(api.marketplace_storefront.get, {});
  const configuration = settings?.configuration ?? DEFAULT_STOREFRONT;
  const requested = params.get("view");
  const view: View = VIEWS.includes(requested as View)
    ? (requested as View)
    : "discover";
  const rawCategory = params.get("category");
  const category: StoreCategory = STORE_CATEGORIES.some(
    (c) => c.id === rawCategory,
  )
    ? (rawCategory as StoreCategory)
    : "discover";
  const search = params.get("q") ?? "";
  const deferredSearch = useDeferredValue(search);
  const productId = route.productId ?? params.get("product");
  const wantsCatalog =
    !productId && ["discover", "videos", "creator", "saved"].includes(view);
  const products = useQuery(
    api.marketplace.list,
    wantsCatalog
      ? {
          ...(view === "discover" && category !== "discover"
            ? { category: category as MarketplaceCategory }
            : {}),
          ...(view === "discover" && deferredSearch.trim()
            ? { search: deferredSearch.trim() }
            : {}),
        }
      : "skip",
  );
  function openProduct(id: string) {
    const next = new URLSearchParams(params);
    next.delete("product");
    next.delete("video");
    navigate(
      `/marketplace/products/${encodeURIComponent(id)}${next.size ? `?${next}` : ""}`,
    );
  }
  function closeProduct() {
    const next = new URLSearchParams(params);
    next.delete("product");
    navigate(`/marketplace${next.size ? `?${next}` : ""}`);
  }
  function chooseView(next: View) {
    navigate(`/marketplace${next === "discover" ? "" : `?view=${next}`}`);
  }
  const price = params.get("price") ?? "all";
  const sort = params.get("sort") ?? "featured";
  const visible = products
    ?.filter(
      (p) =>
        (view !== "saved" || shopping?.saved.includes(p.id)) &&
        (price === "all" ||
          (price === "free" ? p.priceMode === "free" : p.priceMode !== "free")),
    )
    .slice()
    .sort((a, b) =>
      sort === "price-asc"
        ? (a.priceAmount ?? 0) - (b.priceAmount ?? 0)
        : sort === "price-desc"
          ? (b.priceAmount ?? 0) - (a.priceAmount ?? 0)
          : sort === "newest"
            ? (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
            : 0,
    );
  const home = view === "discover" && category === "discover" && !search;
  const title =
    view === "saved"
      ? "Tus favoritos"
      : search
        ? `Resultados para “${search}”`
        : category === "discover"
          ? "Para tu espacio"
          : CATEGORY_LABELS[category];
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value === "all" || value === "featured") next.delete(key);
    else next.set(key, value);
    setParams(next);
  }
  return (
    <StorefrontShell configuration={configuration} admin={!!session?.isAdmin}>
      {productId ? (
        <MarketProductPage
          key={productId}
          productId={productId}
          onClose={closeProduct}
          onAcquired={() => chooseView("library")}
        />
      ) : view === "discover" || view === "saved" ? (
        <>
          {home && (
            <>
              <StoreCarousel configuration={configuration} />
              <CategoryTiles configuration={configuration} />
            </>
          )}
          <div className="vm-catalog-layout">
            {!home && (
              <aside className="vm-catalog-sidebar">
                <h2>Filtrar</h2>
                <fieldset>
                  <legend>Precio</legend>
                  {[
                    ["all", "Todos"],
                    ["free", "Gratis"],
                    ["paid", "De pago"],
                  ].map(([id, label]) => (
                    <label key={id}>
                      <input
                        type="radio"
                        name="price"
                        checked={price === id}
                        onChange={() => filter("price", id)}
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
                <fieldset>
                  <legend>Categoría</legend>
                  {STORE_CATEGORIES.map(({ id, label }) => (
                    <Link
                      key={id}
                      to={
                        id === "discover"
                          ? "/marketplace"
                          : `/marketplace?category=${id}`
                      }
                    >
                      {label}
                    </Link>
                  ))}
                </fieldset>
              </aside>
            )}
            <section className="vm-catalog-products">
              <header className="vm-store-heading">
                <div>
                  <h1>{title}</h1>
                  {visible && (
                    <p>
                      {visible.length}{" "}
                      {visible.length === 1 ? "producto" : "productos"}
                    </p>
                  )}
                </div>
                <div className="vm-catalog-controls">
                  <label>
                    <span className="sr-only">Filtrar por precio</span>
                    <select
                      value={price}
                      onChange={(e) => filter("price", e.target.value)}
                    >
                      <option value="all">Todos los precios</option>
                      <option value="free">Gratis</option>
                      <option value="paid">De pago</option>
                    </select>
                  </label>
                  <label>
                    <span className="sr-only">Ordenar productos</span>
                    <select
                      value={sort}
                      onChange={(e) => filter("sort", e.target.value)}
                    >
                      <option value="featured">Destacados</option>
                      <option value="newest">Más recientes</option>
                      <option value="price-asc">Menor precio</option>
                      <option value="price-desc">Mayor precio</option>
                    </select>
                  </label>
                </div>
              </header>
              {visible === undefined ? (
                <MarketLoading />
              ) : visible.length ? (
                <div className="vm-product-grid" aria-live="polite">
                  {visible.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onOpen={() => openProduct(product.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="vm-empty" role="status">
                  <Store />
                  <h2>
                    {search
                      ? "No encontramos coincidencias"
                      : view === "saved"
                        ? "Guardá tus próximos favoritos"
                        : category === "used"
                          ? "Pronto, oportunidades seleccionadas"
                          : "Este espacio está listo para crecer"}
                  </h2>
                  <p>
                    {category === "used"
                      ? "VISO publicará aquí los usados con sus enlaces de afiliado a Mercado Libre."
                      : "Las publicaciones aprobadas aparecerán en el catálogo."}
                  </p>
                  {category === "used" && session?.isAdmin ? (
                    <Button onClick={() => chooseView("admin")}>
                      Publicar una oportunidad
                    </Button>
                  ) : (
                    <Button asChild variant="outline">
                      <Link to="/marketplace">Explorar productos</Link>
                    </Button>
                  )}
                </div>
              )}
            </section>
          </div>
          {home && (
            <div className="vm-store-service">
              <TimbreMarketplaceOffer />
            </div>
          )}
        </>
      ) : view === "videos" ? (
        <StoreVideos products={products} />
      ) : view === "creator" ? (
        <StoreCreator
          creatorId={params.get("creator") ?? "viso"}
          products={products}
          onOpen={openProduct}
        />
      ) : view === "creators" ? (
        <CreatorDirectory />
      ) : view === "following" ? (
        <FollowingStores />
      ) : view === "cart" ? (
        <StoreCart />
      ) : view === "checkout" ? (
        <StoreCheckout
          key={params.get("checkout")}
          productId={params.get("checkout") ?? ""}
        />
      ) : view === "library" ? (
        <>
          <header className="vm-store-heading">
            <div>
              <h1>Mi biblioteca</h1>
              <p>Todo lo tuyo, listo para usar.</p>
            </div>
          </header>
          {params.has("order") && (
            <MarketplaceOrders focusOrderId={params.get("order")} />
          )}
          <MarketLibrary onExplore={() => chooseView("discover")} />
        </>
      ) : view === "orders" ? (
        <>
          <header className="vm-store-heading">
            <h1>Mis compras</h1>
          </header>
          <MarketplaceOrders showEmpty />
        </>
      ) : view === "account" ? (
        <StoreAccount admin={!!session?.isAdmin} />
      ) : view === "admin" && session === undefined ? (
        <MarketLoading />
      ) : view === "admin" && !session?.isAdmin ? (
        <div className="vm-empty" role="alert">
          <Settings2 />
          <h1>Esta sección es para administradores</h1>
          <Link to="/marketplace">Explorar productos</Link>
        </div>
      ) : (
        <Suspense fallback={<MarketLoading />}>
          {view === "docs" ? (
            <CreatorDocs />
          ) : view === "studio" ? (
            <MarketplaceStudio />
          ) : (
            <MarketplaceAdmin />
          )}
        </Suspense>
      )}
    </StorefrontShell>
  );
}
function StoreAccount({ admin }: { admin: boolean }) {
  const links = [
    {
      label: "Mis compras",
      description: "Pagos y recursos adquiridos",
      to: "/marketplace?view=orders",
      icon: ShoppingCart,
    },
    {
      label: "Mi biblioteca",
      description: "Aplicá tus recursos al Deck y al Display",
      to: "/marketplace?view=library",
      icon: Library,
    },
    {
      label: "Favoritos",
      description: "Tus productos guardados",
      to: "/marketplace?view=saved",
      icon: Heart,
    },
    {
      label: "Tiendas que seguís",
      description: "Tus creadores favoritos",
      to: "/marketplace?view=following",
      icon: Store,
    },
    {
      label: "Espacio creador",
      description: "Publicá y editá tus productos",
      to: "/marketplace?view=studio",
      icon: Users,
    },
    {
      label: "Guía para creadores",
      description: "Prepará archivos y fichas compatibles",
      to: "/marketplace?view=docs",
      icon: BookOpen,
    },
    ...(admin
      ? [
          {
            label: "Administrar marketplace",
            description: "Portada, categorías, creadores y productos",
            to: "/marketplace?view=admin",
            icon: Settings2,
          },
        ]
      : []),
    {
      label: "Mi cuenta VISO",
      description: "Cuenta, Google y configuración",
      to: isAndroidNative() ? "/android/settings" : "/?section=account",
      icon: Settings2,
    },
  ];
  return (
    <section>
      <header className="vm-store-heading">
        <h1>Tu cuenta</h1>
      </header>
      <div className="vm-store-account">
        {links.map(({ label, description, to, icon: Icon }) => (
          <Link key={label} to={to}>
            <Icon />
            <span>
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
            <ArrowRight />
          </Link>
        ))}
      </div>
    </section>
  );
}
