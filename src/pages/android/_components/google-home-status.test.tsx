import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GoogleHomeStatus } from "@/lib/google-home-native.ts";
import { useGoogleHomeStatus } from "./google-home-status.ts";

const native = vi.hoisted(() => ({ getStatus: vi.fn(), addListener: vi.fn() }));
vi.mock("@/lib/android-native.ts", () => ({ isAndroidNative: () => true }));
vi.mock("@capacitor/app", () => ({ App: { addListener: native.addListener } }));
vi.mock("@/lib/google-home-native.ts", () => ({
  GOOGLE_HOME_CONFIGURATION_EVENT: "viso:google-home-configuration",
  googleHomeNative: { getStatus: native.getStatus },
}));

const connected: GoogleHomeStatus = {
  sdkPresent: true,
  available: true,
  status: "connected",
  authorized: true,
  configured: true,
  selectedCount: 1,
  message: "Autorizado",
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  vi.clearAllMocks();
  native.getStatus.mockResolvedValue(connected);
  native.addListener.mockResolvedValue({ remove: vi.fn() });
});

describe("Google Home integration status", () => {
  it("coalesces resume events and does not show a stale connection after a failed read", async () => {
    const { result } = renderHook(() => useGoogleHomeStatus("owner-A"));
    await waitFor(() => expect(result.current.label).toBe("Activa · 1 luz"));
    native.getStatus.mockRejectedValueOnce(
      new Error("temporary network failure"),
    );
    act(() => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() =>
      expect(result.current.label).toBe("Conexión por comprobar"),
    );
    expect(native.getStatus).toHaveBeenCalledTimes(2);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(result.current.label).toBe("Activa · 1 luz"));
  });

  it("ignores the previous account's late response and removes late native listeners", async () => {
    const statusA = deferred<GoogleHomeStatus>();
    const listenerA = deferred<{ remove(): Promise<void> }>();
    const removeA = vi.fn().mockResolvedValue(undefined);
    native.getStatus.mockReturnValueOnce(statusA.promise);
    native.addListener.mockReturnValueOnce(listenerA.promise);
    const { result, rerender } = renderHook(
      ({ accountId }) => useGoogleHomeStatus(accountId),
      {
        initialProps: { accountId: "owner-A" },
      },
    );
    await waitFor(() => expect(native.getStatus).toHaveBeenCalledTimes(1));
    native.getStatus.mockResolvedValueOnce({
      ...connected,
      authorized: false,
      status: "pending",
      configured: false,
      requiresAuthorization: true,
    });
    rerender({ accountId: "owner-B" });
    await waitFor(() =>
      expect(result.current.label).toBe("Autorización pendiente"),
    );
    await act(async () => {
      listenerA.resolve({ remove: removeA });
      statusA.resolve(connected);
    });
    expect(result.current.label).toBe("Autorización pendiente");
    expect(removeA).toHaveBeenCalledTimes(1);
  });

  it("refreshes only configuration events for the active account", async () => {
    const { result } = renderHook(() => useGoogleHomeStatus("owner-A"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      window.dispatchEvent(
        new CustomEvent("viso:google-home-configuration", {
          detail: { accountId: "owner-B" },
        }),
      );
    });
    expect(native.getStatus).toHaveBeenCalledTimes(1);
    native.getStatus.mockResolvedValueOnce({
      ...connected,
      configured: false,
      selectedCount: 0,
    });
    act(() => {
      window.dispatchEvent(
        new CustomEvent("viso:google-home-configuration", {
          detail: { accountId: "owner-A" },
        }),
      );
    });
    await waitFor(() =>
      expect(result.current.label).toBe("Autorizado · elegí tus luces"),
    );
  });
});
