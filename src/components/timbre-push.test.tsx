import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TimbrePush, { TimbrePushSettings } from "./timbre-push";

const f = vi.hoisted(() => ({
  android: true, authenticated: true, configured: true, available: true,
  register: vi.fn(), unregister: vi.fn(), configure: vi.fn(), request: vi.fn(), token: vi.fn(),
  clear: vi.fn(), pending: vi.fn(), query: vi.fn(), navigate: vi.fn(), capabilities: vi.fn(),
  listeners: new Map<string, (value: { callId?: string; isActive?: boolean }) => void>(),
  ownerId: "user1234567890abcdefghijklmnop",
}));
vi.mock("@/convex/_generated/api", () => ({ api: {
  users: { getCurrentUser: "user" }, timbre_calls: { session: "session" },
  timbre_push: { registerDevice: "register", unregisterDevice: "unregister", configuration: "configuration" },
} }));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: f.authenticated, isLoading: false }),
  useQuery: (ref: string) => ref === "user" ? { _id: f.ownerId } : { configured: f.configured, devices: [] },
  useMutation: (ref: string) => ref === "register" ? f.register : f.unregister,
  useConvex: () => convex,
}));
const convex = { query: f.query };
vi.mock("react-router-dom", () => ({ useNavigate: () => f.navigate }));
vi.mock("@/lib/android-native", () => ({ isAndroidNative: () => f.android }));
vi.mock("@capacitor/app", () => ({ App: { addListener: async (name: string, callback: (value: { isActive?: boolean }) => void) => { f.listeners.set(name, callback); return { remove: vi.fn() }; } } }));
vi.mock("@/lib/timbre-native", () => ({ timbreNative: {
  getCapabilities: f.capabilities, requestNotifications: f.request, getPushToken: f.token, configure: f.configure,
  getPendingCall: f.pending, clearPendingCall: f.clear,
  addListener: async (name: string, callback: (value: { callId?: string }) => void) => { f.listeners.set(name, callback); return { remove: vi.fn() }; },
} }));

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); f.listeners.clear();
  f.android = true; f.authenticated = true; f.configured = true; f.available = true;
  f.capabilities.mockImplementation(async () => ({ available: f.available, notificationsEnabled: true, backgroundMedia: false }));
  f.register.mockImplementation(async () => ({ registered: true, configured: f.configured }));
  f.unregister.mockResolvedValue({ disabled: true }); f.configure.mockResolvedValue(undefined);
  f.request.mockResolvedValue({ granted: true }); f.token.mockResolvedValue({ token: "opaque_FCM_installation_token" });
  f.pending.mockResolvedValue({ callId: null }); f.clear.mockResolvedValue(undefined);
  f.query.mockResolvedValue({ status: "ringing" });
});

describe("native Timbre push opt-in", () => {
  it("does not register or request permissions on initial render", async () => {
    render(<TimbrePush />);
    await waitFor(() => expect(f.configure).toHaveBeenCalledWith({ enabled: false }));
    expect(f.register).not.toHaveBeenCalled(); expect(f.request).not.toHaveBeenCalled();
  });
  it("disables activation without both provider configuration and a compatible APK", async () => {
    f.configured = false; render(<TimbrePushSettings />);
    await waitFor(() => expect(f.capabilities).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Activar avisos de Android" })).toBeDisabled();
    expect(f.request).not.toHaveBeenCalled(); expect(f.register).not.toHaveBeenCalled();
  });
  it("registers the authenticated installation only after an explicit user click", async () => {
    render(<TimbrePushSettings />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Activar avisos de Android" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Activar avisos de Android" }));
    await waitFor(() => expect(f.configure).toHaveBeenCalledWith({ ownerId: f.ownerId, enabled: true }));
    expect(f.request).toHaveBeenCalledOnce();
    expect(f.register).toHaveBeenCalledWith({ deviceId: expect.stringMatching(/^[a-zA-Z0-9_-]{20,100}$/), token: "opaque_FCM_installation_token" });
    expect(localStorage.getItem(`viso:timbre-push:${f.ownerId}`)).toBe("enabled");
    fireEvent.click(screen.getByRole("button", { name: "Desactivar avisos de Android" }));
    await waitFor(() => expect(f.unregister).toHaveBeenCalled());
    expect(f.configure).toHaveBeenLastCalledWith({ enabled: false });
  });
  it("refreshes opted-in tokens on resume and verifies notification taps with the server", async () => {
    localStorage.setItem(`viso:timbre-push:${f.ownerId}`, "enabled");
    render(<TimbrePush />);
    await waitFor(() => expect(f.configure).toHaveBeenCalledWith({ ownerId: f.ownerId, enabled: true }));
    await act(async () => { f.listeners.get("appStateChange")?.({ isActive: true }); });
    await waitFor(() => expect(f.token).toHaveBeenCalledTimes(2));
    await act(async () => { f.listeners.get("timbreNotificationTapped")?.({ callId: "https://malicious.example/" }); });
    expect(f.query).not.toHaveBeenCalled();
    f.query.mockRejectedValueOnce(new Error("revoked"));
    await act(async () => { f.listeners.get("timbreNotificationTapped")?.({ callId: "a".repeat(32) }); });
    expect(f.query).toHaveBeenCalledWith("session", { callId: "a".repeat(32) });
    expect(f.navigate).not.toHaveBeenCalled();
    await act(async () => { f.listeners.get("timbreNotificationTapped")?.({ callId: "b".repeat(32) }); });
    expect(f.navigate).toHaveBeenCalledWith(`/timbre/call/${"b".repeat(32)}`);
  });
  it("clears native account configuration at signout and never runs native code on the web", async () => {
    f.authenticated = false;
    const { unmount } = render(<TimbrePush />);
    await waitFor(() => expect(f.configure).toHaveBeenCalledWith({ enabled: false }));
    unmount(); vi.clearAllMocks(); f.android = false; f.authenticated = true;
    render(<><TimbrePush /><TimbrePushSettings /></>);
    expect(f.configure).not.toHaveBeenCalled(); expect(f.capabilities).not.toHaveBeenCalled();
    expect(f.register).not.toHaveBeenCalled(); expect(f.request).not.toHaveBeenCalled();
  });
});
