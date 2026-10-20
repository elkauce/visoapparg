import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import MarketplaceDisplayApply from "./display-apply";

const fixture = vi.hoisted(() => ({
  background: { fit: "contain", showStatus: false },
  upload: vi.fn(),
  copy: vi.fn(),
  save: vi.fn(),
  success: vi.fn(),
}));
vi.mock("@convex-dev/auth/react", () => ({ useAuthToken: () => "test-token" }));
vi.mock("convex/react", () => ({
  useQuery: (_name: unknown, args: unknown) =>
    args === "skip" ? undefined : fixture.background,
  useAction: () => fixture.copy,
  useMutation: () => fixture.save,
}));
vi.mock("@/pages/deck/_lib/upload-media", () => ({
  uploadBuiltinKeyMedia: fixture.upload,
}));
vi.mock("sonner", () => ({ toast: { success: fixture.success } }));

const builtinAsset = {
  id: "aurora",
  name: "Aurora",
  mediaType: "video",
  builtinPath: "/marketplace/screensavers/aurora.mp4",
};

beforeEach(() => {
  fixture.upload
    .mockReset()
    .mockResolvedValue({ storageId: "own-builtin-copy", mediaType: "video" });
  fixture.copy
    .mockReset()
    .mockResolvedValue({ storageId: "own-creator-copy", mediaType: "image" });
  fixture.save.mockReset().mockResolvedValue(undefined);
  fixture.success.mockReset();
});

it("previews a resource without uploading it or changing the Display", async () => {
  const user = userEvent.setup();
  render(
    <MarketplaceDisplayApply
      productId="viso-ambient-screen"
      asset={builtinAsset}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Usar en Display" }));
  const preview = screen.getByLabelText("Vista previa de Aurora");
  expect(preview).toHaveAttribute("src", builtinAsset.builtinPath);
  expect(preview).toHaveAttribute("loop");
  expect(fixture.upload).not.toHaveBeenCalled();
  expect(fixture.copy).not.toHaveBeenCalled();
  expect(fixture.save).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("applies a first-party copy and preserves the current status visibility and fit", async () => {
  const user = userEvent.setup();
  render(
    <MarketplaceDisplayApply
      productId="viso-ambient-screen"
      asset={builtinAsset}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Usar en Display" }));
  await user.click(screen.getByRole("button", { name: "Aplicar al Display" }));
  await waitFor(() =>
    expect(fixture.save).toHaveBeenCalledWith({
      storageId: "own-builtin-copy",
      fit: "contain",
      showStatus: false,
    }),
  );
  expect(fixture.upload).toHaveBeenCalledWith(
    { builtinPath: builtinAsset.builtinPath, name: "Aurora" },
    "test-token",
  );
  expect(fixture.copy).not.toHaveBeenCalled();
  expect(fixture.success).toHaveBeenCalledOnce();
});

it("uses an authorized owned copy of a creator asset and the user's chosen display options", async () => {
  const user = userEvent.setup();
  render(
    <MarketplaceDisplayApply
      productId="creator-pack"
      asset={{
        id: "original-asset",
        name: "Paisaje",
        mediaType: "image",
        url: "https://files.example/landscape.png",
      }}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Usar en Display" }));
  await user.click(
    screen.getByRole("switch", { name: "Mostrar mi estado sobre el fondo" }),
  );
  await user.selectOptions(
    screen.getByLabelText("Ajuste de la imagen"),
    "cover",
  );
  await user.click(screen.getByRole("button", { name: "Aplicar al Display" }));
  await waitFor(() =>
    expect(fixture.copy).toHaveBeenCalledExactlyOnceWith({
      productId: "creator-pack",
      assetId: "original-asset",
    }),
  );
  expect(fixture.save).toHaveBeenCalledWith({
    storageId: "own-creator-copy",
    fit: "cover",
    showStatus: true,
  });
  expect(fixture.upload).not.toHaveBeenCalled();
});

it("keeps a failed save recoverable and reuses the uploaded copy on retry", async () => {
  const user = userEvent.setup();
  fixture.save.mockRejectedValueOnce(new Error("temporary connection error"));
  render(
    <MarketplaceDisplayApply
      productId="viso-ambient-screen"
      asset={builtinAsset}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Usar en Display" }));
  await user.click(screen.getByRole("button", { name: "Aplicar al Display" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Tu fondo anterior se conserva",
  );
  expect(fixture.success).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Aplicar al Display" }));
  await waitFor(() => expect(fixture.success).toHaveBeenCalledOnce());
  expect(fixture.upload).toHaveBeenCalledOnce();
  expect(fixture.save).toHaveBeenCalledTimes(2);
});
