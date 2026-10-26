import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_STOREFRONT } from "./storefront-model";
import StorefrontAdmin from "./storefront-admin";
const f = vi.hoisted(() => ({
  configuration: {} as typeof DEFAULT_STOREFRONT,
  revision: 0,
  save: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(ref) === "marketplace_storefront:get"
      ? { configuration: f.configuration, revision: f.revision }
      : [],
  useMutation: () => f.save,
}));
vi.mock("@convex-dev/auth/react", () => ({ useAuthToken: () => "test-token" }));
beforeEach(() => {
  f.configuration = structuredClone(DEFAULT_STOREFRONT);
  f.revision = 0;
  f.save.mockReset().mockResolvedValue(1);
});
it("saves user-chosen carousel/name/pulse options using the revision read from the server", async () => {
  render(
    <MemoryRouter>
      <StorefrontAdmin />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "Mostrar carrusel" }));
  fireEvent.click(
    screen.getAllByRole("checkbox", { name: "Mostrar nombre" })[0],
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "Activar latido" }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(f.save).toHaveBeenCalledOnce());
  const arg = f.save.mock.calls[0][0];
  expect(arg.expectedRevision).toBe(0);
  expect(JSON.stringify(arg.configuration)).not.toContain(
    "https://media.example.test/preview.png",
  );
  expect(arg.configuration.showSlider).toBe(false);
  expect(arg.configuration.categories[0].showName).toBe(false);
  expect(arg.configuration.pulse.enabled).toBe(false);
});
it("does not overwrite an unsaved draft when another admin saves and offers explicit reloading", () => {
  const result = render(
    <MemoryRouter>
      <StorefrontAdmin />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Título del slide 1"), {
    target: { value: "Mi cambio pendiente" },
  });
  f.revision = 1;
  f.configuration = structuredClone(DEFAULT_STOREFRONT);
  f.configuration.slides[0].title = "Cambio de otro administrador";
  result.rerender(
    <MemoryRouter>
      <StorefrontAdmin />
    </MemoryRouter>,
  );
  expect(screen.getByLabelText("Título del slide 1")).toHaveValue(
    "Mi cambio pendiente",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Cargar versión guardada" }),
  );
  expect(screen.getByLabelText("Título del slide 1")).toHaveValue(
    "Cambio de otro administrador",
  );
});
