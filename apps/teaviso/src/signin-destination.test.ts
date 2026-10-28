import { beforeEach, expect, it, vi } from "vitest";
import {
  consumeSignInDestination,
  rememberSignInDestination,
  signInDestination,
} from "./signin-destination";
beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});
it("keeps the chosen service or sign and its space while dropping unknown redirect fields", () => {
  expect(
    signInDestination(
      "/panel/plan",
      "?interes=negocios&redirect=https://other.example&google=return",
    ),
  ).toBe("/panel/plan?interes=negocios");
  rememberSignInDestination("/panel/carteles/professional", "?space=abc123");
  expect(consumeSignInDestination()).toBe(
    "/panel/carteles/professional?space=abc123",
  );
  expect(consumeSignInDestination()).toBeNull();
});
it("does not restore external, altered or expired return routes", () => {
  expect(signInDestination("//other.example", "")).toBe("/panel");
  sessionStorage.setItem(
    "teaviso:signin-destination",
    JSON.stringify({ path: "https://other.example/panel", at: Date.now() }),
  );
  expect(consumeSignInDestination()).toBeNull();
  rememberSignInDestination("/panel", "");
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 11 * 60_000);
  expect(consumeSignInDestination()).toBeNull();
});
