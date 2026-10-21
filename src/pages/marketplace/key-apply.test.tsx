import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MarketplaceKeyApply from "./key-apply";

const fixture = vi.hoisted(() => ({
  copy: vi.fn(),
  upload: vi.fn(),
  apply: vi.fn(),
  success: vi.fn(),
}));
const key = {
  _id: "owned-key",
  pageId: "page-A",
  position: 0,
  content: {
    kind: "link",
    label: "Mi página",
    icon: "globe",
    color: "#123456",
    url: "https://example.com",
  },
  appearance: {
    label: "Mi acción",
    color: "#abcdef",
    mediaStorageId: "previous-image",
    mediaType: "image",
  },
};
vi.mock("@convex-dev/auth/react", () => ({
  useAuthToken: () => "technical-token",
}));
vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (args === "skip") return undefined;
    return getFunctionName(ref) === "deck_layout:get"
      ? {
          pages: [{ _id: "page-A", name: "Mi principal", kind: "grid" }],
          keys: [key],
          volume: 30,
        }
      : { statuses: [], activeStatusId: null };
  },
  useAction: () => fixture.copy,
  useMutation: () => fixture.apply,
}));
vi.mock("@/pages/deck/_lib/upload-media", () => ({
  uploadBuiltinKeyMedia: fixture.upload,
}));
vi.mock("sonner", () => ({ toast: { success: fixture.success } }));

beforeEach(() => {
  vi.resetAllMocks();
  fixture.copy.mockResolvedValue({
    storageId: "creator-owned-copy",
    mediaType: "image",
  });
  fixture.upload.mockResolvedValue({
    storageId: "builtin-owned-copy",
    mediaType: "image",
  });
  fixture.apply.mockResolvedValue({ keyId: key._id, pageId: key.pageId });
});
const asset = {
  id: "art",
  name: "Icono del creador",
  mediaType: "image" as const,
  url: "https://files.example/icon.png",
};
async function chooseKey() {
  await userEvent.click(
    screen.getByRole("button", { name: "Usar en una tecla" }),
  );
  fireEvent.change(
    await screen.findByRole("combobox", { name: "Tecla de destino" }),
    { target: { value: key._id } },
  );
}
describe("Marketplace key destination", () => {
  it("previews the actual key with its label and new artwork without copying or applying on selection", async () => {
    render(<MarketplaceKeyApply productId="creator-pack" asset={asset} />);
    await chooseKey();
    expect(
      screen.getByRole("button", { name: "Mi acción" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Vista previa de la tecla").querySelector("img"),
    ).toHaveAttribute("src", asset.url);
    expect(fixture.copy).not.toHaveBeenCalled();
    expect(fixture.apply).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(fixture.apply).not.toHaveBeenCalled();
  });
  it("copies the acquired creator asset and confirms only its target and the previewed media revision", async () => {
    render(<MarketplaceKeyApply productId="creator-pack" asset={asset} />);
    await chooseKey();
    await userEvent.click(
      screen.getByRole("button", { name: "Aplicar a esta tecla" }),
    );
    await waitFor(() =>
      expect(fixture.apply).toHaveBeenCalledExactlyOnceWith({
        productId: "creator-pack",
        assetId: "art",
        keyId: key._id,
        storageId: "creator-owned-copy",
        expectedMediaStorageId: "previous-image",
      }),
    );
    expect(fixture.copy).toHaveBeenCalledExactlyOnceWith({
      productId: "creator-pack",
      assetId: "art",
    });
    expect(fixture.upload).not.toHaveBeenCalled();
    expect(fixture.success).toHaveBeenCalledOnce();
  });
  it("uses the owned upload pipeline for VISO files and keeps a failed application available for retry", async () => {
    fixture.apply.mockRejectedValueOnce({
      data: "La imagen cambió en otro dispositivo.",
    });
    render(
      <MarketplaceKeyApply
        productId="viso-original-icons"
        asset={{ ...asset, builtinPath: "/marketplace/originals/libre.png" }}
      />,
    );
    await chooseKey();
    await userEvent.click(
      screen.getByRole("button", { name: "Aplicar a esta tecla" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "otro dispositivo",
    );
    expect(fixture.success).not.toHaveBeenCalled();
    expect(fixture.upload).toHaveBeenCalledOnce();
    expect(fixture.copy).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Aplicar a esta tecla" }),
    ).toBeEnabled();
  });
});
