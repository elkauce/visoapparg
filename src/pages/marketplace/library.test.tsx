import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MarketLibrary, { LibraryAsset } from "./library";
import type { MarketLibraryEntry } from "./types";

const fixture = vi.hoisted(() => ({
  entries: [] as MarketLibraryEntry[],
  mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
  error: vi.fn(),
  success: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: () => fixture.entries,
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference);
    fixture.mutations[name] ??= vi.fn().mockResolvedValue(null);
    return fixture.mutations[name];
  },
}));
vi.mock("./display-apply", () => ({
  default: () => <button>Usar en Display</button>,
}));
vi.mock("sonner", () => ({
  toast: { error: fixture.error, success: fixture.success },
}));

const profile: MarketLibraryEntry = {
  productId: "viso-essential-profile",
  title: "Deck Esencial",
  category: "profiles",
  creatorName: "VISO",
  delivery: "profile",
  acquiredAt: 1,
  profileTemplate: "essential",
  assets: [],
};
beforeEach(() => {
  fixture.entries = [];
  fixture.mutations = {};
  fixture.error.mockReset();
  fixture.success.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Marketplace library", () => {
  it("updates a newer compatible library version only after confirmation and leaves installed content alone", async () => {
    fixture.entries = [{ ...profile, revision: 1, latestRevision: 2, latestVersion: "2.0.0", updateAvailable: true }];
    const user = userEvent.setup();
    render(<MemoryRouter><MarketLibrary onExplore={vi.fn()} /></MemoryRouter>);
    const update = fixture.mutations["marketplace:updateLibrary"];
    await user.click(screen.getByRole("button", { name: "Actualizar Deck Esencial en mi biblioteca" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Tus teclas, fondos y páginas ya instaladas se conservan");
    expect(screen.getByRole("dialog")).toHaveTextContent("2.0.0");
    expect(update).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(update).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Actualizar Deck Esencial en mi biblioteca" }));
    await user.click(screen.getByRole("button", { name: "Actualizar mi biblioteca" }));
    await waitFor(() => expect(update).toHaveBeenCalledExactlyOnceWith({ productId: profile.productId }));
    expect(fixture.mutations["marketplace:installProfile"]).not.toHaveBeenCalled();
    expect(fixture.mutations["marketplace:removeFromLibrary"]).not.toHaveBeenCalled();
  });

  it("does not offer an update for an unchanged, paid or incompatible published version", () => {
    fixture.entries = [{ ...profile, revision: 1, latestRevision: 3, updateAvailable: false }];
    render(<MemoryRouter><MarketLibrary onExplore={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: "Actualizar Deck Esencial en mi biblioteca" })).not.toBeInTheDocument();
  });

  it("keeps the previous acquisition and allows retry when updating the library fails", async () => {
    fixture.entries = [{ ...profile, revision: 1, latestRevision: 2, updateAvailable: true }];
    const user = userEvent.setup();
    render(<MemoryRouter><MarketLibrary onExplore={vi.fn()} /></MemoryRouter>);
    const update = fixture.mutations["marketplace:updateLibrary"];
    update.mockRejectedValueOnce(new Error("Connection failed"));
    await user.click(screen.getByRole("button", { name: "Actualizar Deck Esencial en mi biblioteca" }));
    await user.click(screen.getByRole("button", { name: "Actualizar mi biblioteca" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Tu versión anterior se conserva");
    await user.click(screen.getByRole("button", { name: "Actualizar mi biblioteca" }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(fixture.mutations["marketplace:installProfile"]).not.toHaveBeenCalled();
  });

  it("offers acquired native pages and confirms installation without replacing other pages", async () => {
    fixture.entries = [{
      productId: "viso-page-clock", title: "Reloj", category: "pages",
      creatorName: "VISO", delivery: "page", acquiredAt: 2,
      pageTemplate: "clock", assets: [],
    }];
    const user = userEvent.setup();
    render(<MemoryRouter><MarketLibrary onExplore={vi.fn()} /></MemoryRouter>);
    const installPage = fixture.mutations["marketplace_pages:installPage"];
    installPage.mockResolvedValue({ pageId: "new-native-page", existing: false });
    await user.click(screen.getByRole("button", { name: "Agregar al deck" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Tus otras páginas no se reemplazan");
    expect(installPage).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirmar y agregar" }));
    await waitFor(() => expect(installPage).toHaveBeenCalledExactlyOnceWith({ productId: "viso-page-clock" }));
    expect(await screen.findByRole("link", { name: "Abrir mi deck" })).toHaveAttribute("href", "/deck");
  });

  it("makes visual icon resources available to Display as well as screensavers", () => {
    render(<LibraryAsset
      asset={{ id: "logo", name: "Mi logo", mediaType: "image", url: "https://files.example.test/logo.png" }}
      product={{ productId: "brand-icons", category: "icons" }}
    />);
    expect(screen.getByRole("button", { name: "Usar en Display" })).toBeInTheDocument();
  });

  it("requires explicit confirmation before creating a page and sends only the licensed product", async () => {
    fixture.entries = [profile];
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MarketLibrary onExplore={vi.fn()} />
      </MemoryRouter>,
    );
    await user.click(
      screen.getByRole("button", { name: "Agregar página al deck" }),
    );
    expect(
      fixture.mutations["marketplace:installProfile"],
    ).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Tus otras páginas y sus configuraciones se conservan",
    );
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(
      fixture.mutations["marketplace:installProfile"],
    ).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Agregar página al deck" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Crear página nueva" }),
    );
    expect(
      fixture.mutations["marketplace:installProfile"],
    ).toHaveBeenCalledExactlyOnceWith({ productId: profile.productId });
  });

  it("confirms removing a library entry and explains that existing keys keep their files", async () => {
    fixture.entries = [profile];
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MarketLibrary onExplore={vi.fn()} />
      </MemoryRouter>,
    );
    await user.click(
      screen.getByRole("button", {
        name: "Quitar Deck Esencial de mi biblioteca",
      }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Las teclas que ya personalizaste conservan sus archivos",
    );
    await user.click(screen.getByRole("button", { name: "Quitar recurso" }));
    expect(
      fixture.mutations["marketplace:removeFromLibrary"],
    ).toHaveBeenCalledExactlyOnceWith({ productId: profile.productId });
  });

  it.each([
    ["image/gif", "image", "gif"],
    ["video/webm", "video", "webm"],
    ["audio/mpeg", "audio", "mp3"],
    ["application/zip", "archive", "zip"],
  ] as const)(
    "downloads an opaque storage URL with the real %s format",
    async (mimeType, mediaType, extension) => {
      const fetcher = vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(["valid download"], { type: mimeType }),
      });

      vi.stubGlobal("fetch", fetcher);
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: vi.fn(() => "blob:temporary-download"),
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: vi.fn(),
      });
      let filename = "";
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
        function (this: HTMLAnchorElement) {
          filename = this.download;
        },
      );
      const user = userEvent.setup();
      render(
        <LibraryAsset
          asset={{
            id: "owned",
            name: "Mi recurso",
            mediaType,
            url: "https://files.example.test/opaque-file-id",
          }}
          product={{
            category: mediaType === "audio" ? "soundboards" : "icons",
            productId: "owned-pack",
          }}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Descargar" }));
      await waitFor(() => expect(filename).toBe(`Mi recurso.${extension}`));
      expect(fetcher).toHaveBeenCalledExactlyOnceWith(
        "https://files.example.test/opaque-file-id",
      );
      expect(fixture.error).not.toHaveBeenCalled();
    },
  );
  it("preserves the installable Elgato plugin extension instead of adding zip", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          blob: async () =>
            new Blob(["PK plugin"], { type: "application/zip" }),
        }),
    );
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:plugin-download"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    let filename = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      filename = this.download;
    });
    const user = userEvent.setup();
    render(
      <LibraryAsset
        asset={{
          id: "plugin",
          name: "MiPlugin.streamDeckPlugin",
          mediaType: "archive",
          url: "https://files.example.test/opaque",
        }}
        product={{ category: "plugins", productId: "creator-plugin" }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Descargar" }));
    await waitFor(() => expect(filename).toBe("MiPlugin.streamDeckPlugin"));
  });
});
