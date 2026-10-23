import { describe, expect, it } from "vitest";
import {
  createTurnCredentials,
  hashCapability,
  randomCapability,
  turnConfiguration,
  validateSignal,
  withinTimbreSchedule,
} from "./timbre_rtc";

describe("Timbre RTC configuration", () => {
  it("fails closed without complete trusted TURN configuration", () => {
    expect(turnConfiguration({})).toBeNull();
    expect(
      turnConfiguration({
        TIMBRE_TURN_URLS: "stun:public.example.com",
        TIMBRE_TURN_SECRET: "a".repeat(32),
      }),
    ).toBeNull();
    expect(
      turnConfiguration({
        TIMBRE_TURN_URLS: "turn:user:password@host",
        TIMBRE_TURN_SECRET: "a".repeat(32),
      }),
    ).toBeNull();
    expect(
      turnConfiguration({
        TIMBRE_TURN_URLS: "turn:relay.example.org:3478",
        TIMBRE_TURN_SECRET: "short",
      }),
    ).toBeNull();
    expect(
      turnConfiguration({
        TIMBRE_TURN_URLS:
          '["turn:relay.example.org:3478?transport=udp","turns:relay.example.org:5349?transport=tcp"]',
        TIMBRE_TURN_SECRET: "a".repeat(32),
      }),
    ).toMatchObject({ urls: expect.any(Array) });
  });
  it("issues short-lived participant-scoped credentials, never the shared secret", async () => {
    const secret = "my-coturn-secret-long-enough-for-tests";
    const config = await createTurnCredentials(
      { urls: ["turns:relay.example.org:5349"], secret },
      "opaque-call:visitor",
      1_000_000,
    );
    expect(config.expiresAt).toBe(1_300_000);
    expect(config.iceTransportPolicy).toBe("relay");
    expect(config.iceServers[0].username).toBe("1300:opaque-call:visitor");
    expect(config.iceServers[0].credential).toMatch(/^[a-zA-Z0-9+/]+=*$/);
    expect(JSON.stringify(config)).not.toContain(secret);
    expect(
      (
        await createTurnCredentials(
          { urls: [], secret },
          "opaque-call:owner",
          1_000_000,
        )
      ).iceServers[0].credential,
    ).not.toBe(config.iceServers[0].credential);
  });
  it("creates 256-bit capabilities and stores only their digest", async () => {
    const first = randomCapability(),
      second = randomCapability();
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).not.toBe(first);
    expect(await hashCapability(first)).not.toBe(first);
    expect(await hashCapability(first)).toBe(await hashCapability(first));
  });
  it("signs credentials through the authorized twenty-minute call and grace", async () => {
    const now = 1_000_000;
    const secret = "my-coturn-secret-long-enough-for-tests";
    const result = await createTurnCredentials(
      { urls: ["turns:relay.example.org:5349"], secret },
      "opaque-call:visitor",
      now,
      now + 20 * 60_000,
    );
    expect(result.expiresAt).toBe(now + 21 * 60_000);
    expect(result.expiresAt).toBeGreaterThan(now + 5 * 60_000);
    const server = result.iceServers[0];
    expect(server.username).toBe("2260:opaque-call:visitor");
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["verify"],
    );
    expect(
      await crypto.subtle.verify(
        "HMAC",
        key,
        Uint8Array.from(atob(server.credential), (character) =>
          character.charCodeAt(0),
        ),
        new TextEncoder().encode(server.username),
      ),
    ).toBe(true);
  });
  it("caps an oversized deadline and preserves a shorter authorized deadline", async () => {
    const config = {
      urls: [],
      secret: "test-secret-with-at-least-32-characters",
    };
    const now = 1_000_999;
    const oversized = await createTurnCredentials(
      config,
      "opaque-call:owner",
      now,
      now + 365 * 24 * 60 * 60_000,
    );
    expect(oversized.expiresAt).toBe(2_260_000);
    expect(oversized.expiresAt).toBeLessThanOrEqual(now + 21 * 60_000);
    const shorter = await createTurnCredentials(
      config,
      "opaque-call:owner",
      now,
      now + 40_000,
    );
    expect(shorter.expiresAt).toBe(1_100_000);
    expect(shorter.iceServers[0].username).toBe("1100:opaque-call:owner");
    await expect(
      createTurnCredentials(config, "opaque-call:owner", now, Number.NaN),
    ).rejects.toThrow(/inválida/);
  });
});

describe("Timbre signaling boundaries", () => {
  it("validates browser descriptions and candidates", () => {
    expect(() =>
      validateSignal(
        "offer",
        JSON.stringify({
          type: "offer",
          sdp: "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n",
        }),
      ),
    ).not.toThrow();
    expect(() =>
      validateSignal(
        "ice",
        JSON.stringify({
          candidate: "candidate:1 1 udp 1234 192.0.2.1 123 typ relay",
          sdpMid: "0",
          sdpMLineIndex: 0,
          usernameFragment: "abc",
        }),
      ),
    ).not.toThrow();
    expect(() => validateSignal("ice", "null")).not.toThrow();
    expect(() =>
      validateSignal("ice", JSON.stringify({ candidate: "" })),
    ).not.toThrow();
  });
  it("rejects mismatched, arbitrary, oversized or malformed data", () => {
    for (const payload of [
      "no json",
      "[]",
      "{}",
      JSON.stringify({ type: "answer", sdp: "v=0\r\nm=audio 9 X 1" }),
      "x".repeat(65_537),
    ])
      expect(() => validateSignal("offer", payload)).toThrow();
    for (const payload of [
      "[]",
      "{}",
      JSON.stringify({ candidate: "candidate:ok", arbitrarySecret: "bad" }),
      JSON.stringify({ candidate: "candidate:ok", sdpMLineIndex: -1 }),
      JSON.stringify({ candidate: "https://example.org" }),
    ])
      expect(() => validateSignal("ice", payload)).toThrow();
  });
});

it("checks the resident local schedule including overnight intervals", () => {
  const tuesday = Date.parse("2026-10-20T13:00:00Z");
  expect(
    withinTimbreSchedule([], "America/Argentina/Buenos_Aires", tuesday),
  ).toBe(true);
  expect(
    withinTimbreSchedule(
      [{ day: 2, start: "09:00", end: "11:00" }],
      "America/Argentina/Buenos_Aires",
      tuesday,
    ),
  ).toBe(true);
  expect(
    withinTimbreSchedule(
      [{ day: 2, start: "11:00", end: "12:00" }],
      "America/Argentina/Buenos_Aires",
      tuesday,
    ),
  ).toBe(false);
  expect(
    withinTimbreSchedule(
      [{ day: 1, start: "22:00", end: "02:00" }],
      "UTC",
      Date.parse("2026-10-20T01:00:00Z"),
    ),
  ).toBe(true);
});
