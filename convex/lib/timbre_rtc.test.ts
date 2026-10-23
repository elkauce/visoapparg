import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTurnCredentials,
  createCloudflareTurnCredentials,
  hashCapability,
  randomCapability,
  turnConfiguration,
  timbreTurnProviderConfiguration,
  TIMBRE_CLOUDFLARE_TIMEOUT_MS,
  validateSignal,
  withinTimbreSchedule,
} from "./timbre_rtc";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const cloudflareConfig = {
  provider: "cloudflare" as const,
  keyId: "local-test-turn-key",
  apiToken: "server-only-api-token-test-123456789",
};
function cloudflareResponse() {
  // Shape documented by Cloudflare generate-ice-servers (201 Created).
  return {
    iceServers: [
      { urls: ["stun:stun.cloudflare.com:3478"] },
      {
        urls: [
          "turn:turn.cloudflare.com:3478?transport=udp",
          "turn:turn.cloudflare.com:443?transport=udp",
          "turn:turn.cloudflare.com:3478?transport=tcp",
          "turn:turn.cloudflare.com:80?transport=tcp",
          "turns:turn.cloudflare.com:5349?transport=tcp",
          "turns:turn.cloudflare.com:443?transport=tcp",
        ],
        username: "opaque-short-lived-user",
        credential: "opaque-short-lived-password",
      },
    ],
  };
}

describe("Cloudflare managed TURN", () => {
  it("requires explicit complete configuration without falling back to coturn", () => {
    const coturn = {
      TIMBRE_TURN_URLS: "turn:relay.example.org:3478",
      TIMBRE_TURN_SECRET: "a".repeat(32),
    };
    expect(timbreTurnProviderConfiguration(coturn)).toMatchObject({
      provider: "coturn",
    });
    expect(
      timbreTurnProviderConfiguration({
        ...coturn,
        TIMBRE_TURN_PROVIDER: "unknown",
      }),
    ).toBeNull();
    expect(
      timbreTurnProviderConfiguration({
        ...coturn,
        TIMBRE_TURN_PROVIDER: "cloudflare",
      }),
    ).toBeNull();
    expect(
      timbreTurnProviderConfiguration({
        TIMBRE_TURN_PROVIDER: "cloudflare",
        TIMBRE_CLOUDFLARE_TURN_KEY_ID: cloudflareConfig.keyId,
        TIMBRE_CLOUDFLARE_TURN_API_TOKEN: cloudflareConfig.apiToken,
      }),
    ).toEqual(cloudflareConfig);
    expect(
      timbreTurnProviderConfiguration({
        TIMBRE_TURN_PROVIDER: "cloudflare",
        TIMBRE_CLOUDFLARE_TURN_KEY_ID: "../../bad?query",
        TIMBRE_CLOUDFLARE_TURN_API_TOKEN: cloudflareConfig.apiToken,
      }),
    ).toBeNull();
    expect(
      timbreTurnProviderConfiguration({
        TIMBRE_TURN_PROVIDER: "cloudflare",
        TIMBRE_CLOUDFLARE_TURN_KEY_ID: cloudflareConfig.keyId,
        TIMBRE_CLOUDFLARE_TURN_API_TOKEN: "token\r\nheader: injected",
      }),
    ).toBeNull();
  });
  it("uses the documented fixed API and returns only short-lived Cloudflare relays", async () => {
    const response = cloudflareResponse();
    response.iceServers[1].urls.push(
      "turn:turn.cloudflare.com:53?transport=udp",
    );
    const request = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(response), { status: 201 }),
      );
    vi.stubGlobal("fetch", request);
    const now = 1_000_000;
    const result = await createCloudflareTurnCredentials(
      cloudflareConfig,
      now,
      now + 20 * 60_000,
    );
    expect(request).toHaveBeenCalledWith(
      "https://rtc.live.cloudflare.com/v1/turn/keys/local-test-turn-key/credentials/generate-ice-servers",
      expect.objectContaining({
        method: "POST",
        redirect: "error",
        headers: {
          authorization: `Bearer ${cloudflareConfig.apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ ttl: 1255 }),
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result.iceTransportPolicy).toBe("relay");
    expect(result.iceServers).toHaveLength(1);
    expect(result.iceServers[0].urls).toHaveLength(6);
    expect(JSON.stringify(result)).not.toMatch(
      /stun:|:53\?|server-only-api-token|local-test-turn-key/,
    );
    expect(result.expiresAt).toBe(now + 1_255_000);
    expect(result.expiresAt).toBeGreaterThan(now + 20 * 60_000);
  });
  it("bounds TTL by the authorized deadline and clamps oversized deadlines", async () => {
    const request = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(cloudflareResponse()), { status: 201 }),
        ),
      );
    vi.stubGlobal("fetch", request);
    const now = 1_000_999;
    const shorter = await createCloudflareTurnCredentials(
      cloudflareConfig,
      now,
      now + 40_000,
    );
    expect(JSON.parse(request.mock.calls[0][1].body).ttl).toBe(94);
    expect(shorter.expiresAt).toBeLessThanOrEqual(now + 40_000 + 60_000);
    await createCloudflareTurnCredentials(
      cloudflareConfig,
      now,
      now + 365 * 24 * 60 * 60_000,
    );
    expect(JSON.parse(request.mock.calls[1][1].body).ttl).toBeLessThanOrEqual(
      1260,
    );
  });
  it("rejects malicious hosts, ports, missing relays and leaked server secrets", async () => {
    const invalid = [
      {
        urls: ["turn:turn.cloudflare.com.evil.test:3478?transport=udp"],
        username: "a",
        credential: "b",
      },
      {
        urls: ["turn:attacker@turn.cloudflare.com:3478?transport=udp"],
        username: "a",
        credential: "b",
      },
      {
        urls: ["turn:127.0.0.1:3478?transport=udp"],
        username: "a",
        credential: "b",
      },
      {
        urls: ["turn:turn.cloudflare.com:9999?transport=udp"],
        username: "a",
        credential: "b",
      },
      { urls: ["turn:turn.cloudflare.com:3478?transport=udp"], username: "a" },
      { urls: ["stun:stun.cloudflare.com:3478"] },
      {
        urls: ["turn:turn.cloudflare.com:53?transport=udp"],
        username: "a",
        credential: "b",
      },
      {
        urls: ["turn:turn.cloudflare.com:3478?transport=udp"],
        username: "a",
        credential: cloudflareConfig.apiToken,
      },
      {
        urls: ["turn:turn.cloudflare.com:3478?transport=udp"],
        username: "a\u0000",
        credential: "b",
      },
    ];
    for (const server of invalid) {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ iceServers: [server] }), {
            status: 201,
          }),
        ),
      );
      await expect(
        createCloudflareTurnCredentials(cloudflareConfig, 1_000_000, 2_200_000),
      ).rejects.toThrow(/^TIMBRE_TURN_UNAVAILABLE$/);
    }
  });
  it("does not expose provider error bodies, redirects or oversized responses", async () => {
    for (const response of [
      new Response(`private provider error ${cloudflareConfig.apiToken}`, {
        status: 401,
      }),
      new Response("", {
        status: 302,
        headers: { location: "https://evil.test" },
      }),
      new Response("x".repeat(65_537), { status: 201 }),
      new Response("not-json", { status: 201 }),
    ]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
      await expect(
        createCloudflareTurnCredentials(cloudflareConfig, 1_000_000, 2_200_000),
      ).rejects.toThrow(/^TIMBRE_TURN_UNAVAILABLE$/);
    }
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValue(new Error(`network ${cloudflareConfig.apiToken}`)),
    );
    await expect(
      createCloudflareTurnCredentials(cloudflareConfig, 1_000_000, 2_200_000),
    ).rejects.toThrow(/^TIMBRE_TURN_UNAVAILABLE$/);
  });
  it("aborts a slow credential request after the bounded timeout", async () => {
    vi.useFakeTimers();
    const request = vi.fn(
      (_url, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener(
            "abort",
            () => reject(new Error("provider request aborted")),
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", request);
    const pending = createCloudflareTurnCredentials(
      cloudflareConfig,
      1_000_000,
      2_200_000,
    );
    const rejected = expect(pending).rejects.toThrow(
      /^TIMBRE_TURN_UNAVAILABLE$/,
    );
    await vi.advanceTimersByTimeAsync(TIMBRE_CLOUDFLARE_TIMEOUT_MS);
    await rejected;
    expect(request.mock.calls[0][1].signal!.aborted).toBe(true);
  });
});

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
