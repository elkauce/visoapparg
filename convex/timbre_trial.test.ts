import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const EMAIL = "approved-owner@example.test";
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => ({
    owner: await ctx.db.insert("users", {
      email: EMAIL,
      name: "Private owner",
      phone: "PRIVATE_PHONE",
    }),
    other: await ctx.db.insert("users", { email: "ordinary@example.test" }),
    sameEmailOrdinary: await ctx.db.insert("users", { email: EMAIL }),
  }));
  vi.stubEnv("MARKETPLACE_ADMIN_USER_IDS", ids.owner);
  const grant = () =>
    t.mutation(internal.timbre_trial.grantApprovedTrial, { email: EMAIL });
  const signed = t.withIdentity({ subject: `${ids.owner}|session` });
  const ordinary = t.withIdentity({ subject: `${ids.other}|session` });
  return { t, ...ids, grant, signed, ordinary };
}

describe("explicit internal Timbre trial", () => {
  it("requires exactly one existing allowlisted admin with the specified email", async () => {
    const { t, owner, sameEmailOrdinary, grant } = await fixture();
    await expect(
      t.mutation(internal.timbre_trial.grantApprovedTrial, {
        email: "ordinary@example.test",
      }),
    ).rejects.toThrow(/administradora/);
    await expect(
      t.mutation(internal.timbre_trial.grantApprovedTrial, {
        email: "missing@example.test",
      }),
    ).rejects.toThrow(/administradora/);
    vi.stubEnv("MARKETPLACE_ADMIN_USER_IDS", `${owner},${sameEmailOrdinary}`);
    await expect(grant()).rejects.toThrow(/única/);
    expect(
      await t.run((ctx) => ctx.db.query("timbreLicenses").collect()),
    ).toEqual([]);
  });

  it("creates one unpriced, unpublished seven-day audio/video trial for that admin only", async () => {
    const { t, owner, other, sameEmailOrdinary, grant } = await fixture();
    const now = Date.now();
    const result = await grant();
    expect(result.expiresAt).toBe(now + 7 * 86_400_000);
    expect(result.qrToken).toMatch(/^[a-f0-9]{64}$/);
    const data = await t.run(async (ctx) => ({
      license: await ctx.db.get("timbreLicenses", result.licenseId),
      plans: await ctx.db.query("timbrePlans").collect(),
      members: await ctx.db.query("timbreMembers").collect(),
      units: await ctx.db.query("timbreUnits").collect(),
      orders: await ctx.db.query("marketplaceOrders").collect(),
      payments: await ctx.db.query("timbreExternalPayments").collect(),
      audit: await ctx.db.query("timbreAuditEvents").collect(),
      otherLicenses: await ctx.db
        .query("timbreLicenses")
        .withIndex("by_owner", (q) => q.eq("ownerId", other))
        .collect(),
      duplicateLicenses: await ctx.db
        .query("timbreLicenses")
        .withIndex("by_owner", (q) => q.eq("ownerId", sameEmailOrdinary))
        .collect(),
    }));
    expect(data.license).toMatchObject({
      ownerId: owner,
      source: "internal_trial",
      status: "active",
      startsAt: now,
      expiresAt: result.expiresAt,
    });
    expect(data.license?.sourceOrderId).toBeUndefined();
    expect(data.license?.features).toEqual({
      audio: true,
      video: true,
      chat: false,
      messages: false,
      families: false,
      buildings: false,
      offices: false,
      access: false,
    });
    expect(data.license?.limits).toEqual({
      maxSites: 1,
      maxQrs: 1,
      maxMembers: 1,
      maxUnits: 1,
    });
    expect(data.plans).toHaveLength(1);
    expect(data.plans[0]).toMatchObject({ enabled: false, durationDays: 7 });
    expect(data.plans[0].priceAmount).toBeUndefined();
    expect(data.members).toHaveLength(1);
    expect(data.members[0]).toMatchObject({
      userId: owner,
      role: "owner",
      canReceive: true,
    });
    expect(data.units).toEqual([]);
    expect(data.orders).toEqual([]);
    expect(data.payments).toEqual([]);
    expect(data.otherLicenses).toEqual([]);
    expect(data.duplicateLicenses).toEqual([]);
    expect(data.audit).toHaveLength(1);
    expect(data.audit[0]).toMatchObject({
      action: "operator.internal_trial.created",
      targetId: result.licenseId,
    });
    expect(data.audit[0].actorUserId).toBeUndefined();
  });

  it("is idempotent without extending expiry or restoring settings disabled by the owner", async () => {
    const { t, signed, grant } = await fixture();
    const first = await grant();
    await signed.mutation(api.timbre.saveQr, {
      qrId: first.qrId,
      enabled: false,
    });
    vi.setSystemTime(Date.now() + 86_400_000);
    expect(await grant()).toEqual(first);
    expect(
      await t.run(async (ctx) => ({
        licenses: (await ctx.db.query("timbreLicenses").collect()).length,
        sites: (await ctx.db.query("timbreSites").collect()).length,
        qrs: (await ctx.db.query("timbreQrs").collect()).length,
        plans: (await ctx.db.query("timbrePlans").collect()).length,
        qrEnabled: (await ctx.db.get("timbreQrs", first.qrId))?.enabled,
      })),
    ).toEqual({ licenses: 1, sites: 1, qrs: 1, plans: 1, qrEnabled: false });
  });

  it("exposes a usable private-free public QR and applies the existing site/QR/member limits", async () => {
    const { t, signed, ordinary, grant } = await fixture();
    vi.stubEnv("TIMBRE_TURN_PROVIDER", "cloudflare");
    vi.stubEnv("TIMBRE_CLOUDFLARE_TURN_KEY_ID", "internal-trial-test-key");
    vi.stubEnv("TIMBRE_CLOUDFLARE_TURN_API_TOKEN", "internal-trial-test-token");
    const result = await grant();
    expect(
      await t.query(api.timbre_calls.rtcAvailability, {
        qrToken: result.qrToken,
      }),
    ).toEqual({ available: true });
    const view = await t.query(api.timbre.publicQr, {
      qrToken: result.qrToken,
    });
    expect(view).toMatchObject({
      siteName: "Timbre de prueba",
      label: "Prueba VISO",
      kind: "home",
      audioEnabled: true,
      videoEnabled: true,
      chatEnabled: false,
      messagesEnabled: false,
      available: true,
      units: [],
    });
    expect(JSON.stringify(view)).not.toMatch(
      /approved-owner|Private owner|PRIVATE_PHONE|licenseId|ownerId/,
    );
    await expect(
      signed.mutation(api.timbre.createQr, {
        siteId: result.siteId,
        label: "Second",
      }),
    ).rejects.toThrow(/límite/);
    await expect(
      signed.mutation(api.timbre.createSite, {
        licenseId: result.licenseId,
        kind: "home",
        name: "Second",
        timezone: "UTC",
      }),
    ).rejects.toThrow(/límite/);
    await expect(
      signed.mutation(api.timbre.createUnit, {
        siteId: result.siteId,
        name: "Unit",
      }),
    ).rejects.toThrow(/edificios/);
    await expect(
      signed.mutation(api.timbre.createInvite, {
        siteId: result.siteId,
        role: "resident",
      }),
    ).rejects.toThrow();
    await expect(
      ordinary.query(api.timbre.listQrs, { siteId: result.siteId }),
    ).rejects.toThrow(/permiso/);
  });

  it("expires through the normal backend guard and cannot be renewed by rerunning the operator command", async () => {
    const { t, signed, grant } = await fixture();
    vi.stubEnv("TIMBRE_TURN_PROVIDER", "cloudflare");
    vi.stubEnv("TIMBRE_CLOUDFLARE_TURN_KEY_ID", "internal-trial-test-key");
    vi.stubEnv("TIMBRE_CLOUDFLARE_TURN_API_TOKEN", "internal-trial-test-token");
    const result = await grant();
    expect(
      await t.query(api.timbre_calls.rtcAvailability, {
        qrToken: result.qrToken,
      }),
    ).toEqual({ available: true });
    vi.setSystemTime(result.expiresAt);
    expect(
      await t.query(api.timbre.publicQr, { qrToken: result.qrToken }),
    ).toBeNull();
    await expect(
      t.query(api.timbre_calls.rtcAvailability, { qrToken: result.qrToken }),
    ).rejects.toThrow(/licencia/);
    expect((await signed.query(api.timbre_commerce.myLicense, {})).active).toBe(
      false,
    );
    await expect(grant()).rejects.toThrow(/venció/);
    expect(
      (await t.run((ctx) => ctx.db.get("timbreLicenses", result.licenseId)))
        ?.expiresAt,
    ).toBe(result.expiresAt);
    expect(
      await t.run((ctx) => ctx.db.query("timbreLicenses").collect()),
    ).toHaveLength(1);
  });

  it("never resurrects a revoked trial", async () => {
    const { t, grant } = await fixture();
    const result = await grant();
    await t.run((ctx) =>
      ctx.db.patch("timbreLicenses", result.licenseId, {
        status: "revoked",
        revokedByAdmin: true,
      }),
    );
    await expect(grant()).rejects.toThrow(/desactivada/);
    expect(
      (await t.run((ctx) => ctx.db.get("timbreLicenses", result.licenseId)))
        ?.status,
    ).toBe("revoked");
  });
});
