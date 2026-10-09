import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AndroidMediaState } from "@/lib/android-native.ts";
import { useAndroidMedia } from "./use-android-media.ts";

const native = vi.hoisted(() => ({
  android: true,
  read: vi.fn(),
  command: vi.fn(),
  request: vi.fn(),
  remove: vi.fn(),
  appListener: null as null | ((state: { isActive: boolean }) => void),
}));

vi.mock("@/lib/android-native.ts", () => ({
  isAndroidNative: () => native.android,
  nativeDeck: {
    getMediaState: native.read,
    requestMediaAccess: native.request,
  },
  actions: { media: native.command },
}));
vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn(async (_event, callback) => {
      native.appListener = callback;
      return { remove: native.remove };
    }),
  },
}));

const spotify: AndroidMediaState = {
  permissionGranted: true,
  available: true,
  packageName: "com.spotify.music",
  sourceName: "Spotify",
  title: "Canción de prueba",
  artist: "Artista de prueba",
  album: null,
  artwork: null,
  state: "playing",
  positionMs: 1000,
  durationMs: 180_000,
  canPlayPause: true,
  canNext: true,
  canPrevious: false,
};

async function settle() {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
  });
}

describe("Android media screen lifecycle", () => {
  let hidden = false;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    native.android = true;
    native.appListener = null;
    hidden = false;
    vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
    native.read.mockResolvedValue(spotify);
    native.command.mockResolvedValue(undefined);
    native.request.mockResolvedValue(undefined);
    native.remove.mockResolvedValue(undefined);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("reads Spotify strictly and sends supported commands to that same source", async () => {
    const { result } = renderHook(() =>
      useAndroidMedia(true, "com.spotify.music"),
    );
    await settle();
    expect(native.read).toHaveBeenCalledWith({
      packageName: "com.spotify.music",
    });
    await act(() => result.current.command("next"));
    expect(native.command).toHaveBeenCalledWith("next", "com.spotify.music");
    await act(() => result.current.command("previous"));
    expect(native.command).toHaveBeenCalledTimes(1);
    expect(result.current.error).toMatch(/no permite/);
  });

  it("does not read or imitate Android sessions in web or inactive screens", async () => {
    native.android = false;
    const web = renderHook(() => useAndroidMedia(true));
    await settle();
    await act(async () => vi.advanceTimersByTime(5000));
    expect(web.result.current.media).toBeNull();
    expect(web.result.current.loading).toBe(false);
    expect(native.read).not.toHaveBeenCalled();
    web.unmount();
    native.android = true;
    const inactive = renderHook(() => useAndroidMedia(false));
    await settle();
    await act(async () => vi.advanceTimersByTime(5000));
    expect(inactive.result.current.media).toBeNull();
    expect(native.read).not.toHaveBeenCalled();
  });

  it("suspends polling when hidden or backgrounded and removes native listeners", async () => {
    const hook = renderHook(() => useAndroidMedia(true));
    await settle();
    expect(native.read).toHaveBeenCalledTimes(1);
    hidden = true;
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => vi.advanceTimersByTime(5000));
    expect(native.read).toHaveBeenCalledTimes(1);
    hidden = false;
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await settle();
    expect(native.read).toHaveBeenCalledTimes(2);
    act(() => native.appListener?.({ isActive: false }));
    await act(async () => vi.advanceTimersByTime(5000));
    expect(native.read).toHaveBeenCalledTimes(2);
    act(() => native.appListener?.({ isActive: true }));
    await settle();
    expect(native.read).toHaveBeenCalledTimes(3);
    hook.unmount();
    await settle();
    expect(native.remove).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("discards a late Spotify result after the requested source changes", async () => {
    let resolveOld!: (media: AndroidMediaState) => void;
    const old = new Promise<AndroidMediaState>((resolve) => {
      resolveOld = resolve;
    });
    const other = {
      ...spotify,
      packageName: "com.example.player",
      sourceName: "Otro reproductor",
    };
    native.read.mockImplementation((options) =>
      options?.packageName === "com.spotify.music"
        ? old
        : Promise.resolve(other),
    );
    const hook = renderHook(({ source }) => useAndroidMedia(true, source), {
      initialProps: { source: "com.spotify.music" },
    });
    await settle();
    hook.rerender({ source: "com.example.player" });
    await settle();
    expect(hook.result.current.media?.packageName).toBe("com.example.player");
    resolveOld(spotify);
    await settle();
    expect(hook.result.current.media?.packageName).toBe("com.example.player");
    await act(() => hook.result.current.command("next"));
    expect(native.command).toHaveBeenCalledWith("next", "com.example.player");
  });

  it("clears stale availability when the read fails and rereads on returning from settings", async () => {
    native.read
      .mockResolvedValueOnce(spotify)
      .mockRejectedValueOnce(new Error("Acceso multimedia revocado"));
    const hook = renderHook(() => useAndroidMedia(true, "com.spotify.music"));
    await settle();
    expect(hook.result.current.media?.available).toBe(true);
    await act(async () => vi.advanceTimersByTime(1000));
    await settle();
    expect(hook.result.current.media).toBeNull();
    expect(hook.result.current.error).toMatch(/revocado/);
    native.read.mockResolvedValue({
      ...spotify,
      permissionGranted: false,
      available: false,
    });
    act(() => window.dispatchEvent(new Event("focus")));
    await settle();
    expect(hook.result.current.media?.permissionGranted).toBe(false);
    await act(() => hook.result.current.requestAccess());
    expect(native.request).toHaveBeenCalledTimes(1);
    expect(hook.result.current.media?.permissionGranted).toBe(false);
    await act(() => hook.result.current.command("next"));
    expect(native.command).not.toHaveBeenCalled();
  });

  it("does not substitute another player if the Spotify command loses its session", async () => {
    const hook = renderHook(() => useAndroidMedia(true, "com.spotify.music"));
    await settle();
    native.command.mockRejectedValue(
      new Error("La sesión ya no está disponible"),
    );
    native.read.mockResolvedValue({
      ...spotify,
      available: false,
      packageName: null,
    });
    await act(() => hook.result.current.command("play-pause"));
    expect(native.command).toHaveBeenCalledTimes(1);
    expect(native.command).toHaveBeenCalledWith(
      "play-pause",
      "com.spotify.music",
    );
    expect(hook.result.current.media?.available).toBe(false);
    expect(hook.result.current.error).toMatch(/ya no está disponible/);
  });
});
