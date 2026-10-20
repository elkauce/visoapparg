import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import ProductForm, { type EditableMarketProduct } from "./product-form";

const fixture = vi.hoisted(() => ({
  save: vi.fn(),
  submit: vi.fn(),
  upload: vi.fn(),
  success: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(ref) === "marketplace:saveProduct"
      ? fixture.save
      : fixture.submit,
}));
vi.mock("@convex-dev/auth/react", () => ({
  useAuthToken: () => "test-session",
}));
vi.mock("sonner", () => ({ toast: { success: fixture.success } }));
vi.mock("@/lib/marketplace-upload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/marketplace-upload")>()),
  uploadMarketplaceFile: fixture.upload,
}));

const original: EditableMarketProduct = {
  id: "product-one",
  title: "Iconos de trabajo",
  description: "Una colección original.",
  category: "icons",
  priceMode: "free",
  affiliate: false,
  status: "published",
  coverStorageId: "old-cover" as Id<"_storage">,
  coverUrl: "https://example.test/cover.png",
  assets: [
    {
      id: "old-key",
      name: "Libre",
      storageId: "old-key" as Id<"_storage">,
      mediaType: "image",
    },
  ],
};

beforeEach(() => {
  fixture.save.mockReset().mockResolvedValue("saved-product");
  fixture.submit.mockReset().mockResolvedValue("saved-product");
  fixture.upload
    .mockReset()
    .mockResolvedValue({ storageId: "uploaded-file", mediaType: "image" });
  fixture.success.mockReset();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:cover"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("creator product editing", () => {
  it("keeps an existing private cover and downloadable assets when editing a published product", async () => {
    const close = vi.fn();
    render(<ProductForm product={original} isAdmin={false} onClose={close} />);
    expect(screen.getByText(/esta ficha vuelve a borrador/)).toBeVisible();
    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Iconos renovados" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(fixture.save).toHaveBeenCalledExactlyOnceWith({
      productId: "product-one",
      title: "Iconos renovados",
      description: original.description,
      category: "icons",
      priceMode: "free",
      coverStorageId: "old-cover",
      affiliate: false,
      assets: [{ name: "Libre", storageId: "old-key", mediaType: "image" }],
    });
    expect(fixture.upload).not.toHaveBeenCalled();
    expect(fixture.submit).not.toHaveBeenCalled();
  });

  it("rejects an unrelated used-item domain and preserves the complete affiliate URL when submitting a valid listing", async () => {
    render(<ProductForm isAdmin initialCategory="used" onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Stream Deck usado" },
    });
    fireEvent.change(screen.getByLabelText("Descripción"), {
      target: { value: "Descripción y condición del vendedor original." },
    });
    const url = screen.getByLabelText("Enlace de afiliado de Mercado Libre");
    fireEvent.change(url, {
      target: { value: "https://unrelated.example/item" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar y enviar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Mercado Libre");
    expect(fixture.save).not.toHaveBeenCalled();
    const affiliate =
      "https://meli.la/AbC?reference_id=viso%2Fdeck&tag=affiliate";
    fireEvent.change(url, { target: { value: affiliate } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar y enviar" }));
    await waitFor(() =>
      expect(fixture.submit).toHaveBeenCalledExactlyOnceWith({
        productId: "saved-product",
      }),
    );
    expect(fixture.save.mock.calls[0][0]).toMatchObject({
      category: "used",
      priceMode: "external",
      affiliate: true,
      externalUrl: affiliate,
      assets: [],
    });
  });

  it("keeps the form open on a failed upload and reuses files already uploaded on retry", async () => {
    const close = vi.fn();
    render(<ProductForm isAdmin={false} onClose={close} />);
    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Dos iconos" },
    });
    fireEvent.change(screen.getByLabelText("Descripción"), {
      target: { value: "Un paquete de imágenes originales." },
    });
    const first = new File(["image1"], "first.png", { type: "image/png" });
    const second = new File(["image2"], "second.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Archivos del producto"), {
      target: { files: [first, second] },
    });
    fixture.upload
      .mockResolvedValueOnce({ storageId: "first-owned", mediaType: "image" })
      .mockRejectedValueOnce(new Error("Conexión interrumpida"))
      .mockResolvedValueOnce({ storageId: "second-owned", mediaType: "image" });
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Conexión interrumpida",
    );
    expect(close).not.toHaveBeenCalled();
    expect(fixture.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(fixture.upload).toHaveBeenCalledTimes(3);
    expect(
      fixture.upload.mock.calls.filter((call) => call[0] === first),
    ).toHaveLength(1);
    expect(fixture.save.mock.calls[0][0].assets).toEqual([
      { name: "first.png", storageId: "first-owned", mediaType: "image" },
      { name: "second.png", storageId: "second-owned", mediaType: "image" },
    ]);
  });
});
