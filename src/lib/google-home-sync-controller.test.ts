import { describe, expect, it, vi } from "vitest";
import {
  googleHomeStateForStatusName,
  GoogleHomeSyncController,
} from "./google-home-sync-controller.ts";
import type {
  GoogleHomeApplyResult,
  GoogleHomeBridge,
  GoogleHomeConfiguration,
  GoogleHomeStatus,
} from "./google-home-native.ts";
import { readGoogleHomeColors } from "@/pages/deck/_lib/google-home-colors.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function configuration(
  ids = ["desk-light", "monitor-light"],
  revision = "configuration-1",
): GoogleHomeConfiguration {
  return {
    selectedIds: ids,
    colorsByState: readGoogleHomeColors("test-owner"),
    enabled: ids.length > 0,
    revision,
  };
}
const connected: GoogleHomeStatus = {
  sdkPresent: true,
  available: true,
  status: "connected",
  authorized: true,
  configured: true,
  selectedCount: 2,
  message: "Permisos confirmados por Google.",
};
function success(ids = ["desk-light", "monitor-light"]): GoogleHomeApplyResult {
  return {
    applied: true,
    skipped: false,
    results: ids.map((id) => ({ id, success: true, confirmed: true })),
  };
}
function bridge() {
  return {
    setActiveAccount: vi
      .fn<GoogleHomeBridge["setActiveAccount"]>()
      .mockResolvedValue(undefined),
    setBackgroundSync: vi
      .fn<NonNullable<GoogleHomeBridge["setBackgroundSync"]>>()
      .mockResolvedValue(undefined),
    getStatus: vi
      .fn<GoogleHomeBridge["getStatus"]>()
      .mockResolvedValue(connected),
    authorize: vi
      .fn<GoogleHomeBridge["authorize"]>()
      .mockResolvedValue(connected),
    discoverLights: vi
      .fn<GoogleHomeBridge["discoverLights"]>()
      .mockResolvedValue({ ...connected, lights: [] }),
    getConfiguration: vi
      .fn<GoogleHomeBridge["getConfiguration"]>()
      .mockResolvedValue(configuration()),
    saveConfiguration: vi
      .fn<GoogleHomeBridge["saveConfiguration"]>()
      .mockResolvedValue(configuration()),
    applyState: vi
      .fn<GoogleHomeBridge["applyState"]>()
      .mockResolvedValue(success()),
    disconnect: vi
      .fn<GoogleHomeBridge["disconnect"]>()
      .mockResolvedValue(undefined),
  };
}
async function settle() {
  await new Promise((done) => setTimeout(done, 0));
}

describe("Google Home shared-state synchronization", () => {
  it.each([
    [" LIBRE ", "libre"],
    ["Ocupado", "ocupado"],
    ["REUNIÓN", "reunion"],
    ["En reunión", "reunion"],
    ["En llamada", "llamada"],
    ["Llamada", "llamada"],
    ["NO   MOLESTAR", "no-molestar"],
    ["Ausente", "ausente"],
    ["Almuerzo", null],
    ["Mi estado personal", null],
    [null, null],
  ])("maps %s without inventing a state", (name, expected) => {
    expect(googleHomeStateForStatusName(name)).toBe(expected);
  });

  it("applies remote snapshots through only the native owner configuration and deduplicates repeats", async () => {
    const native = bridge();
    const sync = new GoogleHomeSyncController(native);
    sync.setAccount("owner-A");
    sync.updateState("libre", "remote-status-libre");
    await vi.waitFor(() => expect(native.applyState).toHaveBeenCalledTimes(1));
    expect(native.applyState).toHaveBeenLastCalledWith({
      accountId: "owner-A",
      stateKey: "libre",
      revision: "remote-status-libre",
    });
    // No device ID or all-lights command can be supplied by this state observer.
    sync.updateState("libre", "remote-status-libre");
    await settle();
    expect(native.applyState).toHaveBeenCalledTimes(1);
    sync.updateState("ocupado", "remote-status-ocupado");
    await vi.waitFor(() => expect(native.applyState).toHaveBeenCalledTimes(2));
    expect(native.applyState).toHaveBeenLastCalledWith({
      accountId: "owner-A",
      stateKey: "ocupado",
      revision: "remote-status-ocupado",
    });
  });

  it.each([
    { status: { ...connected, authorized: false }, config: configuration() },
    { status: { ...connected, available: false }, config: configuration() },
    { status: { ...connected, configured: false }, config: configuration() },
    { status: { ...connected, selectedCount: 0 }, config: configuration() },
    { status: connected, config: configuration([]) },
    { status: connected, config: { ...configuration(), enabled: false } },
  ])(
    "never commands lights without confirmed permissions and explicit selection (%j)",
    async ({ status, config }) => {
      const native = bridge();
      native.getStatus.mockResolvedValue(status);
      native.getConfiguration.mockResolvedValue(config);
      const sync = new GoogleHomeSyncController(native);
      sync.setAccount("owner-A");
      sync.updateState("libre", "status-1");
      await settle();
      expect(native.applyState).not.toHaveBeenCalled();
      expect(native.authorize).not.toHaveBeenCalled();
      expect(native.discoverLights).not.toHaveBeenCalled();
    },
  );

  it("coalesces intermediate remote states while an SDK command is in flight", async () => {
    const native = bridge();
    const first = deferred<GoogleHomeApplyResult>();
    native.applyState.mockReturnValueOnce(first.promise);
    const sync = new GoogleHomeSyncController(native);
    sync.setAccount("owner-A");
    sync.updateState("libre", "libre-1");
    await vi.waitFor(() => expect(native.applyState).toHaveBeenCalledTimes(1));
    sync.updateState("reunion", "reunion-2");
    sync.updateState("no-molestar", "no-molestar-3");
    expect(native.applyState).toHaveBeenCalledTimes(1);
    first.resolve(success());
    await vi.waitFor(() => expect(native.applyState).toHaveBeenCalledTimes(2));
    expect(native.applyState).toHaveBeenLastCalledWith({
      accountId: "owner-A",
      stateKey: "no-molestar",
      revision: "no-molestar-3",
    });
  });

  it("invalidates pending permission reads on logout before any command", async () => {
    const native = bridge();
    const status = deferred<GoogleHomeStatus>();
    native.getStatus.mockReturnValueOnce(status.promise);
    const sync = new GoogleHomeSyncController(native);
    sync.setAccount("owner-A");
    sync.updateState("ocupado", "occupied");
    await vi.waitFor(() => expect(native.getStatus).toHaveBeenCalled());
    sync.setAccount(null);
    expect(native.setActiveAccount).toHaveBeenLastCalledWith({
      accountId: null,
    });
    status.resolve(connected);
    await settle();
    expect(native.applyState).not.toHaveBeenCalled();
  });

  it("does not carry a queued state or late error from one account into another", async () => {
    const native = bridge();
    const pending = deferred<GoogleHomeApplyResult>();
    native.applyState.mockReturnValueOnce(pending.promise);
    const errors = vi.fn();
    const sync = new GoogleHomeSyncController(native, errors);
    sync.setAccount("owner-A");
    sync.updateState("libre", "A-libre");
    await vi.waitFor(() => expect(native.applyState).toHaveBeenCalledTimes(1));
    sync.updateState("ocupado", "A-occupied-queued");
    sync.setAccount(null);
    sync.setAccount("owner-B");
    await settle();
    expect(native.applyState).toHaveBeenCalledTimes(1);
    sync.updateState("ausente", "B-away");
    pending.reject(new Error("Old account failed"));
    await vi.waitFor(() => expect(native.applyState).toHaveBeenCalledTimes(2));
    expect(native.applyState).toHaveBeenLastCalledWith({
      accountId: "owner-B",
      stateKey: "ausente",
      revision: "B-away",
    });
    expect(errors).not.toHaveBeenCalled();
  });

  it("pauses native ownership in background and reapplies only the latest state after resume", async () => {
    const native = bridge();
    const sync = new GoogleHomeSyncController(native);
    sync.setAccount("owner-A");
    sync.updateState("libre", "remote-libre");
    await vi.waitFor(() => expect(native.applyState).toHaveBeenCalledTimes(1));
    sync.setForeground(false);
    expect(native.setActiveAccount).toHaveBeenLastCalledWith({
      accountId: null,
    });
    sync.updateState("reunion", "remote-reunion");
    sync.updateState("llamada", "remote-llamada");
    await settle();
    expect(native.applyState).toHaveBeenCalledTimes(1);
    sync.setForeground(true);
    await vi.waitFor(() => expect(native.applyState).toHaveBeenCalledTimes(2));
    expect(native.applyState).toHaveBeenLastCalledWith({
      accountId: "owner-A",
      stateKey: "llamada",
      revision: "remote-llamada",
    });
    sync.setForeground(false);
    sync.setForeground(true);
    await vi.waitFor(() => expect(native.applyState).toHaveBeenCalledTimes(3));
  });

  it("reapplies the current state after selected lights or colors change, ignoring other accounts", async () => {
    const native = bridge();
    const sync = new GoogleHomeSyncController(native);
    sync.setAccount("owner-A");
    sync.updateState("libre", "remote-libre");
    await vi.waitFor(() => expect(native.applyState).toHaveBeenCalledTimes(1));
    await sync.refreshConfiguration("owner-B");
    expect(native.getConfiguration).toHaveBeenCalledTimes(1);
    native.getConfiguration.mockResolvedValue(
      configuration(["desk-light"], "configuration-2"),
    );
    native.applyState.mockResolvedValue(success(["desk-light"]));
    await sync.refreshConfiguration("owner-A");
    await vi.waitFor(() => expect(native.applyState).toHaveBeenCalledTimes(2));
  });

  it("leaves unsupported custom and cleared statuses alone instead of switching every light off", async () => {
    const native = bridge();
    const sync = new GoogleHomeSyncController(native);
    sync.setAccount("owner-A");
    sync.updateState(null, "custom-lunch");
    await settle();
    expect(native.applyState).not.toHaveBeenCalled();
    sync.updateState("libre", "remote-libre");
    await vi.waitFor(() => expect(native.applyState).toHaveBeenCalledTimes(1));
    sync.updateState(null, "none");
    await settle();
    expect(native.applyState).toHaveBeenCalledTimes(1);
  });

  it.each([
    { results: [] },
    {
      results: [
        { id: "unselected-living-room", success: true, confirmed: true },
      ],
    },
  ])(
    "does not accept empty or unrelated results as selected-light success (%j)",
    async ({ results }) => {
      const native = bridge();
      const errors = vi.fn();
      native.applyState.mockResolvedValue({
        applied: true,
        skipped: false,
        results,
      });
      const sync = new GoogleHomeSyncController(native, errors);
      sync.setAccount("owner-A");
      sync.updateState("libre", "remote-libre");
      await vi.waitFor(() => expect(errors).toHaveBeenCalledTimes(1));
      sync.updateState("libre", "remote-libre");
      await settle();
      expect(native.applyState).toHaveBeenCalledTimes(1);
    },
  );
});

it("synchronizes any valid custom RGB color, deduplicates it and sends a changed color", async () => {
  const native = bridge();
  const sync = new GoogleHomeSyncController(native);
  sync.setAccount("owner-A");
  sync.updateState(null, "playing", "#12abef");
  await vi.waitFor(() => expect(native.applyState).toHaveBeenCalledTimes(1));
  expect(native.applyState).toHaveBeenLastCalledWith({
    accountId: "owner-A",
    stateKey: null,
    revision: "playing",
    customColor: "#12abef",
  });
  sync.updateState(null, "playing", "#12abef");
  await settle();
  expect(native.applyState).toHaveBeenCalledTimes(1);
  sync.updateState(null, "playing", "#fc3456");
  await vi.waitFor(() => expect(native.applyState).toHaveBeenCalledTimes(2));
  expect(native.applyState).toHaveBeenLastCalledWith(
    expect.objectContaining({ customColor: "#fc3456" }),
  );
  sync.updateState(null, "off");
  await settle();
  expect(native.applyState).toHaveBeenCalledTimes(2);
});

it("keeps preset colors configured by the user and rejects invalid custom colors", async () => {
  const native = bridge();
  const sync = new GoogleHomeSyncController(native);
  sync.setAccount("owner-A");
  sync.updateState(null, "invalid", "rgb(1,2,3)");
  await settle();
  expect(native.applyState).not.toHaveBeenCalled();
  sync.updateState("libre", "preset", "#123456");
  await vi.waitFor(() => expect(native.applyState).toHaveBeenCalledTimes(1));
  expect(native.applyState).toHaveBeenLastCalledWith({
    accountId: "owner-A",
    stateKey: "libre",
    revision: "preset",
  });
});

describe("Google Home automatic Deck while covered", () => {
  it("keeps the opted-in owner and selected-light synchronization during a call", async () => {
    const native = bridge();
    const sync = new GoogleHomeSyncController(native);
    sync.setAccount("owner-A");
    sync.setBackgroundEnabled(true);
    sync.updateState("libre", "before-call");
    await vi.waitFor(() => expect(native.applyState).toHaveBeenCalledTimes(1));
    sync.setForeground(false);
    sync.updateState("llamada", "automatic-call");
    await vi.waitFor(() => expect(native.applyState).toHaveBeenCalledTimes(2));
    expect(native.setActiveAccount).toHaveBeenLastCalledWith({
      accountId: "owner-A",
    });
    expect(native.setBackgroundSync).toHaveBeenLastCalledWith({
      accountId: "owner-A",
      enabled: true,
    });
    expect(native.applyState).toHaveBeenLastCalledWith({
      accountId: "owner-A",
      stateKey: "llamada",
      revision: "automatic-call",
    });
    sync.updateState("reunion", "automatic-meeting");
    await vi.waitFor(() => expect(native.applyState).toHaveBeenCalledTimes(3));
    sync.setAccount(null);
  });

  it("pauses again when the user disables the detector while covered", async () => {
    const native = bridge();
    const sync = new GoogleHomeSyncController(native);
    sync.setAccount("owner-A");
    sync.setBackgroundEnabled(true);
    sync.setForeground(false);
    sync.updateState("llamada", "call");
    await vi.waitFor(() => expect(native.applyState).toHaveBeenCalledTimes(1));
    sync.setBackgroundEnabled(false);
    sync.updateState("reunion", "meeting");
    await settle();
    expect(native.applyState).toHaveBeenCalledTimes(1);
    expect(native.setActiveAccount).toHaveBeenLastCalledWith({
      accountId: null,
    });
    sync.setForeground(true);
    await vi.waitFor(() => expect(native.applyState).toHaveBeenCalledTimes(2));
    expect(native.applyState).toHaveBeenLastCalledWith({
      accountId: "owner-A",
      stateKey: "reunion",
      revision: "meeting",
    });
    sync.setAccount(null);
  });

  it("does not carry background permission across VISO accounts", async () => {
    const native = bridge();
    const sync = new GoogleHomeSyncController(native);
    sync.setAccount("owner-A");
    sync.setBackgroundEnabled(true);
    sync.setForeground(false);
    sync.updateState("llamada", "A-call");
    await vi.waitFor(() => expect(native.applyState).toHaveBeenCalledTimes(1));
    sync.setAccount("owner-B");
    sync.updateState("reunion", "B-meeting");
    await settle();
    expect(native.applyState).toHaveBeenCalledTimes(1);
    expect(native.setActiveAccount).toHaveBeenLastCalledWith({
      accountId: null,
    });
    sync.setForeground(true);
    await vi.waitFor(() => expect(native.applyState).toHaveBeenCalledTimes(2));
    expect(native.setBackgroundSync).toHaveBeenLastCalledWith({
      accountId: "owner-B",
      enabled: false,
    });
    sync.setAccount(null);
  });

  it("does not lose a call when Convex repeats the identical snapshot before the SDK dispatch", async () => {
    const native = bridge();
    const sync = new GoogleHomeSyncController(native);
    sync.setAccount("owner-A");
    sync.updateState("libre", "initial");
    await vi.waitFor(() => expect(native.applyState).toHaveBeenCalledTimes(1));
    sync.updateState("llamada", "same-call");
    sync.updateState("llamada", "same-call");
    await vi.waitFor(() => expect(native.applyState).toHaveBeenCalledTimes(2));
    expect(native.applyState).toHaveBeenLastCalledWith({
      accountId: "owner-A",
      stateKey: "llamada",
      revision: "same-call",
    });
    sync.setAccount(null);
  });

  it("retries a transient lifecycle skip after checking permission again", async () => {
    vi.useFakeTimers();
    const native = bridge();
    const sync = new GoogleHomeSyncController(native);
    try {
      native.applyState.mockResolvedValueOnce({
        applied: false,
        skipped: true,
        reason: "application-inactive",
        results: [],
      });
      sync.setAccount("owner-A");
      sync.setBackgroundEnabled(true);
      sync.updateState("llamada", "call");
      await vi.advanceTimersByTimeAsync(0);
      expect(native.applyState).toHaveBeenCalledTimes(1);
      const reads = native.getStatus.mock.calls.length;
      await vi.advanceTimersByTimeAsync(1000);
      expect(native.getStatus.mock.calls.length).toBeGreaterThan(reads);
      expect(native.applyState).toHaveBeenCalledTimes(2);
      expect(native.applyState.mock.calls[0]).toEqual(
        native.applyState.mock.calls[1],
      );
    } finally {
      sync.setAccount(null);
      vi.useRealTimers();
    }
  });

  it("bounds retries and never repeats an old call after a newer meeting arrives", async () => {
    vi.useFakeTimers();
    const native = bridge();
    const sync = new GoogleHomeSyncController(native);
    try {
      native.applyState.mockResolvedValueOnce({
        applied: false,
        skipped: true,
        reason: "application-inactive",
        results: [],
      });
      sync.setAccount("owner-A");
      sync.setBackgroundEnabled(true);
      sync.updateState("llamada", "old-call");
      await vi.advanceTimersByTimeAsync(0);
      sync.updateState("reunion", "new-meeting");
      await vi.advanceTimersByTimeAsync(10000);
      expect(native.applyState).toHaveBeenCalledTimes(2);
      expect(native.applyState).toHaveBeenLastCalledWith({
        accountId: "owner-A",
        stateKey: "reunion",
        revision: "new-meeting",
      });
    } finally {
      sync.setAccount(null);
      vi.useRealTimers();
    }
  });

  it("stops after two retries instead of polling lights indefinitely", async () => {
    vi.useFakeTimers();
    const native = bridge();
    const sync = new GoogleHomeSyncController(native);
    try {
      native.applyState.mockResolvedValue({
        applied: false,
        skipped: true,
        reason: "application-inactive",
        results: [],
      });
      sync.setAccount("owner-A");
      sync.setBackgroundEnabled(true);
      sync.updateState("llamada", "call");
      await vi.advanceTimersByTimeAsync(10000);
      expect(native.applyState).toHaveBeenCalledTimes(3);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      sync.setAccount(null);
      vi.useRealTimers();
    }
  });

  it("cancels the retry on logout and stops when Google revokes permission", async () => {
    vi.useFakeTimers();
    const native = bridge();
    const sync = new GoogleHomeSyncController(native);
    try {
      native.applyState.mockResolvedValueOnce({
        applied: false,
        skipped: true,
        reason: "inactive-account",
        results: [],
      });
      sync.setAccount("owner-A");
      sync.setBackgroundEnabled(true);
      sync.updateState("llamada", "call");
      await vi.advanceTimersByTimeAsync(0);
      native.getStatus.mockResolvedValue({ ...connected, authorized: false });
      await vi.advanceTimersByTimeAsync(10000);
      expect(native.applyState).toHaveBeenCalledTimes(1);
      sync.setAccount(null);
      await vi.advanceTimersByTimeAsync(10000);
      expect(native.applyState).toHaveBeenCalledTimes(1);
    } finally {
      sync.setAccount(null);
      vi.useRealTimers();
    }
  });
});
