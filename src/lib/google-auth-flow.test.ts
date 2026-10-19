import { beforeEach, describe, expect, it } from "vitest";
import {
  beginGoogleAuthAttempt,
  clearGoogleAuthAttempt,
  isGoogleAuthAttemptCurrent,
  readGoogleAuthAttempt,
  shouldHandleGoogleAuthCode,
} from "./google-auth-flow";

beforeEach(() => {
  sessionStorage.clear();
  history.replaceState(null, "", "/");
});

describe("Google auth return routing", () => {
  it.each(["signin", "link"] as const)(
    "defers only owned %s returns until hydration",
    (mode) => {
      beginGoogleAuthAttempt(mode);
      history.replaceState(null, "", "/?google=return&code=opaque");
      expect(shouldHandleGoogleAuthCode()).toBe(false);
      expect(readGoogleAuthAttempt()?.mode).toBe(mode);
      clearGoogleAuthAttempt();
      expect(shouldHandleGoogleAuthCode()).toBe(true);
    },
  );

  it("ignores malformed local state and validates attempt age", () => {
    sessionStorage.setItem(
      "viso:google-auth-attempt",
      '{"mode":"other","startedAt":1}',
    );
    history.replaceState(null, "", "/?google=return&code=opaque");
    expect(shouldHandleGoogleAuthCode()).toBe(true);
    expect(
      isGoogleAuthAttemptCurrent({
        mode: "signin",
        startedAt: Date.now() - 11 * 60_000,
      }),
    ).toBe(false);
    expect(
      isGoogleAuthAttemptCurrent({
        mode: "link",
        startedAt: Date.now() + 120_000,
      }),
    ).toBe(false);
  });
});
