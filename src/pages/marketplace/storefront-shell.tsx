import { useEffect, type CSSProperties, type ReactNode } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Grid2X2,
  Heart,
  Home,
  MoreHorizontal,
  Search,
  Settings2,
  ShoppingCart,
  Store,
  UserRound,
  Users,
  Video,
  X,
} from "lucide-react";
import { isAndroidNative } from "@/lib/android-native";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useShopping } from "./use-shopping";
import { STORE_CATEGORIES } from "./store-categories";
import type { StorefrontConfiguration } from "./storefront-model";

export default function StorefrontShell({
  configuration,
  admin,
  children,
}: {
  configuration: StorefrontConfiguration;
  admin: boolean;
  children: ReactNode;
}) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const shopping = useShopping();
  const view = params.get("view") ?? "discover";
  const category = params.get("category") ?? "discover";
  const selectedVideo = params.get("video");
  const checkout = params.get("checkout");
  useEffect(() => {
    document.scrollingElement?.scrollTo?.({ top: 0 });
  }, [location.pathname, view, category, selectedVideo, checkout]);
  const product = location.pathname.includes("/products/");
  const search = params.get("q") ?? "";
  const colors = configuration.pulse.colors.filter((c) =>
    /^#[\da-f]{6}$/i.test(c),
  );
  const colorSteps = colors.length ? colors : ["#f97316", "#22c55e"];
  const cycle =
    colorSteps
      .map(
        (color, i) =>
          `${(i * 100) / colorSteps.length}%{--vm-header-color:${color}}`,
      )
      .join("") + `100%{--vm-header-color:${colorSteps[0]}}`;
  const duration = { slow: 42, normal: 30, fast: 18 }[
    configuration.pulse.speed
  ];
  function searchFor(value: string) {
    const next = new URLSearchParams();
    if (value) next.set("q", value);
    if (category !== "discover") next.set("category", category);
    if (product || view !== "discover") navigate(`/marketplace?${next}`);
    else setParams(next, { replace: true });
  }
  const nav = [
    {
      label: "Tienda",
      to: "/marketplace",
      icon: Home,
      active: ["discover", "creator", "saved"].includes(view),
    },
    {
      label: "Videos",
      to: "/marketplace?view=videos",
      icon: Video,
      active: view === "videos",
    },
    {
      label: "Carrito",
      to: "/marketplace?view=cart",
      icon: ShoppingCart,
      active: ["cart", "checkout"].includes(view),
    },
    {
      label: "Biblioteca",
      to: "/marketplace?view=library",
      icon: BookOpen,
      active: view === "library",
    },
    {
      label: "Cuenta",
      to: "/marketplace?view=account",
      icon: UserRound,
      active: [
        "account",
        "orders",
        "studio",
        "admin",
        "docs",
        "following",
      ].includes(view),
    },
  ];
  return (
    <div
      className="viso-marketplace vm-shop"
      data-pulse={configuration.pulse.enabled}
      style={
        {
          "--vm-cycle-duration": `${duration}s`,
          "--vm-header-color": colorSteps[0],
        } as CSSProperties
      }
    >
      <style>{`@keyframes vm-store-colors{${cycle}}`}</style>
      <header
        className="vm-shop-header"
        data-compact={
          product ||
          !["discover", "videos", "creator", "creators", "saved"].includes(view)
        }
      >
        <div className="vm-shop-header-row">
          {(product || !["discover", "videos"].includes(view)) && (
            <button
              className="vm-header-icon vm-back"
              aria-label="Volver al catálogo"
              onClick={() =>
                navigate(
                  view === "checkout"
                    ? "/marketplace?view=cart"
                    : "/marketplace",
                )
              }
            >
              <ArrowLeft />
            </button>
          )}
          <Link
            className="vm-symbol"
            to="/marketplace"
            aria-label="Marketplace VISO"
          >
            <img src="/brand/viso-icon.png" alt="VISO" />
          </Link>
          <label className="vm-shop-search">
            <Search />
            <span className="sr-only">Buscar en el marketplace</span>
            <input
              type="search"
              maxLength={120}
              placeholder="Buscar en VISO"
              value={search}
              onChange={(e) => searchFor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
            {search && (
              <button
                aria-label="Limpiar búsqueda"
                onClick={() => searchFor("")}
              >
                <X />
              </button>
            )}
          </label>
          <Link
            className="vm-header-icon vm-cart-link"
            to="/marketplace?view=cart"
            aria-label={`Carrito${shopping?.cart.length ? `, ${shopping.cart.length} ${shopping.cart.length === 1 ? "producto" : "productos"}` : ""}`}
          >
            <ShoppingCart />
            {!!shopping?.cart.length && (
              <span className="vm-count">{shopping.cart.length}</span>
            )}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="vm-header-icon"
                aria-label="Más opciones del marketplace"
              >
                <MoreHorizontal />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuItem asChild>
                <Link to="/marketplace?view=saved">
                  <Heart /> Favoritos
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/marketplace?view=orders">
                  <ShoppingCart /> Mis compras
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/marketplace?view=studio">
                  <Users /> Espacio creador
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/marketplace?view=docs">
                  <BookOpen /> Guía para creadores
                </Link>
              </DropdownMenuItem>
              {admin && (
                <DropdownMenuItem asChild>
                  <Link to="/marketplace?view=admin">
                    <Settings2 /> Administrar marketplace
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to={isAndroidNative() ? "/android" : "/"}>
                  <Grid2X2 /> Volver a VISO
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="vm-shop-context">
          <Store size={15} /> Tu espacio, conectado
          <nav
            className="vm-shop-desktop-nav"
            aria-label="Tu espacio en Marketplace"
          >
            {nav.map(({ label, to, active }) => (
              <Link
                key={label}
                to={to}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <nav
          className="vm-shop-categories"
          aria-label="Categorías del marketplace"
        >
          {STORE_CATEGORIES.map(({ id, label }) => (
            <Link
              key={id}
              to={
                id === "discover"
                  ? "/marketplace"
                  : `/marketplace?category=${id}`
              }
              aria-current={
                view === "discover" && category === id ? "page" : undefined
              }
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="vm-shop-main" id="marketplace-content">
        {children}
      </main>
      <nav className="vm-shop-bottom" aria-label="Navegación del marketplace">
        {nav.map(({ label, to, icon: Icon, active }) => (
          <Link to={to} key={label} aria-current={active ? "page" : undefined}>
            <span>
              <Icon />
              {label === "Carrito" && !!shopping?.cart.length && (
                <i className="vm-count" aria-hidden="true">
                  {shopping.cart.length}
                </i>
              )}
            </span>
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
