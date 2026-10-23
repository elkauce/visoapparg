import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

beforeEach(() => {
  for (const name of [
    "TIMBRE_TURN_PROVIDER",
    "TIMBRE_TURN_URLS",
    "TIMBRE_TURN_SECRET",
    "TIMBRE_CLOUDFLARE_TURN_KEY_ID",
    "TIMBRE_CLOUDFLARE_TURN_API_TOKEN",
    "TIMBRE_FCM_SERVICE_ACCOUNT",
  ])
    vi.stubEnv(name, "");
});

const verificationKeyId = "verification-key-local-test";
const verificationToken = "verification-server-only-token-local-test";
function verificationConfiguration() {
  vi.stubEnv("TIMBRE_TURN_PROVIDER", "cloudflare");
  vi.stubEnv("TIMBRE_CLOUDFLARE_TURN_KEY_ID", verificationKeyId);
  vi.stubEnv("TIMBRE_CLOUDFLARE_TURN_API_TOKEN", verificationToken);
}
function verificationResponse(
  usernames = ["temporary-user:/?", "temporary-user:/?"],
) {
  return new Response(
    JSON.stringify({
      iceServers: [
        { urls: ["stun:stun.cloudflare.com:3478"] },
        ...usernames.map((username, index) => ({
          urls:
            index === 0
              ? [
                  "turn:turn.cloudflare.com:3478?transport=udp",
                  "turns:turn.cloudflare.com:443?transport=tcp",
                ]
              : ["turns:turn.cloudflare.com:5349?transport=tcp"],
          username,
          credential: "temporary-provider-password",
        })),
      ],
    }),
    { status: 201 },
  );
}

describe("internal Cloudflare credential verification", () => {
  it("skips the provider when configuration is missing or another provider is selected", async () => {
    const { t } = await fixture();
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const missing = await t.action(internal.timbre_setup.verifyCloudflare, {});
    expect(missing).toEqual({
      configured: false,
      credentialsAccepted: false,
      relayUrlCount: 0,
      revokeConfirmed: false,
      connectivityTested: false,
    });
    vi.stubEnv("TIMBRE_TURN_PROVIDER", "coturn");
    vi.stubEnv("TIMBRE_TURN_URLS", "turns:relay.example.test:5349");
    vi.stubEnv("TIMBRE_TURN_SECRET", "a".repeat(40));
    expect(await t.action(internal.timbre_setup.verifyCloudflare, {})).toEqual(
      missing,
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("verifies the official API, revokes shared temporary usernames once, and exposes no credential values", async () => {
    const { t } = await fixture();
    verificationConfiguration();
    const request = vi
      .fn()
      .mockImplementationOnce(async () => verificationResponse())
      .mockImplementationOnce(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", request);
    const result = await t.action(internal.timbre_setup.verifyCloudflare, {});
    expect(result).toEqual({
      configured: true,
      credentialsAccepted: true,
      relayUrlCount: 3,
      revokeConfirmed: true,
      connectivityTested: false,
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][0]).toBe(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${verificationKeyId}/credentials/generate-ice-servers`,
    );
    expect(request.mock.calls[0][1]).toMatchObject({
      method: "POST",
      redirect: "error",
      headers: {
        authorization: `Bearer ${verificationToken}`,
        "content-type": "application/json",
      },
      signal: expect.any(AbortSignal),
    });
    const { ttl } = JSON.parse(request.mock.calls[0][1].body);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThan(90);
    expect(request.mock.calls[1][0]).toBe(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${verificationKeyId}/credentials/${encodeURIComponent("temporary-user:/?")}/revoke`,
    );
    expect(request.mock.calls[1][1]).toMatchObject({
      method: "POST",
      redirect: "error",
      headers: { authorization: `Bearer ${verificationToken}` },
      signal: expect.any(AbortSignal),
    });
    for (const value of [
      verificationKeyId,
      verificationToken,
      "temporary-user",
      "temporary-provider-password",
    ])
      expect(JSON.stringify(result)).not.toContain(value);
  });

  it("reports partial cleanup separately and still revokes every distinct temporary user", async () => {
    const { t } = await fixture();
    verificationConfiguration();
    const request = vi
      .fn()
      .mockImplementationOnce(async () =>
        verificationResponse(["user-a", "user-b"]),
      )
      .mockImplementationOnce(
        async () =>
          new Response(`private response ${verificationToken}`, {
            status: 500,
          }),
      )
      .mockImplementationOnce(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", request);
    const result = await t.action(internal.timbre_setup.verifyCloudflare, {});
    expect(result).toMatchObject({
      configured: true,
      credentialsAccepted: true,
      revokeConfirmed: false,
      connectivityTested: false,
    });
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls[1][0]).toContain("/credentials/user-a/revoke");
    expect(request.mock.calls[2][0]).toContain("/credentials/user-b/revoke");
    expect(JSON.stringify(result)).not.toContain("private response");
    expect(JSON.stringify(result)).not.toContain(verificationToken);
  });

  it("sanitizes a rejected token without attempting revocation", async () => {
    const { t } = await fixture();
    verificationConfiguration();
    const request = vi
      .fn()
      .mockImplementation(
        async () =>
          new Response(`private provider detail ${verificationToken}`, {
            status: 401,
          }),
      );
    vi.stubGlobal("fetch", request);
    const result = await t.action(internal.timbre_setup.verifyCloudflare, {});
    expect(result).toEqual({
      configured: true,
      credentialsAccepted: false,
      relayUrlCount: 0,
      revokeConfirmed: false,
      connectivityTested: false,
    });
    expect(request).toHaveBeenCalledOnce();
    expect(JSON.stringify(result)).not.toContain(verificationToken);
    expect(JSON.stringify(result)).not.toContain("private provider detail");
  });

  it("does not create a call, plan, license or order when verifying infrastructure", async () => {
    const { t } = await fixture();
    verificationConfiguration();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(async () => verificationResponse())
        .mockImplementationOnce(
          async () => new Response(null, { status: 204 }),
        ),
    );
    await t.action(internal.timbre_setup.verifyCloudflare, {});
    expect(
      await t.run(async (ctx) => ({
        calls: (await ctx.db.query("timbreCalls").collect()).length,
        plans: (await ctx.db.query("timbrePlans").collect()).length,
        licenses: (await ctx.db.query("timbreLicenses").collect()).length,
        orders: (await ctx.db.query("marketplaceOrders").collect()).length,
      })),
    ).toEqual({ calls: 0, plans: 0, licenses: 0, orders: 0 });
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => ({
    admin: await ctx.db.insert("users", { email: "admin@example.test" }),
    ordinary: await ctx.db.insert("users", { email: "admin@example.test" }),
  }));
  vi.stubEnv("MARKETPLACE_ADMIN_USER_IDS", ids.admin);
  return {
    t,
    admin: t.withIdentity({ subject: `${ids.admin}|admin` }),
    ordinary: t.withIdentity({ subject: `${ids.ordinary}|ordinary` }),
  };
}

describe("private Timbre installation status", () => {
  it("requires the immutable administrator account, including for users sharing its email", async () => {
    const { t, ordinary } = await fixture();
    await expect(t.query(api.timbre_setup.configuration, {})).rejects.toThrow();
    await expect(
      ordinary.query(api.timbre_setup.configuration, {}),
    ).rejects.toThrow(/permiso/);
  });

  it("shows missing Cloudflare slots without contacting providers or granting service", async () => {
    const { t, admin } = await fixture();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const status = await admin.query(api.timbre_setup.configuration, {});
    expect(status).toEqual({
      turn: {
        provider: "unconfigured",
        configured: false,
        checks: [
          { name: "TIMBRE_TURN_PROVIDER", configured: false },
          { name: "TIMBRE_CLOUDFLARE_TURN_KEY_ID", configured: false },
          { name: "TIMBRE_CLOUDFLARE_TURN_API_TOKEN", configured: false },
        ],
      },
      push: { configured: false },
      callTested: false,
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(
      await t.run(async (ctx) => ({
        licenses: (await ctx.db.query("timbreLicenses").collect()).length,
        plans: (await ctx.db.query("timbrePlans").collect()).length,
        orders: (await ctx.db.query("marketplaceOrders").collect()).length,
      })),
    ).toEqual({ licenses: 0, plans: 0, orders: 0 });
  });

  it("reports saved configuration separately from connectivity and never returns private values", async () => {
    const { admin } = await fixture();
    const keyId = "private-turn-key-id";
    const token = "private-api-token-for-local-test-only";
    vi.stubEnv("TIMBRE_TURN_PROVIDER", "cloudflare");
    vi.stubEnv("TIMBRE_CLOUDFLARE_TURN_KEY_ID", keyId);
    vi.stubEnv("TIMBRE_CLOUDFLARE_TURN_API_TOKEN", token);
    const status = await admin.query(api.timbre_setup.configuration, {});
    expect(status.turn.provider).toBe("cloudflare");
    expect(status.turn.configured).toBe(true);
    expect(status.turn.checks.every((check) => check.configured)).toBe(true);
    expect(status.callTested).toBe(false);
    expect(status.push.configured).toBe(false);
    expect(JSON.stringify(status)).not.toContain(keyId);
    expect(JSON.stringify(status)).not.toContain(token);
  });

  it("identifies malformed fields and rejects unsupported providers without reflecting their values", async () => {
    const { admin } = await fixture();
    vi.stubEnv("TIMBRE_TURN_PROVIDER", "cloudflare");
    vi.stubEnv("TIMBRE_CLOUDFLARE_TURN_KEY_ID", "../../bad");
    vi.stubEnv(
      "TIMBRE_CLOUDFLARE_TURN_API_TOKEN",
      "valid-local-test-api-token",
    );
    const partial = await admin.query(api.timbre_setup.configuration, {});
    expect(partial.turn.configured).toBe(false);
    expect(partial.turn.checks).toContainEqual({
      name: "TIMBRE_CLOUDFLARE_TURN_KEY_ID",
      configured: false,
    });
    expect(partial.turn.checks).toContainEqual({
      name: "TIMBRE_CLOUDFLARE_TURN_API_TOKEN",
      configured: true,
    });
    vi.stubEnv("TIMBRE_TURN_PROVIDER", "private-invalid-provider-value");
    const invalid = await admin.query(api.timbre_setup.configuration, {});
    expect(invalid.turn.provider).toBe("unsupported");
    expect(invalid.turn.configured).toBe(false);
    expect(JSON.stringify(invalid)).not.toContain("private-invalid-provider");
  });

  it("preserves default coturn installations and reports valid FCM syntax without certifying Android delivery", async () => {
    const { admin } = await fixture();
    vi.stubEnv("TIMBRE_TURN_PROVIDER", undefined);
    vi.stubEnv("TIMBRE_TURN_URLS", "turns:relay.example.test:5349");
    vi.stubEnv("TIMBRE_TURN_SECRET", "a".repeat(40));
    vi.stubEnv(
      "TIMBRE_FCM_SERVICE_ACCOUNT",
      JSON.stringify({
        type: "service_account",
        project_id: "viso-test-project",
        client_email: "push@viso-test-project.iam.gserviceaccount.com",
        private_key:
          "-----BEGIN PRIVATE KEY-----\nlocal-shape-only\n-----END PRIVATE KEY-----\n",
      }),
    );
    const status = await admin.query(api.timbre_setup.configuration, {});
    expect(status.turn.provider).toBe("coturn");
    expect(status.turn.configured).toBe(true);
    expect(status.turn.checks.map((check) => check.name)).toEqual([
      "TIMBRE_TURN_URLS",
      "TIMBRE_TURN_SECRET",
    ]);
    expect(status.push.configured).toBe(true);
    expect(status.callTested).toBe(false);
    expect(JSON.stringify(status)).not.toMatch(/local-shape-only|push@viso/);
  });
});
