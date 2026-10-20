import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AffiliateImport from "./affiliate-import";

const mock = vi.hoisted(() => ({ preview: vi.fn() }));
vi.mock("convex/react", () => ({ useAction: () => mock.preview }));
const affiliateUrl = "https://meli.la/AbC?tag=viso%2Fdeck";
const result = {
  draft: { title: "Título importado", description: "Descripción del vendedor", priceAmount: 150050, currency: "ARS", externalUrl: affiliateUrl, gallery: [{ id: "picture", name: "Foto", mediaType: "image", externalUrl: "https://http2.mlstatic.com/photo.webp" }], importSource: { affiliateUrl, importedAt: 123 } },
  warnings: ["No hay video disponible; podés subir el tuyo."],
};
beforeEach(() => mock.preview.mockReset().mockResolvedValue(result));

describe("affiliate import review", () => {
  it("does not change the editor until explicitly applied and only applies selected fields", async () => {
    const apply = vi.fn();
    render(<AffiliateImport initialUrl={affiliateUrl} onApply={apply} />);
    fireEvent.click(screen.getByRole("button", { name: "Consultar producto" }));
    expect(await screen.findByText("Título importado")).toBeVisible();
    expect(apply).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Título")).not.toBeChecked();
    expect(screen.getByLabelText("Descripción")).not.toBeChecked();
    fireEvent.click(screen.getByLabelText("Título"));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar campos seleccionados" }));
    expect(apply).toHaveBeenCalledExactlyOnceWith({ externalUrl: affiliateUrl, importSource: result.draft.importSource, title: result.draft.title });
    expect(apply.mock.calls[0][0]).not.toHaveProperty("description");
    expect(apply.mock.calls[0][0]).not.toHaveProperty("gallery");
    expect(screen.getByRole("button", { name: "Datos aplicados al borrador" })).toBeDisabled();
  });
  it("allows manual completion when provider access returns no data without inventing free prices", async () => {
    mock.preview.mockResolvedValue({ draft: { externalUrl: affiliateUrl, gallery: [], importSource: result.draft.importSource }, warnings: ["Mercado Libre no permite consultar esta publicación."] });
    const apply = vi.fn();
    render(<AffiliateImport initialUrl={affiliateUrl} onApply={apply} />);
    fireEvent.click(screen.getByRole("button", { name: "Consultar producto" }));
    expect(await screen.findByText("Mercado Libre no permite consultar esta publicación.")).toBeVisible();
    expect(screen.getByLabelText(/Precio y moneda/)).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Usar sólo el enlace" }));
    expect(apply).toHaveBeenCalledWith({ externalUrl: affiliateUrl, importSource: result.draft.importSource });
  });
  it("refreshing clears field selection and preserves custom edits until a second explicit apply", async () => {
    const apply = vi.fn();
    render(<AffiliateImport initialUrl={affiliateUrl} onApply={apply} />);
    fireEvent.click(screen.getByRole("button", { name: "Consultar producto" }));
    await screen.findByText("Título importado");
    fireEvent.click(screen.getByLabelText("Descripción"));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar campos seleccionados" }));
    fireEvent.click(screen.getByRole("button", { name: "Consultar producto" }));
    await waitFor(() => expect(mock.preview).toHaveBeenCalledTimes(2));
    await screen.findByText("Título importado");
    expect(screen.getByLabelText("Descripción")).not.toBeChecked();
    expect(apply).toHaveBeenCalledTimes(1);
  });
  it("does not relabel a foreign imported amount as pesos or dollars", async () => {
    mock.preview.mockResolvedValue({ ...result, draft: { ...result.draft, currency: "CLP" } });
    const apply = vi.fn();
    render(<AffiliateImport initialUrl={affiliateUrl} onApply={apply} />);
    fireEvent.click(screen.getByRole("button", { name: "Consultar producto" }));
    await screen.findByText(/No se convierte automáticamente/);
    expect(screen.getByLabelText(/Precio y moneda/)).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Usar sólo el enlace" }));
    expect(apply.mock.calls[0][0]).not.toHaveProperty("priceAmount");
    expect(apply.mock.calls[0][0]).not.toHaveProperty("currency");
  });
});
