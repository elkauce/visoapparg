import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MarketplacePage from "./page";
import type { MarketProduct } from "./types";

const fixture = vi.hoisted(() => ({
  authenticated: true,
  loading: false,
  admin: false,
  query: vi.fn(),
  mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
  products: [] as MarketProduct[],
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isAuthenticated: fixture.authenticated,
    isLoading: fixture.loading,
  }),
  useQuery: (
    reference: Parameters<typeof getFunctionName>[0],
    args: unknown,
  ) => {
    const name = getFunctionName(reference);
    fixture.query(name, args);
    if (args === "skip") return undefined;
    if (name === "marketplace:session")
      return { isAdmin: fixture.admin, creator: null, checkoutEnabled: false };
    if (name === "marketplace:list") return fixture.products;
    if (name === "marketplace:get")
      return (
        fixture.products.find(
          (product) => product.id === (args as { productId: string }).productId,
        ) ?? null
      );
    if (name === "marketplace:library") return [];
    return null;
  },
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference);
    fixture.mutations[name] ??= vi.fn();
    return fixture.mutations[name];
  },
}));
vi.mock("@/components/ui/signin", () => ({
  SignInButton: () => <button>Entrar al marketplace</button>,
}));
vi.mock("./studio", () => ({ default: () => <h2>Mi espacio de creación</h2> }));
vi.mock("./admin", () => ({ default: () => <h2>Cola de aprobación</h2> }));
vi.mock("./display-apply", () => ({ default: () => null }));

const product: MarketProduct = {
  id: "creator-icons",
  title: "Luces propias",
  description: "Un paquete de iconos del creador.",
  category: "icons",
  creatorName: "Diseños Violeta",
  coverUrl: "/marketplace/cover.png",
  priceMode: "free",
  delivery: "assets",
  affiliate: false,
  status: "published",
  builtin: false,
  assetCount: 3,
  acquired: false,
  owned: false,
};

function Location() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
    </div>
  );
}
function show(path = "/marketplace") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route
          path="/marketplace/products/:productId"
          element={<MarketplacePage />}
        />
      </Routes>
      <Location />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  fixture.authenticated = true;
  fixture.loading = false;
  fixture.admin = false;
  fixture.products = [product];
  fixture.query.mockReset();
  fixture.mutations = {};
});

describe("Marketplace access and navigation", () => {
  it("requires a session before reading catalog, library or creator data", () => {
    fixture.authenticated = false;
    show("/marketplace?view=admin");
    expect(
      screen.getByRole("button", { name: "Entrar al marketplace" }),
    ).toBeInTheDocument();
    expect(fixture.query).not.toHaveBeenCalled();
    expect(screen.queryByText("Cola de aprobación")).not.toBeInTheDocument();
  });

  it("waits for auth hydration before reading private marketplace data", () => {
    fixture.loading = true;
    show();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando tu espacio");
    expect(fixture.query).not.toHaveBeenCalled();
  });

  it("keeps category and search filters in the address and sends them to the backend", async () => {
    const user = userEvent.setup();
    show();
    const categories = screen.getByRole("navigation", {
      name: "Categorías del marketplace",
    });
    await user.click(within(categories).getByRole("link", { name: "Iconos" }));
    expect(screen.getByTestId("location")).toHaveTextContent("category=icons");
    await user.type(
      screen.getByRole("searchbox", { name: "Buscar en el marketplace" }),
      "violeta",
    );
    await waitFor(() =>
      expect(fixture.query).toHaveBeenCalledWith("marketplace:list", {
        category: "icons",
        search: "violeta",
      }),
    );
    expect(screen.getByTestId("location")).toHaveTextContent("q=violeta");
    await user.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });

  it("does not mount administrator queries for a non-admin deep link", async () => {
    show("/marketplace?view=admin");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esta sección es para administradores",
    );
    expect(
      screen.queryByRole("button", { name: "Administrar marketplace" }),
    ).not.toBeInTheDocument();
    expect(
      fixture.query.mock.calls.some(([name]) => name === "marketplace:queues"),
    ).toBe(false);
    expect(screen.queryByText("Cola de aprobación")).not.toBeInTheDocument();
  });

  it("shows the administrator entry only when the server grants the role", async () => {
    fixture.admin = true;
    const user = userEvent.setup();
    show();
    await user.click(
      screen.getByRole("button", { name: "Más opciones del marketplace" }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Administrar marketplace" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Cola de aprobación" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("view=admin");
  });

  it("shows a genuine empty used catalog and directs only administrators to publishing", () => {
    fixture.products = [];
    show("/marketplace?category=used");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Pronto, oportunidades seleccionadas",
    );
    expect(
      screen.queryByRole("button", { name: "Publicar una oportunidad" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/\$\s*\d/)).not.toBeInTheDocument();
  });

  it("opens a complete product URL and returns to the selected catalog category", async () => {
    const user = userEvent.setup();
    show("/marketplace?category=icons");
    await user.click(
      screen.getByRole("button", { name: /Luces propias.*Gratis/ }),
    );
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/marketplace/products/creator-icons?category=icons",
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "Luces propias" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Marketplace" }));
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/marketplace?category=icons",
    );
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("uses the same account gate when opening a product directly", () => {
    fixture.authenticated = false;
    show("/marketplace/products/creator-icons");
    expect(
      screen.getByRole("button", { name: "Entrar al marketplace" }),
    ).toBeInTheDocument();
    expect(fixture.query).not.toHaveBeenCalled();
  });
});
