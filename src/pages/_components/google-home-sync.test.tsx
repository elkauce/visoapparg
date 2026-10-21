import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GoogleHomeSync from "./google-home-sync.tsx";

const fixture = vi.hoisted(() => ({
  android: true,
  pathname: "/deck",
  authenticated: true,
  loading: false,
  user: { _id: "owner-A" } as { _id: string } | null,
  data: {
    activeStatusId: "status-libre",
    statuses: [{ _id: "status-libre", userId: "owner-A", name: "Libre" }],
  } as {
    activeStatusId: string;
    activeStatusRevision?: number;
    statuses: {
      _id: string;
      userId: string;
      name: string;
      color?: string;
      icon?: string;
    }[];
  },
  pauseListener: null as (() => void) | null,
  resumeListener: null as (() => void) | null,
  setBackgroundSync: vi.fn(),
  appListener: null as ((event: { isActive: boolean }) => void) | null,
  listenerRemoved: vi.fn(),
  getState: vi.fn(),
  addListener: vi.fn(),
  getStatus: vi.fn(),
  getConfiguration: vi.fn(),
  setActiveAccount: vi.fn(),
  applyState: vi.fn(),
}));
vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: fixture.pathname }),
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isAuthenticated: fixture.authenticated,
    isLoading: fixture.loading,
  }),
  useQuery: (query: unknown, options: unknown) =>
    options === "skip"
      ? undefined
      : query === "users-current"
        ? fixture.user
        : fixture.data,
}));
vi.mock("@/convex/_generated/api.js", () => ({
  api: {
    users: { getCurrentUser: "users-current" },
    statuses: { list: "statuses-list" },
  },
}));
vi.mock("@/lib/android-native.ts", () => ({
  isAndroidNative: () => fixture.android,
}));
vi.mock("@capacitor/app", () => ({
  App: { getState: fixture.getState, addListener: fixture.addListener },
}));
vi.mock("@/lib/google-home-native.ts", () => ({
  GOOGLE_HOME_CONFIGURATION_EVENT: "viso:google-home-configuration",
  googleHomeNative: {
    getStatus: fixture.getStatus,
    getConfiguration: fixture.getConfiguration,
    setActiveAccount: fixture.setActiveAccount,
    setBackgroundSync: fixture.setBackgroundSync,
    applyState: fixture.applyState,
  },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const colors = {
  libre: "#00ff00",
  ocupado: "#ff0000",
  reunion: "#ffff00",
  llamada: "#0000ff",
  "no-molestar": "#ff00ff",
  ausente: "#aaaaaa",
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function settle() {
  await act(async () => {
    await new Promise((done) => setTimeout(done, 0));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  fixture.pathname = "/deck";
  fixture.pauseListener = null;
  fixture.resumeListener = null;
  fixture.setBackgroundSync.mockResolvedValue(undefined);
  fixture.android = true;
  fixture.authenticated = true;
  fixture.loading = false;
  fixture.user = { _id: "owner-A" };
  fixture.data = {
    activeStatusRevision: undefined,
    activeStatusId: "status-libre",
    statuses: [{ _id: "status-libre", userId: "owner-A", name: "Libre" }],
  };
  fixture.appListener = null;
  fixture.getState.mockResolvedValue({ isActive: true });
  fixture.addListener.mockImplementation(
    async (
      _event: string,
      callback: (event: { isActive: boolean }) => void,
    ) => {
      if (_event === "appStateChange") fixture.appListener = callback;
      if (_event === "pause")
        fixture.pauseListener = () => callback({ isActive: false });
      if (_event === "resume")
        fixture.resumeListener = () => callback({ isActive: true });
      return { remove: fixture.listenerRemoved };
    },
  );
  fixture.getStatus.mockResolvedValue({
    sdkPresent: true,
    available: true,
    status: "connected",
    authorized: true,
    configured: true,
    selectedCount: 1,
    message: "Real permission result",
  });
  fixture.getConfiguration.mockResolvedValue({
    selectedIds: ["chosen-light"],
    colorsByState: colors,
    enabled: true,
    revision: "config-1",
  });
  fixture.setActiveAccount.mockResolvedValue(undefined);
  fixture.applyState.mockResolvedValue({
    applied: true,
    skipped: false,
    results: [{ id: "chosen-light", success: true, confirmed: true }],
  });
});

describe("Google Home global Android state observer", () => {
  it("reapplies the same state after a new manual or automatic revision", async () => {
    fixture.data.activeStatusRevision = 1;
    const view = render(<GoogleHomeSync />);
    await waitFor(() => expect(fixture.applyState).toHaveBeenCalledTimes(1));
    fixture.data = { ...fixture.data, activeStatusRevision: 2 };
    view.rerender(<GoogleHomeSync />);
    await waitFor(() => expect(fixture.applyState).toHaveBeenCalledTimes(2));
    expect(fixture.applyState).toHaveBeenLastCalledWith({
      accountId: "owner-A",
      stateKey: "libre",
      revision: "status-libre:libre:2",
    });
  });

  it("receives remote Convex changes without a local button click", async () => {
    const view = render(<GoogleHomeSync />);
    await waitFor(() =>
      expect(fixture.applyState).toHaveBeenCalledWith({
        accountId: "owner-A",
        stateKey: "libre",
        revision: "status-libre:libre",
      }),
    );
    fixture.data = {
      activeStatusId: "remote-meeting",
      statuses: [
        { _id: "remote-meeting", userId: "owner-A", name: "En reunión" },
      ],
    };
    view.rerender(<GoogleHomeSync />);
    await waitFor(() =>
      expect(fixture.applyState).toHaveBeenLastCalledWith({
        accountId: "owner-A",
        stateKey: "reunion",
        revision: "remote-meeting:reunion",
      }),
    );
  });

  it("does not apply a cached previous account's status to the new account's lights", async () => {
    const view = render(<GoogleHomeSync />);
    await waitFor(() => expect(fixture.applyState).toHaveBeenCalledTimes(1));
    fixture.user = { _id: "owner-B" };
    view.rerender(<GoogleHomeSync />);
    await settle();
    expect(fixture.applyState).toHaveBeenCalledTimes(1);
    fixture.data = {
      activeStatusId: "B-away",
      statuses: [{ _id: "B-away", userId: "owner-B", name: "Ausente" }],
    };
    view.rerender(<GoogleHomeSync />);
    await waitFor(() =>
      expect(fixture.applyState).toHaveBeenLastCalledWith({
        accountId: "owner-B",
        stateKey: "ausente",
        revision: "B-away:ausente",
      }),
    );
  });

  it("cancels ownership as soon as authentication ends even if query data is still cached", async () => {
    const view = render(<GoogleHomeSync />);
    await waitFor(() => expect(fixture.applyState).toHaveBeenCalledTimes(1));
    fixture.authenticated = false;
    view.rerender(<GoogleHomeSync />);
    expect(fixture.setActiveAccount).toHaveBeenLastCalledWith({
      accountId: null,
    });
    await settle();
    expect(fixture.applyState).toHaveBeenCalledTimes(1);
  });

  it("waits for real Android foreground information before sending the first command", async () => {
    const initial = deferred<{ isActive: boolean }>();
    fixture.getState.mockReturnValueOnce(initial.promise);
    render(<GoogleHomeSync />);
    await settle();
    expect(fixture.applyState).not.toHaveBeenCalled();
    await act(async () => {
      initial.resolve({ isActive: true });
    });
    await waitFor(() => expect(fixture.applyState).toHaveBeenCalledTimes(1));
  });

  it("keeps background paused when accounts change, then applies the latest owned state on resume", async () => {
    const view = render(<GoogleHomeSync />);
    await waitFor(() => expect(fixture.applyState).toHaveBeenCalledTimes(1));
    act(() => fixture.appListener?.({ isActive: false }));
    fixture.user = { _id: "owner-B" };
    fixture.data = {
      activeStatusId: "B-busy",
      statuses: [{ _id: "B-busy", userId: "owner-B", name: "Ocupado" }],
    };
    view.rerender(<GoogleHomeSync />);
    await settle();
    expect(fixture.applyState).toHaveBeenCalledTimes(1);
    expect(fixture.setActiveAccount).toHaveBeenLastCalledWith({
      accountId: null,
    });
    expect(fixture.addListener).toHaveBeenCalledTimes(3);
    act(() => fixture.appListener?.({ isActive: true }));
    await waitFor(() =>
      expect(fixture.applyState).toHaveBeenLastCalledWith({
        accountId: "owner-B",
        stateKey: "ocupado",
        revision: "B-busy:ocupado",
      }),
    );
  });

  it("does not override a newer app-state event with the old initial getState answer", async () => {
    const initial = deferred<{ isActive: boolean }>();
    fixture.getState.mockReturnValueOnce(initial.promise);
    render(<GoogleHomeSync />);
    await settle();
    act(() => fixture.appListener?.({ isActive: false }));
    await act(async () => {
      initial.resolve({ isActive: true });
    });
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

it("rebinds the native account after Google's translucent activity without a preceding inactive event", async () => {
  render(<GoogleHomeSync />);
  await waitFor(() => expect(fixture.applyState).toHaveBeenCalledTimes(1));
  const bindings = fixture.setActiveAccount.mock.calls.length;
  const queries = fixture.getStatus.mock.calls.length;
  act(() => fixture.appListener?.({ isActive: true }));
  await waitFor(() =>
    expect(fixture.getStatus.mock.calls.length).toBeGreaterThan(queries),
  );
  expect(fixture.setActiveAccount.mock.calls.length).toBeGreaterThan(bindings);
  expect(fixture.setActiveAccount).toHaveBeenLastCalledWith({
    accountId: "owner-A",
  });
  await waitFor(() => expect(fixture.applyState).toHaveBeenCalledTimes(2));
});

it("never restores a logged-out account when Google returns an active event", async () => {
  const view = render(<GoogleHomeSync />);
  await waitFor(() => expect(fixture.applyState).toHaveBeenCalledTimes(1));
  fixture.authenticated = false;
  view.rerender(<GoogleHomeSync />);
  await settle();
  act(() => fixture.appListener?.({ isActive: true }));
  await settle();
  expect(fixture.setActiveAccount).toHaveBeenLastCalledWith({
    accountId: null,
  });
  expect(fixture.applyState).toHaveBeenCalledTimes(1);
});

it("receives the real custom status RGB from shared account data and resynchronizes a changed color", async () => {
  fixture.data = {
    activeStatusRevision: undefined,
    activeStatusId: "playing",
    statuses: [
      {
        _id: "playing",
        userId: "owner-A",
        name: "Jugando",
        color: "#12abef",
      } as (typeof fixture.data.statuses)[number] & { color: string },
    ],
  };
  const view = render(<GoogleHomeSync />);
  await waitFor(() =>
    expect(fixture.applyState).toHaveBeenCalledWith({
      accountId: "owner-A",
      stateKey: null,
      revision: "playing:custom:#12abef",
      customColor: "#12abef",
    }),
  );
  fixture.data = {
    activeStatusRevision: undefined,
    activeStatusId: "playing",
    statuses: [
      {
        _id: "playing",
        userId: "owner-A",
        name: "Jugando",
        color: "#fd2244",
      } as (typeof fixture.data.statuses)[number] & { color: string },
    ],
  };
  view.rerender(<GoogleHomeSync />);
  await waitFor(() =>
    expect(fixture.applyState).toHaveBeenLastCalledWith({
      accountId: "owner-A",
      stateKey: null,
      revision: "playing:custom:#fd2244",
      customColor: "#fd2244",
    }),
  );
});

it("recovers the latest call from an Android overlay without an appStateChange event", async () => {
  const view = render(<GoogleHomeSync />);
  await waitFor(() => expect(fixture.applyState).toHaveBeenCalledTimes(1));
  act(() => fixture.pauseListener?.());
  fixture.data = {
    activeStatusId: "phone-call",
    activeStatusRevision: 2,
    statuses: [{ _id: "phone-call", userId: "owner-A", name: "Llamada" }],
  };
  view.rerender(<GoogleHomeSync />);
  await settle();
  expect(fixture.applyState).toHaveBeenCalledTimes(1);
  act(() => fixture.resumeListener?.());
  await waitFor(() =>
    expect(fixture.applyState).toHaveBeenLastCalledWith({
      accountId: "owner-A",
      stateKey: "llamada",
      revision: "phone-call:llamada:2",
    }),
  );
});

it("keeps Google Home enabled only for a Deck account with automatic presence opted in", async () => {
  localStorage.setItem(
    "viso:presence:owner-A",
    JSON.stringify({ calls: true, calendarIds: [], allBusyEvents: false }),
  );
  const view = render(<GoogleHomeSync />);
  await waitFor(() =>
    expect(fixture.setBackgroundSync).toHaveBeenLastCalledWith({
      accountId: "owner-A",
      enabled: true,
    }),
  );
  act(() => fixture.pauseListener?.());
  fixture.data = {
    activeStatusId: "auto-call",
    activeStatusRevision: 2,
    statuses: [{ _id: "auto-call", userId: "owner-A", name: "Llamada" }],
  };
  view.rerender(<GoogleHomeSync />);
  await waitFor(() =>
    expect(fixture.applyState).toHaveBeenLastCalledWith({
      accountId: "owner-A",
      stateKey: "llamada",
      revision: "auto-call:llamada:2",
    }),
  );
  fixture.pathname = "/android/display";
  view.rerender(<GoogleHomeSync />);
  await waitFor(() =>
    expect(fixture.setActiveAccount).toHaveBeenLastCalledWith({
      accountId: null,
    }),
  );
});

it("checks saved permissions again on network recovery and does not reconnect after logout", async () => {
  fixture.getStatus.mockRejectedValueOnce(
    new Error("Sin conexión con Google Home"),
  );
  const view = render(<GoogleHomeSync />);
  await waitFor(() => expect(fixture.getStatus).toHaveBeenCalled());
  await settle();
  expect(fixture.applyState).not.toHaveBeenCalled();
  act(() => window.dispatchEvent(new Event("online")));
  await waitFor(() => expect(fixture.applyState).toHaveBeenCalledTimes(1));
  expect(fixture.applyState).toHaveBeenLastCalledWith({
    accountId: "owner-A",
    stateKey: "libre",
    revision: "status-libre:libre",
  });
  fixture.authenticated = false;
  view.rerender(<GoogleHomeSync />);
  const reads = fixture.getStatus.mock.calls.length;
  act(() => window.dispatchEvent(new Event("online")));
  await settle();
  expect(fixture.getStatus).toHaveBeenCalledTimes(reads);
  expect(fixture.applyState).toHaveBeenCalledTimes(1);
  view.unmount();
});
