import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { sendTimbreFcm, timbreFcmAssertion, timbreFcmConfiguration, timbreFcmMessage } from "./lib/timbre_push";

const deviceId = "installation_test_1234567890";
const token = "test_fcm_token_" + "A".repeat(70);
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function localCredentials(projectId = "viso-local-test") {
  const keys = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const bytes = new Uint8Array(await crypto.subtle.exportKey("pkcs8", keys.privateKey));
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  const credentials = { projectId, clientEmail: `push@${projectId}.iam.gserviceaccount.com`, privateKey: `-----BEGIN PRIVATE KEY-----\n${btoa(binary)}\n-----END PRIVATE KEY-----\n` };
  return { keys, credentials, json: JSON.stringify({ type: "service_account", project_id: credentials.projectId, client_email: credentials.clientEmail, private_key: credentials.privateKey }) };
}
async function fixture() {
  const t = convexTest(schema, modules);
  const data = await t.run(async (ctx) => {
    const now = Date.now(), owner = await ctx.db.insert("users", { name: "Private resident", email: "private@example.test" });
    const other = await ctx.db.insert("users", { name: "Other" });
    const sessionId = await ctx.db.insert("authSessions", { userId: owner, expirationTime: now + 86_400_000 });
    const otherSession = await ctx.db.insert("authSessions", { userId: other, expirationTime: now + 86_400_000 });
    const features = { audio: true, video: true, chat: true, messages: true, families: true, buildings: true, offices: true, access: false };
    const limits = { maxSites: 3, maxQrs: 10, maxMembers: 10, maxUnits: 10 };
    const planId = await ctx.db.insert("timbrePlans", { code: "digital", name: "Test", description: "Test", enabled: true,
      currency: "ARS", priceAmount: 100, period: "one_time", features, limits, sellerId: owner, createdAt: now, updatedAt: now });
    const licenseId = await ctx.db.insert("timbreLicenses", { ownerId: owner, planId, planName: "Test", status: "active", startsAt: now - 1000,
      expiresAt: now + 86_400_000, source: "one_time_purchase", sourceReference: "verified-test", features, limits, createdAt: now, updatedAt: now });
    const siteId = await ctx.db.insert("timbreSites", { ownerId: owner, licenseId, kind: "home", name: "Private address", timezone: "America/Argentina/Buenos_Aires",
      enabled: true, allowedAudio: true, allowedVideo: true, chatEnabled: true, messagesEnabled: true, notificationsEnabled: true,
      schedule: [], recipientIds: [owner], fallbackAfterSeconds: 30, createdAt: now, updatedAt: now });
    const membershipId = await ctx.db.insert("timbreMembers", { siteId, userId: owner, role: "owner", unitIds: [], canReceive: true, createdAt: now, updatedAt: now });
    const qrId = await ctx.db.insert("timbreQrs", { siteId, token: "a".repeat(64), label: "Door", enabled: true, createdAt: now, updatedAt: now });
    const callId = await ctx.db.insert("timbreCalls", { siteId, qrId, mode: "audio", status: "ringing", visitorTokenHash: "hash", visitorNonceHash: "hash2", createdAt: now, expiresAt: now + 90_000, visitorSeenAt: now });
    await ctx.db.insert("timbreCallRecipients", { callId, userId: owner, wave: "primary", createdAt: now });
    return { owner, other, sessionId, otherSession, membershipId, siteId, qrId, licenseId, callId };
  });
  return { t, ...data, signed: t.withIdentity({ subject: `${data.owner}|${data.sessionId}` }), otherUser: t.withIdentity({ subject: `${data.other}|${data.otherSession}` }) };
}

describe("Timbre push authorization", () => {
  it("requires an authenticated session and never returns token or credentials", async () => {
    const f = await fixture();
    await expect(f.t.mutation(api.timbre_push.registerDevice, { deviceId, token })).rejects.toThrow();
    await f.signed.mutation(api.timbre_push.registerDevice, { deviceId, token });
    const configuration = await f.signed.query(api.timbre_push.configuration, {});
    expect(configuration).toMatchObject({ configured: false, devices: [{ deviceId, enabled: true }] });
    expect(JSON.stringify(configuration)).not.toContain(token);
    expect(JSON.stringify(configuration)).not.toMatch(/private_key|private@example/);
    await f.t.run((ctx) => ctx.db.delete("authSessions", f.sessionId));
    await expect(f.signed.mutation(api.timbre_push.registerDevice, { deviceId, token })).rejects.toThrow(/sesión/);
  });
  it("associates one physical token with the currently authenticated account only", async () => {
    const f = await fixture();
    await f.signed.mutation(api.timbre_push.registerDevice, { deviceId, token });
    await f.otherUser.mutation(api.timbre_push.unregisterDevice, { deviceId });
    expect((await f.signed.query(api.timbre_push.configuration, {})).devices).toHaveLength(1);
    await f.otherUser.mutation(api.timbre_push.registerDevice, { deviceId, token });
    expect((await f.signed.query(api.timbre_push.configuration, {})).devices).toHaveLength(0);
    expect(await f.t.query(internal.timbre_push.deliveryTargets, { callId: f.callId, kind: "incoming" })).toEqual([]);
  });
  it("bounds installations per user and frees stale devices before registering a new one", async () => {
    const f = await fixture();
    for (let n = 0; n < 10; n++) await f.signed.mutation(api.timbre_push.registerDevice, { deviceId: `${deviceId}_${n}`, token: `${token}_${n}` });
    await expect(f.signed.mutation(api.timbre_push.registerDevice, { deviceId, token })).rejects.toThrow(/límite/);
    await f.t.run(async (ctx) => {
      const [old] = await ctx.db.query("timbrePushDevices").withIndex("by_user", (q) => q.eq("userId", f.owner)).take(1);
      await ctx.db.patch("timbrePushDevices", old._id, { lastSeenAt: Date.now() - 31 * 86_400_000 });
    });
    await expect(f.signed.mutation(api.timbre_push.registerDevice, { deviceId, token })).resolves.toMatchObject({ registered: true });
    expect((await f.signed.query(api.timbre_push.configuration, {})).devices).toHaveLength(10);
  });
  it("checks license, notification preference, QR, membership, freshness and session before delivery", async () => {
    const f = await fixture(); await f.signed.mutation(api.timbre_push.registerDevice, { deviceId, token });
    const args = { callId: f.callId, kind: "incoming" as const, wave: "primary" as const };
    expect(await f.t.query(internal.timbre_push.deliveryTargets, args)).toHaveLength(1);
    expect(await f.t.query(internal.timbre_push.deliveryTargets, { ...args, wave: "fallback" })).toHaveLength(0);
    await f.t.run((ctx) => ctx.db.patch("timbreSites", f.siteId, { notificationsEnabled: false }));
    expect(await f.t.query(internal.timbre_push.deliveryTargets, args)).toEqual([]);
    await f.t.run((ctx) => ctx.db.patch("timbreSites", f.siteId, { notificationsEnabled: true }));
    await f.t.run((ctx) => ctx.db.patch("timbreLicenses", f.licenseId, { status: "revoked" }));
    expect(await f.t.query(internal.timbre_push.deliveryTargets, args)).toEqual([]);
    await f.t.run((ctx) => ctx.db.patch("timbreLicenses", f.licenseId, { status: "active" }));
    await f.t.run((ctx) => ctx.db.patch("timbreQrs", f.qrId, { revokedAt: Date.now() }));
    expect(await f.t.query(internal.timbre_push.deliveryTargets, args)).toEqual([]);
    await f.t.run((ctx) => ctx.db.patch("timbreQrs", f.qrId, { revokedAt: undefined }));
    await f.t.run((ctx) => ctx.db.patch("timbreMembers", f.membershipId, { canReceive: false }));
    expect(await f.t.query(internal.timbre_push.deliveryTargets, args)).toEqual([]);
    await f.t.run((ctx) => ctx.db.patch("timbreMembers", f.membershipId, { canReceive: true }));
    const device = (await f.t.query(internal.timbre_push.deliveryTargets, args))[0];
    await f.t.run((ctx) => ctx.db.patch("timbrePushDevices", device.deviceId, { lastSeenAt: Date.now() - 31 * 86_400_000 }));
    expect(await f.t.query(internal.timbre_push.deliveryTargets, args)).toEqual([]);
    await f.signed.mutation(api.timbre_push.registerDevice, { deviceId, token });
    await f.t.run((ctx) => ctx.db.delete("authSessions", f.sessionId));
    expect(await f.t.query(internal.timbre_push.deliveryTargets, args)).toEqual([]);
  });
  it("does not contact a provider without credentials and suppresses duplicate deliveries", async () => {
    vi.stubEnv("TIMBRE_FCM_SERVICE_ACCOUNT", "");
    const network = vi.fn(); vi.stubGlobal("fetch", network);
    const f = await fixture(); await f.signed.mutation(api.timbre_push.registerDevice, { deviceId, token });
    expect(await f.t.action(internal.timbre_push.deliverCall, { callId: f.callId, kind: "incoming" })).toEqual({ configured: false, sent: 0 });
    expect(network).not.toHaveBeenCalled();
    const [target] = await f.t.query(internal.timbre_push.deliveryTargets, { callId: f.callId, kind: "incoming" });
    const args = { callId: f.callId, kind: "incoming" as const, deviceId: target.deviceId, tokenHash: target.tokenHash };
    const delivery = await f.t.mutation(internal.timbre_push.claimDelivery, args);
    expect(delivery).toBeTruthy();
    expect(await f.t.mutation(internal.timbre_push.claimDelivery, args)).toBeNull();
    await f.t.mutation(internal.timbre_push.completeDelivery, { deliveryId: delivery!, tokenHash: target.tokenHash, state: "sent" });
    expect(await f.t.mutation(internal.timbre_push.claimDelivery, args)).toBeNull();
  });
  it("cancels accepted native notices with future expiry and purges invalid tokens", async () => {
    const f = await fixture(); await f.signed.mutation(api.timbre_push.registerDevice, { deviceId, token });
    expect(await f.t.query(internal.timbre_push.deliveryTargets, { callId: f.callId, kind: "cancel" })).toEqual([]);
    await f.t.run((ctx) => ctx.db.patch("timbreCalls", f.callId, { status: "accepted", acceptedBy: f.owner }));
    expect(await f.t.query(internal.timbre_push.deliveryTargets, { callId: f.callId, kind: "incoming" })).toEqual([]);
    const [target] = await f.t.query(internal.timbre_push.deliveryTargets, { callId: f.callId, kind: "cancel" });
    expect(target.expiresAt).toBeGreaterThan(Date.now());
    const deliveryId = await f.t.mutation(internal.timbre_push.claimDelivery, { callId: f.callId, kind: "cancel", deviceId: target.deviceId, tokenHash: target.tokenHash });
    await f.t.mutation(internal.timbre_push.completeDelivery, { deliveryId: deliveryId!, tokenHash: target.tokenHash, state: "invalid" });
    expect((await f.signed.query(api.timbre_push.configuration, {})).devices).toEqual([]);
  });
  it("authenticates with Google using server credentials and retries only failed deliveries", async () => {
    const { json } = await localCredentials("viso-local-send-test");
    vi.stubEnv("TIMBRE_FCM_SERVICE_ACCOUNT", json); vi.useFakeTimers();
    const network = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "local-oauth-token", token_type: "Bearer", expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: "projects/local/messages/local" }), { status: 200 }));
    vi.stubGlobal("fetch", network);
    const f = await fixture(); await f.signed.mutation(api.timbre_push.registerDevice, { deviceId, token });
    const args = { callId: f.callId, kind: "incoming" as const, wave: "primary" as const };
    expect(await f.t.action(internal.timbre_push.deliverCall, args)).toEqual({ configured: true, sent: 0 });
    expect(network.mock.calls[0][0]).toBe("https://oauth2.googleapis.com/token");
    expect(String(network.mock.calls[0][1].body)).toContain("assertion=");
    expect(await f.t.action(internal.timbre_push.deliverCall, { ...args, attempt: 1 })).toEqual({ configured: true, sent: 1 });
    const count = network.mock.calls.length;
    expect(await f.t.action(internal.timbre_push.deliverCall, args)).toEqual({ configured: true, sent: 0 });
    expect(await f.t.action(internal.timbre_push.deliverCall, { ...args, attempt: 3 })).toEqual({ configured: true, sent: 0 });
    expect(network).toHaveBeenCalledTimes(count);
    const message = JSON.parse(String(network.mock.calls[1][1].body)).message;
    expect(message.data.ownerId).toBe(f.owner);
    expect(JSON.stringify(message)).not.toMatch(/private@example|Private address|visitorToken|private_key/);
    expect(Object.keys(message.data).sort()).toEqual(["callId", "expiresAt", "kind", "ownerId", "type"]);
  });
});

describe("FCM server transport", () => {
  it("fails closed with absent or malformed service accounts", () => {
    for (const source of [undefined, "{}", "not-json", JSON.stringify({ type: "service_account", project_id: "../../other" })])
      expect(timbreFcmConfiguration({ TIMBRE_FCM_SERVICE_ACCOUNT: source })).toBeNull();
  });
  it("creates a short-lived RS256 assertion with a fixed Google audience and messaging scope", async () => {
    const { keys, credentials } = await localCredentials();
    const jwt = await timbreFcmAssertion(credentials, 1_700_000_000_000), [header, body, signature] = jwt.split(".");
    const decode = (part: string) => atob(part.replaceAll("-", "+").replaceAll("_", "/"));
    expect(JSON.parse(decode(body))).toEqual({ iss: credentials.clientEmail, aud: "https://oauth2.googleapis.com/token", scope: "https://www.googleapis.com/auth/firebase.messaging", iat: 1700000000, exp: 1700000300 });
    expect(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", keys.publicKey, Uint8Array.from(decode(signature), (c) => c.charCodeAt(0)), new TextEncoder().encode(`${header}.${body}`))).toBe(true);
    expect(timbreFcmConfiguration({ TIMBRE_FCM_SERVICE_ACCOUNT: JSON.stringify({ type: "service_account", project_id: credentials.projectId, client_email: credentials.clientEmail, private_key: credentials.privateKey }) })).toEqual(credentials);
  });
  it("sends only data identifiers, uses short TTL and only invalidates explicit unregistered tokens", async () => {
    const data = { type: "timbre_call" as const, kind: "incoming" as const, callId: "opaque-call", ownerId: "opaque-user", expiresAt: String(Date.now() + 30_000) };
    const message = timbreFcmMessage(token, data);
    expect(message.message.android.priority).toBe("HIGH"); expect(message.message.android.ttl).toBe("30s");
    expect(message.message).not.toHaveProperty("notification");
    expect(Object.keys(message.message.data).sort()).toEqual(["callId", "expiresAt", "kind", "ownerId", "type"]);
    const network = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: { details: [{ errorCode: "UNREGISTERED" }] } }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { status: "INVALID_ARGUMENT" } }), { status: 400 }))
      .mockResolvedValueOnce(new Response("{}", { status: 503 }));
    vi.stubGlobal("fetch", network);
    const credentials = { projectId: "viso-local-test", clientEmail: "unused", privateKey: "unused" };
    expect(await sendTimbreFcm(credentials, "test-bearer", token, data)).toBe("invalid");
    expect(await sendTimbreFcm(credentials, "test-bearer", token, data)).toBe("failed");
    expect(await sendTimbreFcm(credentials, "test-bearer", token, data)).toBe("retry");
    expect(network.mock.calls[0][0]).toBe("https://fcm.googleapis.com/v1/projects/viso-local-test/messages:send");
  });
});
