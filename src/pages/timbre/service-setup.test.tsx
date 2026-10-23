import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName, type FunctionReturnType } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/convex/_generated/api";
import TimbreServiceSetup from "./service-setup";
import {
  CLOUDFLARE_TURN_TEMPLATE,
  timbreEnvironmentDashboardUrl,
} from "./service-setup-config";

type Configuration = FunctionReturnType<typeof api.timbre_setup.configuration>;
const fixture = vi.hoisted(() => ({
  configuration: undefined as Configuration | undefined,
  query: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: (reference: Parameters<typeof getFunctionName>[0]) => {
    fixture.query(getFunctionName(reference));
    return fixture.configuration;
  },
}));

beforeEach(() => {
  vi.stubEnv("VITE_CONVEX_URL", "https://review-backend-123.convex.cloud");
  fixture.query.mockClear();
  fixture.configuration = {
    turn: {
      provider: "unconfigured",
      configured: false,
      checks: [
        { name: "TIMBRE_TURN_PROVIDER", configured: false },
        { name: "TIMBRE_CLOUDFLARE_TURN_KEY_ID", configured: false },
        { name: "TIMBRE_CLOUDFLARE_TURN_API_TOKEN", configured: false },
      ],
    },
    push: { configured: false },
    callTested: false,
  };
});
afterEach(() => vi.unstubAllEnvs());

describe("private Timbre setup", () => {
  it("shows pending setup and opens the correct deployment without exposing a credential form", () => {
    render(<TimbreServiceSetup />);
    expect(fixture.query).toHaveBeenCalledWith("timbre_setup:configuration");
    expect(screen.getByText("Sin proveedor configurado")).toBeInTheDocument();
    expect(screen.getByLabelText("Variables del servicio")).toHaveTextContent(
      "TIMBRE_CLOUDFLARE_TURN_KEY_ID",
    );
    expect(screen.getAllByText("Pendiente")).toHaveLength(3);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Abrir variables en Convex/ }),
    ).toHaveAttribute(
      "href",
      "https://dashboard.convex.dev/d/review-backend-123/settings/environment-variables",
    );
  });

  it("copies only the empty-value template, never values from backend configuration", async () => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, "writeText");
    render(<TimbreServiceSetup />);
    await user.click(screen.getByRole("button", { name: "Copiar plantilla" }));
    expect(write).toHaveBeenCalledWith(CLOUDFLARE_TURN_TEMPLATE);
    expect(write).toHaveBeenCalledWith(
      "TIMBRE_TURN_PROVIDER=cloudflare\nTIMBRE_CLOUDFLARE_TURN_KEY_ID=\nTIMBRE_CLOUDFLARE_TURN_API_TOKEN=",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Plantilla copiada");
  });

  it("distinguishes saved credentials from a real call and from Android delivery", () => {
    fixture.configuration = {
      turn: {
        provider: "cloudflare",
        configured: true,
        checks: [
          { name: "TIMBRE_CLOUDFLARE_TURN_API_TOKEN", configured: true },
        ],
      },
      push: { configured: true },
      callTested: false,
    };
    render(<TimbreServiceSetup />);
    expect(screen.getByText("Cloudflare TURN")).toBeInTheDocument();
    expect(
      screen.getByText(/Configuración guardada en el servidor/),
    ).toHaveTextContent(
      "no comprueba la conexión con el proveedor ni una llamada real",
    );
    expect(
      screen.getByText(/Prueba de llamada real pendiente/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Servidor de notificaciones configurado/),
    ).toHaveTextContent("APK preparada para ese proyecto");
    expect(
      screen.getByText(/Los avisos de Firebase Cloud Messaging son gratuitos/),
    ).toBeInTheDocument();
  });

  it("keeps setup available when clipboard or local-backend dashboard navigation is unavailable", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "http://127.0.0.1:3210");
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("denied"),
    );
    render(<TimbreServiceSetup />);
    await user.click(screen.getByRole("button", { name: "Copiar plantilla" }));
    expect(screen.getByRole("status")).toHaveTextContent("No se pudo copiar");
    expect(
      screen.getByRole("link", { name: /Abrir panel de Convex/ }),
    ).toHaveAttribute("href", "https://dashboard.convex.dev");
  });

  it("waits for administrator configuration before presenting its state", () => {
    fixture.configuration = undefined;
    render(<TimbreServiceSetup />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Revisando la configuración",
    );
    expect(
      screen.queryByRole("button", { name: "Copiar plantilla" }),
    ).not.toBeInTheDocument();
  });

  it("derives dashboard links only from a hosted, credential-free Convex URL", () => {
    expect(
      timbreEnvironmentDashboardUrl("https://example-123.convex.cloud"),
    ).toBe(
      "https://dashboard.convex.dev/d/example-123/settings/environment-variables",
    );
    for (const value of [
      undefined,
      "invalid",
      "http://example-123.convex.cloud",
      "https://example-123.convex.cloud.attacker.test",
      "https://secret@example-123.convex.cloud",
      "https://example-123.convex.cloud:444",
      "https://example-123.convex.cloud/path",
      "https://example-123.convex.cloud?token=secret",
      "https://example-123.convex.cloud#secret",
    ])
      expect(timbreEnvironmentDashboardUrl(value)).toBeNull();
  });
});
