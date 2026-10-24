import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TimbrePage from "./page";

const fixture = vi.hoisted(() => ({
  authenticated: true,
  admin: false,
  sites: [] as Array<Record<string, unknown>>,
  qrs: [] as Array<Record<string, unknown>>,
  members: [] as Array<Record<string, unknown>>,
  units: [] as Array<Record<string, unknown>>,
  license: {
    active: false,
    license: null,
    licenses: [] as Array<Record<string, unknown>>,
    reason: "Necesitás contratar Timbre o activar una compra elegible.",
  },
  query: vi.fn(),
  mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isAuthenticated: fixture.authenticated,
    isLoading: false,
  }),
  useQuery: (
    reference: Parameters<typeof getFunctionName>[0],
    args: unknown,
  ) => {
    const name = getFunctionName(reference);
    fixture.query(name, args);
    if (args === "skip") return undefined;
    if (name === "timbre:workspace")
      return { sites: fixture.sites, memberships: [] };
    if (name === "timbre_commerce:myLicense") return fixture.license;
    if (name === "marketplace:session") return { isAdmin: fixture.admin };
    if (name === "timbre:listQrs") return fixture.qrs;
    if (name === "timbre:qrForExport")
      return {
        qr: fixture.qrs.find(
          (qr) => qr._id === (args as { qrId: string }).qrId,
        ),
      };
    if (name === "timbre:listMembers") return fixture.members;
    if (name === "timbre:listUnits") return fixture.units;
    if (name === "statuses:list") return { statuses: [] };
    return [];
  },
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference);
    fixture.mutations[name] ??= vi.fn(async () => ({}));
    return fixture.mutations[name];
  },
}));
vi.mock("../_components/panel-layout", () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/ui/signin", () => ({
  SignInButton: () => <button>Entrar o crear cuenta</button>,
}));
vi.mock("./commercial", () => ({
  default: () => <h2>Planes y placas disponibles</h2>,
}));
vi.mock("./admin", () => ({
  default: () => <h2>Administración comercial</h2>,
}));
vi.mock("./qr-editor", () => ({ default: () => <div>Editor de QR</div> }));
vi.mock("@/components/timbre-incoming", () => ({
  TimbreNotificationSettings: () => null,
}));
vi.mock("@/components/timbre-push", () => ({ TimbrePushSettings: () => null }));
vi.mock("./call-session", () => ({
  TimbreMessages: () => <div>Mensajes del timbre</div>,
}));

function site(patch: Record<string, unknown> = {}) {
  return {
    _id: "site-1",
    ownerId: "owner-1",
    licenseId: "license-1",
    name: "Oficina de mi cuenta",
    kind: "office",
    role: "owner",
    licenseActive: true,
    enabled: true,
    timezone: "America/Argentina/Buenos_Aires",
    allowedAudio: true,
    allowedVideo: true,
    chatEnabled: true,
    messagesEnabled: true,
    notificationsEnabled: true,
    schedule: [],
    recipientIds: ["owner-1"],
    fallbackRecipientIds: [],
    fallbackAfterSeconds: 20,
    features: {
      audio: true,
      video: true,
      chat: true,
      messages: true,
      offices: true,
      buildings: false,
      families: true,
      access: false,
    },
    ...patch,
  };
}
function show() {
  return render(
    <MemoryRouter>
      <TimbrePage />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  fixture.authenticated = true;
  fixture.admin = false;
  fixture.sites = [];
  fixture.qrs = [];
  fixture.members = [];
  fixture.units = [];
  fixture.license = {
    active: false,
    license: null,
    licenses: [],
    reason: "Necesitás contratar Timbre o activar una compra elegible.",
  };
  fixture.query.mockClear();
  fixture.mutations = {};
});

describe("Timbre account workspace", () => {
  it("saves an explicitly confirmed Telegram contact for a licensed home through the dedicated channel API", async () => {
    fixture.sites = [
      site({ kind: "home", licensedFeatures: { audio: true, video: true } }),
    ];
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Disponibilidad" }));
    await user.type(
      screen.getByRole("textbox", { name: "Usuario de Telegram" }),
      "@home_owner",
    );
    expect(
      screen.getByRole("button", { name: "Guardar Telegram" }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", { name: /Confirmo que el perfil/ }),
    );
    await user.click(screen.getByRole("button", { name: "Guardar Telegram" }));
    await waitFor(() =>
      expect(
        fixture.mutations["timbre_telegram:saveContact"],
      ).toHaveBeenCalledWith({ siteId: "site-1", username: "@home_owner" }),
    );
    expect(fixture.mutations["timbre:saveSiteSettings"]).not.toHaveBeenCalled();
  });
  it("directs a unit-based office to its unit contacts without offering a general Telegram destination", async () => {
    fixture.sites = [site({ licensedFeatures: { audio: true, video: true } })];
    fixture.units = [
      {
        _id: "unit-one",
        name: "Oficina 1",
        enabled: true,
        order: 0,
        recipientIds: [],
      },
    ];
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Disponibilidad" }));
    expect(
      screen.getByText(/Configurá Telegram de cada unidad/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Usuario de Telegram" }),
    ).not.toBeInTheDocument();
  });
  it("requires authentication before reading memberships, licenses or QR data", () => {
    fixture.authenticated = false;
    show();
    expect(
      screen.getByRole("button", { name: "Entrar o crear cuenta" }),
    ).toBeInTheDocument();
    expect(fixture.query).not.toHaveBeenCalled();
  });
  it("offers commercial access without enabling Timbre for an account with no license", async () => {
    const user = userEvent.setup();
    show();
    expect(
      screen.queryByRole("heading", { name: "Crear un Timbre" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Crear QR" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Administración" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Planes y placas" }));
    expect(
      screen.getByRole("heading", { name: "Planes y placas disponibles" }),
    ).toBeInTheDocument();
    expect(fixture.mutations["timbre:createSite"]).not.toHaveBeenCalled();
  });
  it("does not require an invited resident to buy a second license for the owner's active Timbre", () => {
    fixture.sites = [site({ role: "resident", ownerId: "different-owner" })];
    show();
    expect(
      screen.getByRole("heading", { name: "Oficina de mi cuenta" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Necesitás una licencia activa para crear y usar un Timbre.",
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Crear QR" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Disponibilidad" }),
    ).not.toBeInTheDocument();
  });
  it("lets an expired owner disable the service and avoids a license-protected history query", async () => {
    fixture.sites = [site({ licenseActive: false, features: null })];
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Desactivar Timbre" }));
    expect(fixture.mutations["timbre:saveSiteSettings"]).toHaveBeenCalledWith({
      siteId: "site-1",
      enabled: false,
    });
    await user.click(screen.getByRole("button", { name: "Historial" }));
    await waitFor(() =>
      expect(fixture.query).toHaveBeenCalledWith(
        "timbre_calls:history",
        "skip",
      ),
    );
    expect(fixture.query).not.toHaveBeenCalledWith("timbre_calls:history", {
      siteId: "site-1",
    });
    expect(
      screen.queryByRole("button", { name: "Crear QR" }),
    ).not.toBeInTheDocument();
  });
  it("removes the prior account's site and QR on account changes", () => {
    fixture.sites = [site()];
    fixture.qrs = [
      {
        _id: "qr-one",
        label: "Acceso de cuenta A",
        token: "a".repeat(64),
        enabled: true,
      },
    ];
    const view = show();
    expect(
      screen.getByRole("heading", { name: "Oficina de mi cuenta" }),
    ).toBeInTheDocument();
    fixture.authenticated = false;
    view.rerender(
      <MemoryRouter>
        <TimbrePage />
      </MemoryRouter>,
    );
    expect(screen.queryByText("Acceso de cuenta A")).not.toBeInTheDocument();
    fixture.authenticated = true;
    fixture.sites = [
      site({ _id: "site-2", ownerId: "owner-2", name: "Cuenta B" }),
    ];
    fixture.qrs = [];
    fixture.query.mockClear();
    view.rerender(
      <MemoryRouter>
        <TimbrePage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: "Cuenta B" }),
    ).toBeInTheDocument();
    expect(fixture.query).toHaveBeenCalledWith("timbre:listQrs", {
      siteId: "site-2",
    });
    expect(fixture.query).not.toHaveBeenCalledWith("timbre:listQrs", {
      siteId: "site-1",
    });
    expect(screen.queryByText("Acceso de cuenta A")).not.toBeInTheDocument();
  });
  it("lets the owner change a member's management role without changing the owner's role", async () => {
    fixture.sites = [site()];
    fixture.members = [
      {
        _id: "member-1",
        userId: "person-1",
        name: "Marina",
        role: "resident",
        canReceive: true,
        unitIds: [],
      },
      {
        _id: "owner-member",
        userId: "owner-1",
        name: "Propietario",
        role: "owner",
        canReceive: true,
        unitIds: [],
      },
    ];
    const user = userEvent.setup();
    show();
    await user.click(
      screen.getByRole("button", { name: "Integrantes y unidades" }),
    );
    expect(
      screen.queryByRole("combobox", { name: "Permiso de Propietario" }),
    ).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Permiso de Marina" }),
      "manager",
    );
    expect(fixture.mutations["timbre:saveMember"]).toHaveBeenCalledWith({
      memberId: "member-1",
      role: "manager",
    });
  });
  it("edits a unit's name and directory order through the same unit identity", async () => {
    fixture.sites = [site({ kind: "building" })];
    fixture.units = [
      {
        _id: "unit-b",
        name: "Departamento B",
        enabled: true,
        order: 3,
        recipientIds: [],
      },
    ];
    const user = userEvent.setup();
    show();
    await user.click(
      screen.getByRole("button", { name: "Integrantes y unidades" }),
    );
    await user.click(screen.getByText("Departamento B · Habilitada"));
    const name = screen.getByRole("textbox", { name: "Nombre de la unidad" });
    const order = screen.getByRole("spinbutton", {
      name: "Orden en el directorio",
    });
    await user.clear(name);
    await user.type(name, "Recepción central");
    await user.clear(order);
    await user.type(order, "1");
    await user.click(screen.getByRole("button", { name: "Guardar unidad" }));
    expect(fixture.mutations["timbre:saveUnit"]).toHaveBeenCalledWith({
      unitId: "unit-b",
      name: "Recepción central",
      order: 1,
    });
  });
});
