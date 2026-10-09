import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NativeCapabilities } from "@/lib/android-native.ts";
import AndroidIntegrations from "./integrations.tsx";
import AndroidIntegrationDetails from "./integration-details.tsx";

const state = vi.hoisted(() => ({
  native: true,
  authenticated: true,
  connected: true,
  inflight: false,
  settings: { homeWebhookUrl: null as string | null },
  capabilities: vi.fn(),
  homeAssistantStatus: vi.fn(),
  discoverLights: vi.fn(),
  configureHomeAssistant: vi.fn(),
  disconnectHomeAssistant: vi.fn(),
  controlLight: vi.fn(),
  permission: vi.fn(),
  allowedApps: vi.fn(),
  manageApps: vi.fn(),
  media: vi.fn(),
  setWebhook: vi.fn(),
  testWebhook: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isAuthenticated: state.authenticated,
    isLoading: false,
  }),
  useConvexConnectionState: () => ({
    isWebSocketConnected: state.connected,
    hasEverConnected: true,
    hasInflightRequests: state.inflight,
  }),
  useQuery: () => state.settings,
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === "lights:setHomeWebhook"
      ? state.setWebhook
      : state.testWebhook,
}));
vi.mock("@/components/ui/signin.tsx", () => ({
  SignInButton: () => <button>Entrar</button>,
}));
vi.mock("sonner", () => ({
  toast: { error: state.error, success: state.success },
}));
vi.mock("@/lib/android-native.ts", () => ({
  isAndroidNative: () => state.native,
  actions: { media: state.media },
  nativeDeck: {
    getCapabilities: state.capabilities,
    homeAssistantStatus: state.homeAssistantStatus,
    getHomeAssistantLights: state.discoverLights,
    configureHomeAssistant: state.configureHomeAssistant,
    disconnectHomeAssistant: state.disconnectHomeAssistant,
    controlLight: state.controlLight,
    openMediaPermissionSettings: state.permission,
    getAllowedApps: state.allowedApps,
    manageAllowedApps: state.manageApps,
  },
}));
vi.mock("./_components/viso-devices-panel.tsx", () => ({
  VisoDevicesPanel: () => <p>Administrar dispositivos VISO</p>,
}));

const androidCapabilities: NativeCapabilities = {
  platform: "android",
  immersive: true,
  secureStorage: true,
  openApps: true,
  mediaVolume: true,
  mediaSession: false,
  mediaPermissionGranted: false,
  activeMediaSessions: 0,
  homeAssistant: {
    status: "disconnected",
    configured: false,
    message: "Sin configurar",
  },
  googleHome: { status: "pending", message: "Pendiente" },
};

function open(route = "/android/integrations") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/android/integrations" element={<AndroidIntegrations />} />
        <Route
          path="/android/integrations/:integration"
          element={<AndroidIntegrationDetails />}
        />
        <Route path="/deck" element={<p>Deck de VISO</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  state.native = true;
  state.authenticated = true;
  state.connected = true;
  state.inflight = false;
  state.settings = { homeWebhookUrl: null };
  state.capabilities.mockResolvedValue(structuredClone(androidCapabilities));
  state.homeAssistantStatus.mockResolvedValue(
    androidCapabilities.homeAssistant,
  );
  state.discoverLights.mockResolvedValue([]);
  state.allowedApps.mockResolvedValue([]);
  state.manageApps.mockResolvedValue([]);
});

describe("Android integration navigation", () => {
  it("groups all six integrations in the requested order and leaves controls inside details", async () => {
    open();
    await screen.findByText("Permiso de reproducción pendiente");
    const links = screen.getAllByRole("link", { name: /^Configurar / });
    expect(links.map((link) => link.getAttribute("aria-label"))).toEqual([
      "Configurar Google Home",
      "Configurar Amazon Alexa",
      "Configurar Dispositivos VISO",
      "Configurar Home Assistant",
      "Configurar Spotify y multimedia",
      "Configurar Aplicaciones y automatizaciones",
    ]);
    expect(
      within(
        screen.getByRole("region", { name: "Hogar inteligente" }),
      ).getAllByRole("link"),
    ).toHaveLength(4);
    expect(
      within(
        screen.getByRole("region", { name: "Aplicaciones y multimedia" }),
      ).getAllByRole("link"),
    ).toHaveLength(2);
    expect(
      screen.queryByText(/Elgato|Stream Deck Mobile|Luces y RGB/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Play / pausa" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Conectar servidor" }),
    ).not.toBeInTheDocument();
    expect(state.discoverLights).not.toHaveBeenCalled();
  });

  it("opens media controls only after entering and returns to the compact menu", async () => {
    open();
    fireEvent.click(
      screen.getByRole("link", { name: "Configurar Spotify y multimedia" }),
    );
    expect(
      await screen.findByRole("button", { name: "Play / pausa" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("link", { name: "Volver a integraciones" }),
    );
    expect(
      screen.getByRole("heading", { name: "Integraciones", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Play / pausa" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    { connected: false, inflight: false, text: "VISO — Sin conexión" },
    { connected: true, inflight: true, text: "VISO — Sincronizando" },
    { connected: true, inflight: false, text: "VISO — Conectado" },
  ])(
    "shows the actual VISO connection state: $text",
    async ({ connected, inflight, text }) => {
      state.connected = connected;
      state.inflight = inflight;
      open();
      expect(screen.getByRole("status")).toHaveTextContent(text);
      await screen.findByText("Permiso de reproducción pendiente");
    },
  );

  it("does not read native integrations before signing into VISO", () => {
    state.authenticated = false;
    open();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expect(state.capabilities).not.toHaveBeenCalled();
  });

  it("keeps Google Home pending without a fake account-link button", () => {
    open("/android/integrations/google-home");
    expect(screen.getByText("Pendiente de habilitación")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Conectar|Vincular|Autorizar/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Usar Home Assistant" }),
    ).toHaveAttribute("href", "/android/integrations/home-assistant");
  });
});

describe("multimedia permissions and real native operations", () => {
  it("requires actual media permission for playback but preserves volume without it", async () => {
    state.capabilities.mockResolvedValue({
      ...androidCapabilities,
      activeMediaSessions: 1,
      mediaSession: true,
    });
    open("/android/integrations/media");
    await screen.findByText("Permiso de reproducción pendiente");
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Play / pausa" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Volumen +" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Volumen +" }));
    await waitFor(() => expect(state.media).toHaveBeenCalledWith("volume-up"));
    expect(state.permission).not.toHaveBeenCalled();
  });

  it("opens Android's real permission settings when requested", async () => {
    open("/android/integrations/media");
    await screen.findByText("Permiso de reproducción pendiente");
    fireEvent.click(
      screen.getByRole("button", { name: "Permitir control multimedia" }),
    );
    await waitFor(() => expect(state.permission).toHaveBeenCalledOnce());
  });

  it("permits playback only for an authorized active media session", async () => {
    state.capabilities.mockResolvedValue({
      ...androidCapabilities,
      mediaPermissionGranted: true,
      mediaSession: true,
      activeMediaSessions: 1,
    });
    open("/android/integrations/media");
    await screen.findByText("Reproducción disponible");
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(state.media).toHaveBeenCalledWith("next"));
    expect(state.media).toHaveBeenCalledOnce();
    expect(
      screen.queryByLabelText(/Spotify.*contraseña|Contraseña de Spotify/),
    ).not.toBeInTheDocument();
  });

  it("does not simulate native media actions in the browser", async () => {
    state.native = false;
    state.capabilities.mockResolvedValue({
      ...androidCapabilities,
      platform: "web",
      mediaVolume: false,
    });
    open("/android/integrations/media");
    await screen.findByText("Requiere Android");
    for (const button of screen.getAllByRole("button"))
      expect(button).toBeDisabled();
    expect(state.media).not.toHaveBeenCalled();
  });
});

describe("Home Assistant", () => {
  it("rechecks saved credentials instead of trusting a stale connected status", async () => {
    state.capabilities.mockResolvedValue({
      ...androidCapabilities,
      homeAssistant: {
        status: "connected",
        configured: true,
        message: "Previous verification",
      },
    });
    state.homeAssistantStatus.mockResolvedValue({
      status: "disconnected",
      configured: true,
      message: "Server unreachable",
    });
    open("/android/integrations/home-assistant");
    await screen.findByText("Sin conexión");
    expect(state.homeAssistantStatus).toHaveBeenCalledOnce();
    expect(state.discoverLights).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Desconectar" })).toBeEnabled();
  });

  it("preserves native control of discovered lights and exposes color only when supported", async () => {
    state.capabilities.mockResolvedValue({
      ...androidCapabilities,
      homeAssistant: {
        status: "connected",
        configured: true,
        message: "Verified",
      },
    });
    state.homeAssistantStatus.mockResolvedValue({
      status: "connected",
      configured: true,
      message: "Verified",
    });
    state.discoverLights.mockResolvedValue([
      {
        id: "light.office",
        name: "Oficina",
        on: false,
        available: true,
        brightness: 40,
        supportsColor: true,
      },
      {
        id: "light.hall",
        name: "Pasillo",
        on: false,
        available: false,
        supportsColor: false,
      },
    ]);
    open("/android/integrations/home-assistant");
    await screen.findByText("Oficina");
    expect(screen.getByLabelText("Color de Oficina")).toBeEnabled();
    expect(screen.queryByLabelText("Color de Pasillo")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "No disponible" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Encender" }));
    await waitFor(() =>
      expect(state.controlLight).toHaveBeenCalledWith("light.office", {
        on: true,
      }),
    );
  });

  it("disables secure native configuration in the browser", async () => {
    state.native = false;
    state.capabilities.mockResolvedValue({
      ...androidCapabilities,
      platform: "web",
      homeAssistant: {
        status: "unavailable",
        configured: false,
        message: "Android only",
      },
    });
    open("/android/integrations/home-assistant");
    await screen.findByText("Requiere Android");
    expect(
      screen.getByRole("button", { name: "Conectar servidor" }),
    ).toBeDisabled();
    expect(state.configureHomeAssistant).not.toHaveBeenCalled();
  });
});

describe("Alexa services and allowed applications", () => {
  it("reports a saved webhook as configuration and test scheduling, not an Alexa account connection", async () => {
    state.settings = {
      homeWebhookUrl:
        "https://api-v3.voicemonkey.io/trigger?token=test&device=test",
    };
    open("/android/integrations/alexa");
    expect(
      screen.getByText("Servicio configurado · cuenta sin vincular"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Dirección de activación de tu servicio"),
    ).toHaveAttribute("type", "password");
    expect(
      screen.queryByRole("button", { name: /Vincular Alexa|Conectar Alexa/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Probar rutina" }));
    await waitFor(() => expect(state.testWebhook).toHaveBeenCalledWith({}));
    expect(state.success).toHaveBeenCalledWith(
      "Prueba solicitada. Comprobá la rutina en Alexa.",
    );
  });

  it("saves and disconnects the existing shared webhook without claiming provider success", async () => {
    open("/android/integrations/alexa");
    fireEvent.change(
      screen.getByLabelText("Dirección de activación de tu servicio"),
      { target: { value: "https://example.com/routine" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(state.setWebhook).toHaveBeenCalledWith({
        url: "https://example.com/routine",
      }),
    );
    expect(state.testWebhook).not.toHaveBeenCalled();
  });

  it("uses the visual native selector and updates its commercial app count", async () => {
    state.allowedApps.mockResolvedValue([
      "com.example.first",
      "com.example.second",
    ]);
    state.manageApps.mockResolvedValue(["com.example.first"]);
    open("/android/integrations/apps");
    await screen.findByText("2 aplicaciones permitidas");
    expect(screen.queryByText(/com\.example/)).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Aplicaciones permitidas" }),
    );
    await screen.findByText("1 aplicación permitida");
    expect(state.manageApps).toHaveBeenCalledOnce();
  });

  it("does not simulate an Android app selector on the web", () => {
    state.native = false;
    open("/android/integrations/apps");
    expect(
      screen.getByRole("button", { name: "Aplicaciones permitidas" }),
    ).toBeDisabled();
    expect(state.allowedApps).not.toHaveBeenCalled();
  });
});
