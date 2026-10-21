import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MarketProductDialog from "./product-detail";
import type { MarketProduct } from "./types";

const fixture = vi.hoisted(() => ({
  product: null as MarketProduct | null | undefined,
  acquire: vi.fn(),
  success: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: () => fixture.product,
  useMutation: () => fixture.acquire,
}));
vi.mock("sonner", () => ({ toast: { success: fixture.success } }));
vi.mock("./resource-use", () => ({
  ResourceUsage: () => null,
  MarketplaceUseDialog: ({ open }: { open: boolean }) =>
    open ? (
      <div role="dialog" aria-label="Usar recurso">
        Elegir destino
      </div>
    ) : null,
}));
const base: MarketProduct = {
  id: "free-pack",
  title: "Pack del creador",
  description: "Iconos originales.",
  category: "icons",
  creatorName: "Creadora",
  priceMode: "free",
  delivery: "assets",
  affiliate: false,
  status: "published",
  builtin: false,
  assetCount: 4,
  acquired: false,
  owned: false,
};
function show(onAcquired = vi.fn()) {
  render(
    <MemoryRouter>
      <MarketProductDialog
        productId="chosen"
        onClose={vi.fn()}
        onAcquired={onAcquired}
      />
    </MemoryRouter>,
  );
  return onAcquired;
}
beforeEach(() => {
  fixture.product = { ...base };
  fixture.acquire.mockReset().mockResolvedValue("library-entry");
  fixture.success.mockReset();
});

describe("Marketplace acquisition", () => {
  it("adds a free resource through the backend before reporting success", async () => {
    const user = userEvent.setup();
    const acquired = show();
    await user.click(screen.getByRole("button", { name: "Obtener y usar" }));
    expect(fixture.acquire).toHaveBeenCalledExactlyOnceWith({
      productId: "free-pack",
    });
    expect(acquired).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Usar recurso" }),
    ).toBeInTheDocument();
    expect(fixture.success).toHaveBeenCalledOnce();
  });

  it("does not report an acquisition when the backend rejects it", async () => {
    fixture.acquire.mockRejectedValueOnce(new Error("Private diagnostics"));
    const user = userEvent.setup();
    const acquired = show();
    await user.click(screen.getByRole("button", { name: "Obtener y usar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos agregar el recurso",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      "Private diagnostics",
    );
    expect(acquired).not.toHaveBeenCalled();
    expect(fixture.success).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Obtener y usar" }),
    ).toBeEnabled();
  });

  it("preserves the exact affiliate link and never grants a free license for an external purchase", () => {
    const url = "https://meli.la/ABC123?tracking=a%2Bb&campaign=viso";
    fixture.product = {
      ...base,
      category: "used",
      priceMode: "external",
      delivery: "inquiry",
      affiliate: true,
      externalUrl: url,
    };
    show();
    const link = screen.getByRole("link", { name: "Ver en Mercado Libre" });
    expect(link).toHaveAttribute("href", url);
    expect(link.getAttribute("rel")).toContain("sponsored");
    expect(
      screen.getByText(/VISO puede recibir una comisión/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Obtener y usar" }),
    ).not.toBeInTheDocument();
    expect(fixture.acquire).not.toHaveBeenCalled();
  });

  it("does not turn an unsafe external URL or an information-only product into a purchase", () => {
    fixture.product = {
      ...base,
      priceMode: "external",
      externalUrl: "javascript:alert(1)",
    };
    show();
    expect(
      screen.getByText("El enlace de compra no está disponible."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Comprar/ }),
    ).not.toBeInTheDocument();
    expect(fixture.acquire).not.toHaveBeenCalled();
  });

  it("directs already acquired products to the library without granting them again", async () => {
    fixture.product = { ...base, acquired: true };
    const user = userEvent.setup();
    const acquired = show();
    await user.click(
      screen.getByRole("button", { name: "Ver en mi biblioteca" }),
    );
    expect(acquired).toHaveBeenCalledOnce();
    expect(fixture.acquire).not.toHaveBeenCalled();
  });

  it("keeps a missing or private product unavailable", async () => {
    fixture.product = null;
    show();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "Este recurso no está disponible",
        }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: "Obtener y usar" }),
    ).not.toBeInTheDocument();
    expect(fixture.acquire).not.toHaveBeenCalled();
  });

  it("renders a separate complete product page and enlarges a gallery image only when requested", async () => {
    fixture.product = {
      ...base,
      gallery: [
        {
          id: "photo",
          name: "Vista de frente",
          mediaType: "image",
          builtinPath: "/marketplace/covers/original-icons.png",
        },
        {
          id: "portrait",
          name: "Video vertical",
          mediaType: "video",
          url: "https://cdn.example.test/portrait.mp4",
        },
      ],
      details: {
        device: "VISO Deck y Display",
        os: "Android y web",
        compatibility: "VISO 1.14",
        version: "2.1",
        setup: "Agregar desde la biblioteca.\nElegir una tecla.",
        supportUrl: "https://creator.example.test/support",
      },
      changelog: [
        { version: "2.1", date: "2026-10-20", notes: "Nuevas animaciones." },
      ],
    };
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <MarketProductDialog
          productId="chosen"
          onClose={vi.fn()}
          onAcquired={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: base.title }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const gallery = screen.getByRole("region", {
      name: "Galería del producto",
    });
    expect(
      within(gallery).getByRole("img", { name: "Vista de frente" }),
    ).toHaveAttribute("src", "/marketplace/covers/original-icons.png");
    expect(
      container.querySelector('video[aria-label="Video vertical"]'),
    ).toHaveAttribute("controls");
    expect(
      container.querySelector('video[aria-label="Video vertical"]'),
    ).toHaveAttribute("playsinline");
    expect(screen.getByText("VISO Deck y Display")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Cómo se usa" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nuevas animaciones.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Contactar al creador/ }),
    ).toHaveAttribute("href", "https://creator.example.test/support");
    await user.click(
      screen.getByRole("button", { name: "Ampliar Vista de frente" }),
    );
    expect(within(screen.getByRole("dialog")).getByRole("img")).toHaveAttribute(
      "src",
      "/marketplace/covers/original-icons.png",
    );
  });

  it("shows an external amount with its currency and keeps a missing price distinct from free", () => {
    fixture.product = {
      ...base,
      priceMode: "external",
      priceAmount: 123456,
      currency: "ARS",
      externalUrl: "https://shop.example.test/item",
    };
    const view = render(
      <MemoryRouter>
        <MarketProductDialog
          productId="chosen"
          onClose={vi.fn()}
          onAcquired={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/ARS.*1.234,56/)).toBeInTheDocument();
    expect(screen.queryByText("Gratis")).not.toBeInTheDocument();
    fixture.product = { ...fixture.product, priceAmount: undefined };
    view.rerender(
      <MemoryRouter>
        <MarketProductDialog
          productId="chosen"
          onClose={vi.fn()}
          onAcquired={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Precio a confirmar")).toBeInTheDocument();
  });

  it("excludes unsafe gallery sources and does not expose a fake preview", () => {
    fixture.product = {
      ...base,
      gallery: [
        {
          id: "unsafe",
          name: "Unsafe",
          mediaType: "image",
          externalUrl: "javascript:alert(1)",
        },
      ],
    };
    show();
    expect(
      screen.queryByRole("region", { name: "Galería del producto" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows trusted local storage in development while rejecting an external HTTP media link", () => {
    fixture.product = {
      ...base,
      gallery: [
        {
          id: "local",
          name: "Archivo de prueba",
          mediaType: "image",
          url: "http://127.0.0.1:3210/api/storage/owned",
        },
        {
          id: "external",
          name: "Enlace inseguro",
          mediaType: "image",
          externalUrl: "http://127.0.0.1:3210/private",
        },
      ],
    };
    show();
    expect(
      screen.getByRole("img", { name: "Archivo de prueba" }),
    ).toHaveAttribute("src", "http://127.0.0.1:3210/api/storage/owned");
    expect(
      screen.queryByRole("img", { name: "Enlace inseguro" }),
    ).not.toBeInTheDocument();
  });
});
