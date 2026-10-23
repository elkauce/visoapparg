import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TimbreQrEditor from "./qr-editor";
import * as qr from "../../lib/timbre-qr";

vi.mock("../../lib/timbre-qr", async (original) => ({
  ...await original<typeof import("../../lib/timbre-qr")>(),
  exportTimbreQr: vi.fn(), downloadTimbreExport: vi.fn(),
}));
const url = "https://viso-deck-android.vercel.app/t/QRpublicoAleatorio01234567890123456789";

describe("Timbre QR editor", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("updates the saved design from the visual editor and blocks unreadable contrast", () => {
    const onDesignChange = vi.fn();
    render(<TimbreQrEditor url={url} label="Casa" onDesignChange={onDesignChange} />);
    fireEvent.change(screen.getByLabelText("Familia"), { target: { value: "Familia Pérez" } });
    expect(onDesignChange).toHaveBeenLastCalledWith(expect.objectContaining({ familyName: "Familia Pérez" }));
    fireEvent.change(screen.getByLabelText("Módulos del QR"), { target: { value: "#dddddd" } });
    expect(screen.getByText(/contraste mínimo/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PDF" })).toBeDisabled();
  });

  it("exports the selected QR-only variant and reports decoder failures without downloading", async () => {
    vi.mocked(qr.exportTimbreQr).mockRejectedValue(new Error("El diseño no superó la comprobación de lectura."));
    render(<TimbreQrEditor url={url} label="Casa" />);
    fireEvent.click(screen.getByLabelText(/Descargar únicamente el QR/));
    fireEvent.click(screen.getByRole("button", { name: "PNG" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("no superó la comprobación"));
    expect(qr.exportTimbreQr).toHaveBeenCalledWith(url, expect.any(Object), "png", true);
    expect(qr.downloadTimbreExport).not.toHaveBeenCalled();
  });
  it("allows pre-purchase design without creating a URL or exposing exports", () => {
    const onDesignChange = vi.fn();
    render(<TimbreQrEditor url="" label="Mi entrada" previewOnly onDesignChange={onDesignChange} />);
    expect(screen.getByText(/QR se vincula después del pago/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "PNG" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copiar enlace" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Número de calle"), { target: { value: "1234" } });
    expect(onDesignChange).toHaveBeenLastCalledWith(expect.objectContaining({ streetNumber: "1234" }));
    const image = screen.getByRole("img") as HTMLImageElement;
    const svg = decodeURIComponent(image.src.split(",")[1]);
    expect(svg).toContain("QR pendiente"); expect(svg).not.toContain("shape-rendering=\"crispEdges\"");
    expect(qr.exportTimbreQr).not.toHaveBeenCalled();
  });
  it("locks selected plate dimensions and resets the order payload when the variant changes", () => {
    const onDesignChange = vi.fn();
    const { rerender } = render(<TimbreQrEditor url="" label="Casa" previewOnly fixedDimensions={{ widthMm: 100, heightMm: 150 }} onDesignChange={onDesignChange} />);
    expect(screen.getByLabelText("Ancho (mm)")).toBeDisabled();
    expect(screen.getByLabelText("Alto (mm)")).toHaveValue(150);
    expect(onDesignChange).toHaveBeenLastCalledWith(expect.objectContaining({ widthMm: 100, heightMm: 150 }));
    rerender(<TimbreQrEditor url="" label="Casa" previewOnly fixedDimensions={{ widthMm: 150, heightMm: 100 }} onDesignChange={onDesignChange} />);
    expect(screen.getByLabelText("Ancho (mm)")).toHaveValue(150);
    expect(onDesignChange).toHaveBeenLastCalledWith(expect.objectContaining({ widthMm: 150, heightMm: 100 }));
    fireEvent.change(screen.getByLabelText("Familia"), { target: { value: "Familia Pérez" } });
    expect(onDesignChange).toHaveBeenLastCalledWith(expect.objectContaining({ widthMm: 150, heightMm: 100, familyName: "Familia Pérez" }));
  });
});
