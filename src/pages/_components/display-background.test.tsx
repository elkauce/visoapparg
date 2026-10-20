import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, it, vi } from "vitest";
import DisplayBackgroundSettings from "./display-background";

const fixture = vi.hoisted(() => ({
  background: {
    mediaStorageId: "old-background",
    mediaUrl: "https://files.example/old.mp4",
    mediaType: "video",
    fit: "contain",
    showStatus: false,
  },
  load: vi.fn(),
  upload: vi.fn(),
  save: vi.fn(),
  clear: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@convex-dev/auth/react", () => ({ useAuthToken: () => "account-token" }));
vi.mock("convex/react", () => ({
  useQuery: () => fixture.background,
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === "display:clearBackground" ? fixture.clear : fixture.save,
}));
vi.mock("@/pages/deck/_lib/upload-media", () => ({ uploadKeyMedia: fixture.upload }));
vi.mock("@/components/marketplace/key-asset-picker", () => ({
  default: ({ onSelect, purpose }: {
    onSelect: (selection: unknown) => void;
    purpose: string;
  }) => <button onClick={() => onSelect({
    id: "licensed-pack/portrait-video",
    name: "Marca vertical",
    previewUrl: "https://files.example/portrait.mp4",
    mediaType: "video",
    load: fixture.load,
  })}>Elegir recurso para {purpose}</button>,
}));
vi.mock("sonner", () => ({ toast: { success: fixture.success, error: fixture.error } }));

beforeEach(() => {
  fixture.load.mockReset().mockResolvedValue({ storageId: "own-library-copy", mediaType: "video" });
  fixture.upload.mockReset().mockResolvedValue({ storageId: "own-upload", mediaType: "image" });
  fixture.save.mockReset().mockResolvedValue(null);
  fixture.clear.mockReset().mockResolvedValue(null);
  fixture.success.mockReset();
  fixture.error.mockReset();
});

async function selectLibrary() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Biblioteca" }));
  await user.click(screen.getByRole("button", { name: "Elegir recurso para display" }));
  return user;
}

it("previews an account library video without changing the current background or key settings", async () => {
  render(<DisplayBackgroundSettings />);
  const user = await selectLibrary();
  const preview = screen.getByLabelText("Vista previa de Marca vertical");
  expect(preview).toHaveAttribute("src", "https://files.example/portrait.mp4");
  expect(preview).toHaveClass("object-contain");
  await user.selectOptions(screen.getByLabelText("Ajuste del fondo del Display"), "cover");
  await user.click(screen.getByRole("checkbox", { name: "Mostrar estado sobre el fondo" }));
  expect(fixture.load).not.toHaveBeenCalled();
  expect(fixture.save).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Cancelar selección" }));
  expect(screen.getByLabelText("Fondo actual del Display")).toHaveAttribute("src", fixture.background.mediaUrl);
  expect(screen.getByLabelText("Ajuste del fondo del Display")).toHaveValue("contain");
  expect(fixture.save).not.toHaveBeenCalled();
});

it("applies an authorized owned library copy only on confirmation with independent display options", async () => {
  render(<DisplayBackgroundSettings />);
  const user = await selectLibrary();
  await user.selectOptions(screen.getByLabelText("Ajuste del fondo del Display"), "cover");
  await user.click(screen.getByRole("checkbox", { name: "Mostrar estado sobre el fondo" }));
  await user.click(screen.getByRole("button", { name: "Aplicar al Display" }));
  await waitFor(() => expect(fixture.save).toHaveBeenCalledExactlyOnceWith({
    storageId: "own-library-copy", fit: "cover", showStatus: true,
  }));
  expect(fixture.load).toHaveBeenCalledExactlyOnceWith("account-token");
  expect(fixture.upload).not.toHaveBeenCalled();
  expect(fixture.clear).not.toHaveBeenCalled();
});

it("keeps a failed library save retryable without uploading another copy", async () => {
  fixture.save.mockRejectedValueOnce(new Error("Conexión temporalmente interrumpida"));
  render(<DisplayBackgroundSettings />);
  const user = await selectLibrary();
  await user.click(screen.getByRole("button", { name: "Aplicar al Display" }));
  await waitFor(() => expect(fixture.error).toHaveBeenCalledOnce());
  expect(screen.getByLabelText("Vista previa de Marca vertical")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Aplicar al Display" }));
  await waitFor(() => expect(fixture.save).toHaveBeenCalledTimes(2));
  expect(fixture.load).toHaveBeenCalledOnce();
});

it("can remove the Display background without removing the licensed library resource", async () => {
  render(<DisplayBackgroundSettings />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Quitar fondo del Display" }));
  expect(fixture.clear).toHaveBeenCalledExactlyOnceWith({});
  expect(fixture.load).not.toHaveBeenCalled();
  expect(fixture.save).not.toHaveBeenCalled();
});

it("retains personal GIF uploads beside the library", async () => {
  render(<DisplayBackgroundSettings />);
  const user = userEvent.setup();
  const gif = new File(["GIF89a"], "mi-marca.gif", { type: "image/gif" });
  await user.upload(screen.getByLabelText("Archivo del Display"), gif);
  await waitFor(() => expect(fixture.upload).toHaveBeenCalledExactlyOnceWith(gif, "account-token"));
  expect(fixture.save).toHaveBeenCalledWith({ storageId: "own-upload", fit: "contain", showStatus: false });
});
