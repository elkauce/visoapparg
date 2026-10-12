import { expect, it, vi } from "vitest";
import type { GoogleHomeBridge } from "@/lib/google-home-native";
import { applyGoogleHomeKeyColor } from "./google-home-key";
import { GOOGLE_HOME_SELECTED_LIGHTS, runDeckAction } from "./action-runner";

const action = {
  type: "rgb",
  command: "color",
  deviceId: GOOGLE_HOME_SELECTED_LIGHTS,
  color: "#ffff00",
} as const;
function native() {
  const applyState = vi
    .fn()
    .mockResolvedValue({
      applied: true,
      results: [{ id: "chosen", success: true }],
    });
  return { applyState } as unknown as GoogleHomeBridge;
}
it("sends the free yellow color without activating any VISO status", async () => {
  const bridge = native();
  const setStatus = vi.fn();
  await runDeckAction(action, {
    openDisplay: vi.fn(),
    openUrl: vi.fn(),
    openApp: vi.fn(),
    media: vi.fn(),
    setStatus,
    selectPage: vi.fn(),
    rgb: (step) => applyGoogleHomeKeyColor(step, "owner", true, bridge),
  });
  expect(setStatus).not.toHaveBeenCalled();
  expect(bridge.applyState).toHaveBeenCalledWith({
    accountId: "owner",
    stateKey: null,
    customColor: "#ffff00",
    revision: expect.stringMatching(/^key:/),
  });
});
it("does not report success for missing selections or a failed light", async () => {
  const bridge = native();
  vi.mocked(bridge.applyState).mockResolvedValue({
    applied: false,
    skipped: true,
    results: [],
  });
  await expect(
    applyGoogleHomeKeyColor(action, "owner", true, bridge),
  ).rejects.toThrow("luces seleccionadas");
});
it("never sends a native command from the web or without a signed-in account", async () => {
  const bridge = native();
  await expect(
    applyGoogleHomeKeyColor(action, "owner", false, bridge),
  ).rejects.toThrow("Android");
  await expect(
    applyGoogleHomeKeyColor(action, null, true, bridge),
  ).rejects.toThrow("cuenta");
  expect(bridge.applyState).not.toHaveBeenCalled();
});
