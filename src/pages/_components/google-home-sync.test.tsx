import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GoogleHomeSync from "./google-home-sync.tsx";

const fixture = vi.hoisted(() => ({
  android: true,
  authenticated: true,
  loading: false,
  user: { _id: "owner-A" } as { _id: string } | null,
  data: { activeStatusId: "status-libre", statuses: [{ _id: "status-libre", userId: "owner-A", name: "Libre" }] },
  appListener: null as ((event: { isActive: boolean }) => void) | null,
  listenerRemoved: vi.fn(),
  getState: vi.fn(),
  addListener: vi.fn(),
  getStatus: vi.fn(),
  getConfiguration: vi.fn(),
  setActiveAccount: vi.fn(),
  applyState: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: fixture.authenticated, isLoading: fixture.loading }),
  useQuery: (query: unknown, options: unknown) => options === "skip" ? undefined : query === "users-current" ? fixture.user : fixture.data,
}));
vi.mock("@/convex/_generated/api.js", () => ({ api: { users: { getCurrentUser: "users-current" }, statuses: { list: "statuses-list" } } }));
vi.mock("@/lib/android-native.ts", () => ({ isAndroidNative: () => fixture.android }));
vi.mock("@capacitor/app", () => ({ App: { getState: fixture.getState, addListener: fixture.addListener } }));
vi.mock("@/lib/google-home-native.ts", () => ({
  GOOGLE_HOME_CONFIGURATION_EVENT: "viso:google-home-configuration",
  googleHomeNative: {
    getStatus: fixture.getStatus, getConfiguration: fixture.getConfiguration,
    setActiveAccount: fixture.setActiveAccount, applyState: fixture.applyState,
  },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const colors = { libre: "#00ff00", ocupado: "#ff0000", reunion: "#ffff00", llamada: "#0000ff", "no-molestar": "#ff00ff", ausente: "#aaaaaa" };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
async function settle() { await act(async () => { await new Promise((done) => setTimeout(done, 0)); }); }

beforeEach(() => {
  vi.clearAllMocks();
  fixture.android = true;
  fixture.authenticated = true;
  fixture.loading = false;
  fixture.user = { _id: "owner-A" };
  fixture.data = { activeStatusId: "status-libre", statuses: [{ _id: "status-libre", userId: "owner-A", name: "Libre" }] };
  fixture.appListener = null;
  fixture.getState.mockResolvedValue({ isActive: true });
  fixture.addListener.mockImplementation(async (_event: string, callback: (event: { isActive: boolean }) => void) => {
    fixture.appListener = callback;
    return { remove: fixture.listenerRemoved };
  });
  fixture.getStatus.mockResolvedValue({ sdkPresent: true, available: true, status: "connected", authorized: true, configured: true, selectedCount: 1, message: "Real permission result" });
  fixture.getConfiguration.mockResolvedValue({ selectedIds: ["chosen-light"], colorsByState: colors, enabled: true, revision: "config-1" });
  fixture.setActiveAccount.mockResolvedValue(undefined);
  fixture.applyState.mockResolvedValue({ applied: true, skipped: false, results: [{ id: "chosen-light", success: true, confirmed: true }] });
});

describe("Google Home global Android state observer", () => {
  it("receives remote Convex changes without a local button click", async () => {
    const view = render(<GoogleHomeSync />);
    await waitFor(() => expect(fixture.applyState).toHaveBeenCalledWith({ accountId: "owner-A", stateKey: "libre", revision: "status-libre:libre" }));
    fixture.data = { activeStatusId: "remote-meeting", statuses: [{ _id: "remote-meeting", userId: "owner-A", name: "En reunión" }] };
    view.rerender(<GoogleHomeSync />);
    await waitFor(() => expect(fixture.applyState).toHaveBeenLastCalledWith({ accountId: "owner-A", stateKey: "reunion", revision: "remote-meeting:reunion" }));
  });

  it("does not apply a cached previous account's status to the new account's lights", async () => {
    const view = render(<GoogleHomeSync />);
    await waitFor(() => expect(fixture.applyState).toHaveBeenCalledTimes(1));
    fixture.user = { _id: "owner-B" };
    view.rerender(<GoogleHomeSync />);
    await settle();
    expect(fixture.applyState).toHaveBeenCalledTimes(1);
    fixture.data = { activeStatusId: "B-away", statuses: [{ _id: "B-away", userId: "owner-B", name: "Ausente" }] };
    view.rerender(<GoogleHomeSync />);
    await waitFor(() => expect(fixture.applyState).toHaveBeenLastCalledWith({ accountId: "owner-B", stateKey: "ausente", revision: "B-away:ausente" }));
  });

  it("cancels ownership as soon as authentication ends even if query data is still cached", async () => {
    const view = render(<GoogleHomeSync />);
    await waitFor(() => expect(fixture.applyState).toHaveBeenCalledTimes(1));
    fixture.authenticated = false;
    view.rerender(<GoogleHomeSync />);
    expect(fixture.setActiveAccount).toHaveBeenLastCalledWith({ accountId: null });
    await settle();
    expect(fixture.applyState).toHaveBeenCalledTimes(1);
  });

  it("waits for real Android foreground information before sending the first command", async () => {
    const initial = deferred<{ isActive: boolean }>();
    fixture.getState.mockReturnValueOnce(initial.promise);
    render(<GoogleHomeSync />);
    await settle();
    expect(fixture.applyState).not.toHaveBeenCalled();
    await act(async () => { initial.resolve({ isActive: true }); });
    await waitFor(() => expect(fixture.applyState).toHaveBeenCalledTimes(1));
  });

  it("keeps background paused when accounts change, then applies the latest owned state on resume", async () => {
    const view = render(<GoogleHomeSync />);
    await waitFor(() => expect(fixture.applyState).toHaveBeenCalledTimes(1));
    act(() => fixture.appListener?.({ isActive: false }));
    fixture.user = { _id: "owner-B" };
    fixture.data = { activeStatusId: "B-busy", statuses: [{ _id: "B-busy", userId: "owner-B", name: "Ocupado" }] };
    view.rerender(<GoogleHomeSync />);
    await settle();
    expect(fixture.applyState).toHaveBeenCalledTimes(1);
    expect(fixture.setActiveAccount).toHaveBeenLastCalledWith({ accountId: null });
    expect(fixture.addListener).toHaveBeenCalledTimes(1);
    act(() => fixture.appListener?.({ isActive: true }));
    await waitFor(() => expect(fixture.applyState).toHaveBeenLastCalledWith({ accountId: "owner-B", stateKey: "ocupado", revision: "B-busy:ocupado" }));
  });

  it("does not override a newer app-state event with the old initial getState answer", async () => {
    const initial = deferred<{ isActive: boolean }>();
    fixture.getState.mockReturnValueOnce(initial.promise);
    render(<GoogleHomeSync />);
    await settle();
    act(() => fixture.appListener?.({ isActive: false }));
    await act(async () => { initial.resolve({ isActive: true }); });
    await settle();
    expect(fixture.applyState).not.toHaveBeenCalled();
  });

  it("does nothing on the web and never offers fake Google lights", async () => {
    fixture.android = false;
    render(<GoogleHomeSync />);
    await settle();
    expect(fixture.getStatus).not.toHaveBeenCalled();
    expect(fixture.setActiveAccount).not.toHaveBeenCalled();
    expect(fixture.applyState).not.toHaveBeenCalled();
  });
});
