import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TimbreIncoming, { TimbreNotificationSettings } from "./timbre-incoming";

const fixture = vi.hoisted(() => ({
  authenticated: true,
  native: false,
  calls: [] as Array<Record<string, unknown>>,
  query: vi.fn(),
  reject: vi.fn(async () => undefined),
  notified: vi.fn(),
  request: vi.fn(async () => "granted" as NotificationPermission),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => fixture.native,
    getPlatform: () => (fixture.native ? "android" : "web"),
  },
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: fixture.authenticated }),
  useQuery: () => {
    fixture.query();
    return fixture.calls;
  },
  useMutation: () => fixture.reject,
}));
class BrowserNotification {
  static permission: NotificationPermission = "default";
  static requestPermission = fixture.request;
  close = vi.fn();
  onclick: (() => void) | null = null;
  constructor(title: string, options: NotificationOptions) {
    fixture.notified(title, options);
  }
}
beforeEach(() => {
  fixture.authenticated = true;
  fixture.native = false;
  fixture.calls = [
    {
      callId: "call-1",
      siteName: "Oficina",
      mode: "audio",
      status: "ringing",
      notificationsEnabled: true,
    },
  ];
  fixture.query.mockClear();
  fixture.reject.mockClear();
  fixture.notified.mockClear();
  fixture.request.mockClear();
  BrowserNotification.permission = "default";
  fixture.request.mockImplementation(async () => {
    BrowserNotification.permission = "granted";
    return "granted";
  });
  vi.stubGlobal("Notification", BrowserNotification);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Incoming Timbre calls", () => {
  it("leaves native push configuration to the Android settings instead of showing a second browser opt-in", () => {
    fixture.native = true;
    const view = render(<TimbreNotificationSettings />);
    expect(view.container).toBeEmptyDOMElement();
    expect(fixture.request).not.toHaveBeenCalled();
  });
  it("never subscribes to calls without an authenticated account", () => {
    fixture.authenticated = false;
    render(
      <MemoryRouter>
        <TimbreIncoming />
      </MemoryRouter>,
    );
    expect(fixture.query).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("link", { name: "Ver llamada" }),
    ).not.toBeInTheDocument();
  });
  it("shows an actionable alert without requesting notification permission automatically", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TimbreIncoming />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Ver llamada" })).toHaveAttribute(
      "href",
      "/timbre/call/call-1",
    );
    expect(fixture.request).not.toHaveBeenCalled();
    expect(screen.getByText(/app cerrada requiere/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Rechazar" }));
    expect(fixture.reject).toHaveBeenCalledWith({ callId: "call-1" });
  });
  it("does not duplicate the call page alert", () => {
    render(
      <MemoryRouter initialEntries={["/timbre/call/call-1"]}>
        <TimbreIncoming />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole("link", { name: "Ver llamada" }),
    ).not.toBeInTheDocument();
  });
  it("requires a user gesture for browser permission and states the delivery limitation", async () => {
    const user = userEvent.setup();
    render(<TimbreNotificationSettings />);
    expect(fixture.request).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Activar avisos" }));
    expect(fixture.request).toHaveBeenCalledOnce();
    expect(
      await screen.findByText(/Permiso de avisos concedido/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/entrega con la app cerrada requiere/),
    ).toBeInTheDocument();
  });
  it("honors site notification settings before displaying a browser notice", async () => {
    BrowserNotification.permission = "granted";
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    fixture.calls[0].notificationsEnabled = false;
    const view = render(
      <MemoryRouter>
        <TimbreIncoming />
      </MemoryRouter>,
    );
    expect(fixture.notified).not.toHaveBeenCalled();
    fixture.calls = [{ ...fixture.calls[0], notificationsEnabled: true }];
    view.rerender(
      <MemoryRouter>
        <TimbreIncoming />
      </MemoryRouter>,
    );
    await waitFor(() => expect(fixture.notified).toHaveBeenCalledOnce());
    expect(fixture.notified).toHaveBeenCalledWith(
      "Están llamando a tu Timbre VISO",
      expect.objectContaining({ body: "Oficina", tag: "viso-timbre-call-1" }),
    );
    document.dispatchEvent(new Event("visibilitychange"));
    expect(fixture.notified).toHaveBeenCalledOnce();
  });
});
