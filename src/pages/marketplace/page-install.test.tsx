import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import MarketplacePageInstall from "./page-install";

const fixture = vi.hoisted(() => ({ install: vi.fn(), success: vi.fn() }));
vi.mock("convex/react", () => ({ useMutation: () => fixture.install }));
vi.mock("sonner", () => ({ toast: { success: fixture.success } }));
const product = { productId: "viso-page-clock", title: "Reloj", category: "pages", pageTemplate: "clock" as const };
beforeEach(() => {
  fixture.install.mockReset().mockResolvedValue({ pageId: "page-1", existing: false });
  fixture.success.mockReset();
});
function show() {
  render(<MemoryRouter><MarketplacePageInstall product={product} /></MemoryRouter>);
}

it("only installs after confirmation and reports success after the server confirms", async () => {
  const user = userEvent.setup();
  show();
  await user.click(screen.getByRole("button", { name: "Agregar al deck" }));
  expect(fixture.install).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Confirmar y agregar" }));
  await waitFor(() => expect(fixture.install).toHaveBeenCalledExactlyOnceWith({ productId: "viso-page-clock" }));
  expect(fixture.success).toHaveBeenCalledOnce();
  expect(screen.getByRole("link", { name: "Abrir mi deck" })).toHaveAttribute("href", "/deck");
});

it("preserves errors as actionable feedback without claiming a successful installation", async () => {
  const user = userEvent.setup();
  fixture.install.mockRejectedValueOnce(new Error("private diagnostics"));
  show();
  await user.click(screen.getByRole("button", { name: "Agregar al deck" }));
  await user.click(screen.getByRole("button", { name: "Confirmar y agregar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/espacio disponible/);
  expect(screen.getByRole("alert")).not.toHaveTextContent("private diagnostics");
  expect(fixture.success).not.toHaveBeenCalled();
  expect(screen.queryByRole("link", { name: "Abrir mi deck" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Confirmar y agregar" })).toBeEnabled();
});

it("does not install on cancel and explains that an already installed page keeps its adjustments", async () => {
  const user = userEvent.setup();
  fixture.install.mockResolvedValueOnce({ pageId: "existing", existing: true });
  show();
  await user.click(screen.getByRole("button", { name: "Agregar al deck" }));
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(fixture.install).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Agregar al deck" }));
  await user.click(screen.getByRole("button", { name: "Confirmar y agregar" }));
  expect(fixture.success).toHaveBeenCalledWith("Esta página ya está en tu deck. Conservamos tus ajustes.");
});

it("only asks the server to replace an installed preset after an explicit opt-in", async () => {
  const user = userEvent.setup();
  fixture.install.mockResolvedValueOnce({ pageId: "existing", existing: true, updated: true });
  show();
  await user.click(screen.getByRole("button", { name: "Agregar al deck" }));
  const checkbox = screen.getByRole("checkbox", { name: /reemplazar sus ajustes/ });
  expect(checkbox).not.toBeChecked();
  await user.click(checkbox);
  await user.click(screen.getByRole("button", { name: "Confirmar y agregar" }));
  expect(fixture.install).toHaveBeenCalledExactlyOnceWith({ productId: "viso-page-clock", updateExisting: true });
  expect(fixture.success).toHaveBeenCalledWith("Aplicamos la configuración de esta versión a tu página.");
});
