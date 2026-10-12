import { describe, expect, it, vi } from "vitest";
import { PresenceController, type PresenceMode } from "./presence-controller";

const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function setup() {
  const transition = vi.fn(
    async (mode: PresenceMode, previous: string | null, revision: number) => ({
      applied: true,
      statusId: mode ?? previous,
      revision: revision + 1,
    }),
  );
  const persist = vi.fn();
  const report = vi.fn();
  const controller = new PresenceController(transition, persist, report);
  return { controller, transition, persist, report };
}
describe("automatic presence ownership", () => {
  it("prioritizes a call, resumes the meeting and restores the original state", async () => {
    const { controller, transition } = setup();
    controller.update({ statusId: "free", revision: 0, mode: "meeting" });
    await settle();
    controller.update({ statusId: "meeting", revision: 1, mode: "call" });
    await settle();
    controller.update({ statusId: "call", revision: 2, mode: "meeting" });
    await settle();
    controller.update({ statusId: "meeting", revision: 3, mode: null });
    await settle();
    expect(
      transition.mock.calls.map(([mode, previous]) => [mode, previous]),
    ).toEqual([
      ["meeting", "free"],
      ["call", "free"],
      ["meeting", "free"],
      [null, "free"],
    ]);
  });
  it("respects manual selection even when its state ID matches the automatic state", async () => {
    const { controller, transition } = setup();
    controller.update({ statusId: "free", revision: 0, mode: "call" });
    await settle();
    controller.update({ statusId: "call", revision: 2, mode: "call" });
    await settle();
    controller.update({ statusId: "call", revision: 2, mode: null });
    await settle();
    expect(transition).toHaveBeenCalledTimes(1);
  });
  it("does not repeat a confirmed signal", async () => {
    const { controller, transition } = setup();
    controller.update({ statusId: "free", revision: 0, mode: "call" });
    await settle();
    controller.update({ statusId: "call", revision: 1, mode: "call" });
    await settle();
    expect(transition).toHaveBeenCalledTimes(1);
  });
  it("reuses the receipt key after a lost response instead of duplicating a change", async () => {
    const { controller, transition, report } = setup();
    transition.mockRejectedValueOnce(new Error("lost response"));
    controller.update({ statusId: "free", revision: 0, mode: "call" });
    await settle();
    controller.update({ statusId: "call", revision: 1, mode: "call" });
    await settle();
    expect(report).toHaveBeenCalledTimes(1);
    expect(transition.mock.calls[0]).toEqual(transition.mock.calls[1]);
  });
  it("recovers an owned state after reopening and restores its previous state", async () => {
    const transition = vi.fn(
      async (
        _mode: PresenceMode,
        previous: string | null,
        revision: number,
      ) => ({ applied: true, statusId: previous, revision: revision + 1 }),
    );
    const controller = new PresenceController(transition, vi.fn(), vi.fn(), {
      previous: "free",
      statusId: "call",
      revision: 1,
      mode: "call",
    });
    controller.update({ statusId: "call", revision: 1, mode: null });
    await settle();
    expect(transition).toHaveBeenCalledWith(
      null,
      "free",
      1,
      expect.any(String),
    );
  });
  it("does not restore a recovered state after another device changed it", async () => {
    const transition = vi.fn();
    const controller = new PresenceController(transition, vi.fn(), vi.fn(), {
      previous: "free",
      statusId: "call",
      revision: 1,
      mode: "call",
    });
    controller.update({ statusId: "personal", revision: 2, mode: null });
    await settle();
    expect(transition).not.toHaveBeenCalled();
  });
  it("waits for a fresh signal instead of looping when a source cancels an action", async () => {
    const transition = vi.fn(async () => ({
      applied: false,
      cancelled: true,
      statusId: "free",
      revision: 0,
    }));
    const controller = new PresenceController(transition, vi.fn(), vi.fn());
    controller.update({ statusId: "free", revision: 0, mode: "call" });
    await settle();
    expect(transition).toHaveBeenCalledTimes(1);
    controller.update({ statusId: "free", revision: 0, mode: null });
    await settle();
    expect(transition).toHaveBeenCalledTimes(1);
  });
  it("suppresses retries when the server reports a manual revision conflict", async () => {
    const transition = vi.fn(async () => ({
      applied: false,
      statusId: "personal",
      revision: 2,
    }));
    const controller = new PresenceController(transition, vi.fn(), vi.fn());
    controller.update({ statusId: "free", revision: 0, mode: "call" });
    await settle();
    controller.update({ statusId: "personal", revision: 2, mode: "meeting" });
    await settle();
    controller.update({ statusId: "personal", revision: 2, mode: null });
    await settle();
    expect(transition).toHaveBeenCalledTimes(1);
  });
});
