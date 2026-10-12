import { act, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import DeckAwake from "./deck-awake";

const fixture = vi.hoisted(() => ({ android: true, setKeepScreenOn: vi.fn() }));
vi.mock("@capacitor/core", () => ({
  registerPlugin: () => ({ setKeepScreenOn: fixture.setKeepScreenOn }),
}));
vi.mock("@/lib/android-native", () => ({
  isAndroidNative: () => fixture.android,
}));
beforeEach(() => {
  fixture.android = true;
  fixture.setKeepScreenOn.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "wakeLock");
});

it.each(["/deck", "/android/display", "/s/real-display"])(
  "keeps Android awake only while %s is mounted",
  async (path) => {
    const view = render(
      <MemoryRouter initialEntries={[path]}>
        <DeckAwake />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(fixture.setKeepScreenOn).toHaveBeenCalledWith({ enabled: true }),
    );
    view.unmount();
    expect(fixture.setKeepScreenOn).toHaveBeenLastCalledWith({
      enabled: false,
    });
  },
);

it("does not keep the home/settings screens awake", () => {
  render(
    <MemoryRouter initialEntries={["/android/settings"]}>
      <DeckAwake />
    </MemoryRouter>,
  );
  expect(fixture.setKeepScreenOn).not.toHaveBeenCalled();
});

it("releases a browser lock which resolves after leaving Deck", async () => {
  fixture.android = false;
  let resolve!: (lock: WakeLockSentinel) => void;
  const release = vi.fn().mockResolvedValue(undefined);
  const request = vi.fn(
    () =>
      new Promise<WakeLockSentinel>((done) => {
        resolve = done;
      }),
  );
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    get: () => ({ request }),
  });
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  const view = render(
    <MemoryRouter initialEntries={["/deck"]}>
      <DeckAwake />
    </MemoryRouter>,
  );
  await waitFor(() => expect(request).toHaveBeenCalledWith("screen"));
  view.unmount();
  await act(async () => resolve({ release } as unknown as WakeLockSentinel));
  expect(release).toHaveBeenCalledTimes(1);
});
