import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import KeyAssetPicker from "./key-asset-picker";

vi.mock("convex/react", () => ({
  useQuery: () => {
    throw new Error("Library temporarily unavailable");
  },
  useAction: () => vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());

it("keeps the rest of the key editor available when its library cannot load", () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  render(
    <MemoryRouter>
      <button>Guardar tecla</button>
      <KeyAssetPicker onSelect={vi.fn()} />
    </MemoryRouter>,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Podés usar tus archivos o los iconos VISO",
  );
  expect(screen.getByRole("button", { name: "Guardar tecla" })).toBeEnabled();
});
