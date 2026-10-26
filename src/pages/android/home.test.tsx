import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, it, expect, vi } from "vitest";
import AndroidHome from "./home";
const f = vi.hoisted(() => ({
  authenticated: true,
  data: {
    statuses: [
      { _id: "one", name: "Libre", color: "#22c55e", icon: "check-circle" },
    ],
    activeStatusId: "one" as string | null,
  },
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: f.authenticated, isLoading: false }),
  useQuery: () => f.data,
  useConvexConnectionState: () => ({
    hasEverConnected: true,
    hasInflightRequests: false,
    isWebSocketConnected: true,
  }),
}));
vi.mock("@/components/account-access", () => ({
  default: () => <div>Formulario de ingreso</div>,
}));
beforeEach(() => {
  f.authenticated = true;
  f.data.activeStatusId = "one";
  f.data.statuses[0].color = "#22c55e";
});
function mount() {
  return render(
    <MemoryRouter>
      <AndroidHome />
    </MemoryRouter>,
  );
}
describe("Android app home", () => {
  it("keeps Deck, Display, Timbre and Marketplace destinations and centralizes account/connections", () => {
    mount();
    for (const [name, href] of [
      ["Deck", "/deck"],
      ["Display", "/android/display"],
      ["Timbre", "/timbre"],
      ["Marketplace", "/marketplace"],
    ])
      expect(
        screen.getByRole("link", { name: new RegExp("^" + name) }),
      ).toHaveAttribute("href", href);
    expect(screen.getByRole("link", { name: /^Conexiones/ })).toHaveAttribute(
      "href",
      "/android/integrations",
    );
    expect(screen.queryByText("Cerrar sesión")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Biblioteca" })).toHaveAttribute(
      "href",
      "/marketplace?view=library",
    );
  });
  it("uses the confirmed active status color on the entire card and updates from remote data", () => {
    const view = mount();
    const card = screen.getByRole("link", {
      name: "Estado actual: Libre. Abrir Deck",
    });
    expect(card).toHaveStyle({ backgroundColor: "#22c55e" });
    f.data.statuses[0].color = "#ef4444";
    view.rerender(
      <MemoryRouter>
        <AndroidHome />
      </MemoryRouter>,
    );
    expect(card).toHaveStyle({ backgroundColor: "#ef4444" });
  });
  it("does not fabricate an active status or synchronization after switching it off", () => {
    f.data.activeStatusId = null;
    mount();
    expect(screen.getByText("Sin estado activo")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Conectado");
  });
  it("shows the centered access surface before login, without authenticated navigation", () => {
    f.authenticated = false;
    mount();
    expect(screen.getByText("Formulario de ingreso")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Navegación de VISO" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^Deck/ }),
    ).not.toBeInTheDocument();
  });
});
