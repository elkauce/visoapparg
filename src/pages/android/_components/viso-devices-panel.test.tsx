import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VisoDevicesPanel } from "./viso-devices-panel.tsx";

const state = vi.hoisted(() => ({
  slug: "example" as string | null | undefined,
  connected: true,
  ensure: vi.fn(),
  error: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === "public_status:getMine"
      ? state.slug
      : {
          activeStatusId: "busy",
          statuses: [{ _id: "busy", name: "Ocupado", color: "#ef4444" }],
        },
  useMutation: () => state.ensure,
  useConvexConnectionState: () => ({ isWebSocketConnected: state.connected }),
}));
vi.mock("@/lib/android-native.ts", () => ({
  isAndroidNative: () => false,
  actions: { openUrl: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { error: state.error, success: vi.fn() } }));

function open() {
  return render(
    <MemoryRouter>
      <VisoDevicesPanel />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  state.slug = "example";
  state.connected = true;
  vi.clearAllMocks();
  state.ensure.mockResolvedValue("example");
  vi.stubEnv("VITE_CONVEX_SITE_URL", "https://test.convex.site");
  vi.stubEnv("VITE_VISO_STORE_URL", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("VISO devices honest connection state", () => {
  it("shows a disabled catalog until its official URL is configured, without connecting on mount", () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    open();
    expect(
      screen.getByRole("button", { name: "Catálogo próximamente" }),
    ).toBeDisabled();
    expect(
      screen.getByText("No hay dispositivos confirmados en esta pantalla.", {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(state.ensure).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it("prepares the existing account feed only after an explicit user action", async () => {
    state.slug = null;
    open();
    fireEvent.click(
      screen.getByRole("button", { name: "Vincular dispositivo VISO" }),
    );
    expect(state.ensure).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Preparar configuración" }),
    );
    await waitFor(() => expect(state.ensure).toHaveBeenCalledWith({}));
  });

  it("does not claim a hardware connection when the VISO feed answers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("239,68,68")),
    );
    open();
    fireEvent.click(
      screen.getByRole("button", { name: "Vincular dispositivo VISO" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Comprobar respuesta de VISO" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "La conexión física del dispositivo aún no está verificada",
      ),
    );
    expect(
      screen.getByDisplayValue(
        "https://test.convex.site/public/status?slug=example&format=rgb",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir controles de estado" }),
    ).toHaveAttribute("href", "/deck");
  });

  it("reports unavailable after a failed request and permits a retry", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response("0,0,0"));
    vi.stubGlobal("fetch", request);
    open();
    fireEvent.click(
      screen.getByRole("button", { name: "Vincular dispositivo VISO" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Comprobar respuesta de VISO" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("VISO no respondió"),
    );
    expect(state.error).toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Comprobar respuesta de VISO" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "La conexión física del dispositivo aún no está verificada",
      ),
    );
  });

  it("offers only the configured official catalog and never invents a shop address", () => {
    vi.stubEnv("VITE_VISO_STORE_URL", "https://shop.example.invalid/catalog");
    open();
    expect(screen.getByRole("link", { name: "Ver catálogo" })).toHaveAttribute(
      "href",
      "https://shop.example.invalid/catalog",
    );
  });
});
