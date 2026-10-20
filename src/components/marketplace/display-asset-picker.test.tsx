import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import KeyAssetPicker, { type KeyLibrarySelection } from "./key-asset-picker";

const fixture = vi.hoisted(() => ({ copy: vi.fn(), upload: vi.fn() }));
vi.mock("convex/react", () => ({
  useQuery: () => [{
    productId: "brand-library-pack", title: "Marca", category: "icons",
    assets: [{ id: "logo-vertical", name: "Logo vertical", mediaType: "video", url: "https://files.example/portrait.mp4" }],
  }],
  useAction: () => fixture.copy,
}));
vi.mock("@/pages/deck/_lib/upload-media", () => ({ uploadBuiltinKeyMedia: fixture.upload }));
beforeEach(() => {
  fixture.copy.mockReset().mockResolvedValue({ storageId: "own-copy", mediaType: "video" });
  fixture.upload.mockReset().mockResolvedValue({ storageId: "own-builtin-copy", mediaType: "image" });
});

it("selects an acquired resource as a preview and copies it only through the authorized library action", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn<(selection: KeyLibrarySelection) => void>();
  render(<MemoryRouter><KeyAssetPicker purpose="display" onSelect={onSelect} /></MemoryRouter>);
  await user.click(screen.getByRole("button", { name: "Usar Logo vertical de Marca en Display" }));
  const selection = onSelect.mock.calls[0][0];
  expect(selection.previewUrl).toBe("https://files.example/portrait.mp4");
  expect(fixture.copy).not.toHaveBeenCalled();
  await expect(selection.load("account-token")).resolves.toEqual({ storageId: "own-copy", mediaType: "video" });
  expect(fixture.copy).toHaveBeenCalledExactlyOnceWith({ productId: "brand-library-pack", assetId: "logo-vertical" });
  expect(fixture.upload).not.toHaveBeenCalled();
});

it("makes the included VISO originals usable in Display without changing the key editor defaults", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn<(selection: KeyLibrarySelection) => void>();
  render(<MemoryRouter><KeyAssetPicker purpose="display" onSelect={onSelect} /></MemoryRouter>);
  const button = screen.getByRole("button", { name: "Usar Libre de VISO Originales en Display" });
  expect(button.querySelector("img")).toHaveClass("object-contain");
  await user.click(button);
  await onSelect.mock.calls[0][0].load("account-token");
  expect(fixture.upload).toHaveBeenCalledWith({ builtinPath: "/marketplace/originals/libre.png", name: "Libre", mimeType: "image/png" }, "account-token");
  expect(fixture.copy).not.toHaveBeenCalled();
});
