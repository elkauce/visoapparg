import { describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { runDeckAction, type DeckActionServices } from "./action-runner.ts";

function services(): DeckActionServices {
  return {
    openDisplay: vi.fn(async () => undefined),
    openUrl: vi.fn(async () => undefined),
    openApp: vi.fn(async () => undefined),
    media: vi.fn(async () => undefined),
    setStatus: vi.fn(async () => undefined),
    selectPage: vi.fn(async () => undefined),
  };
}

describe("Deck actions", () => {
  it("waits for server acknowledgement before running the next automation step", async () => {
    let acknowledge!: () => void;
    const dependencies = services();
    vi.mocked(dependencies.setStatus).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          acknowledge = resolve;
        }),
    );
    const pending = runDeckAction(
      {
        type: "automation",
        steps: [
          { type: "status", statusId: "status1" as Id<"statuses"> },
          { type: "media", command: "next" },
        ],
      },
      dependencies,
    );
    expect(dependencies.media).not.toHaveBeenCalled();
    acknowledge();
    await pending;
    expect(dependencies.media).toHaveBeenCalledWith("next");
  });

  it("stops an automation after an actual failure and reports which step failed", async () => {
    const dependencies = services();
    vi.mocked(dependencies.openApp).mockRejectedValue(
      new Error("Aplicación no instalada"),
    );
    await expect(
      runDeckAction(
        {
          type: "automation",
          steps: [
            { type: "url", url: "https://visoapparg.vercel.app" },
            { type: "android-app", packageName: "com.example.missing" },
            { type: "media", command: "play-pause" },
          ],
        },
        dependencies,
      ),
    ).rejects.toThrow("paso 2: Aplicación no instalada");
    expect(dependencies.openUrl).toHaveBeenCalledOnce();
    expect(dependencies.media).not.toHaveBeenCalled();
  });

  it("reports unavailable RGB without claiming success", async () => {
    const dependencies = services();
    await expect(
      runDeckAction(
        { type: "rgb", command: "power", deviceId: "lamp", on: true },
        dependencies,
      ),
    ).rejects.toThrow("Control RGB no disponible");
    expect(dependencies.setStatus).not.toHaveBeenCalled();
  });
});
