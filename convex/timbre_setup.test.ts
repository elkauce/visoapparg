import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
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
