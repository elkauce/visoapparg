import { makeFunctionReference } from "convex/server";
import { getAuthSessionId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireCurrentUser } from "./lib/current_user";
import { effectiveTimbreFeatures, getTimbreAvailability, hashTimbreToken, requireActiveTimbreLicense } from "./lib/timbre_access";
import { sendTimbreFcm, timbreFcmAccessToken, timbreFcmConfiguration } from "./lib/timbre_push";

const DAY = 86_400_000, FRESH = 30 * DAY;
const kind = v.union(v.literal("incoming"), v.literal("cancel"));
const wave = v.optional(v.union(v.literal("primary"), v.literal("fallback")));
const event = { callId: v.id("timbreCalls"), kind, wave };
type Event = { callId: Id<"timbreCalls">; kind: "incoming" | "cancel"; wave?: "primary" | "fallback" };
type Target = { deviceId: Id<"timbrePushDevices">; userId: Id<"users">; token: string; tokenHash: string; expiresAt: number };
const targetsRef = makeFunctionReference<"query", Event & { deviceId?: Id<"timbrePushDevices"> }, Target[]>("timbre_push:deliveryTargets");
const claimRef = makeFunctionReference<"mutation", Event & { deviceId: Id<"timbrePushDevices">; tokenHash: string }, Id<"timbrePushDeliveries"> | null>("timbre_push:claimDelivery");
const completeRef = makeFunctionReference<"mutation">("timbre_push:completeDelivery");
const retryRef = makeFunctionReference<"action">("timbre_push:deliverCall");
const pruneRef = makeFunctionReference<"mutation">("timbre_push:pruneDeliveries");

function deviceInput(deviceId: string, token?: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(deviceId) || (token !== undefined && (!/^[A-Za-z0-9_:.-]{40,4096}$/.test(token))))
    throw new ConvexError({ code: "TIMBRE_PUSH_INVALID", message: "No se pudo registrar este dispositivo." });
}
export const registerDevice = mutation({ args: { deviceId: v.string(), token: v.string() }, handler: async (ctx, args) => {
  const user = await requireCurrentUser(ctx); deviceInput(args.deviceId, args.token);
  const sessionId = await getAuthSessionId(ctx), session = sessionId ? await ctx.db.get("authSessions", sessionId) : null;
  if (!session || session.userId !== user._id || session.expirationTime <= Date.now())
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Volvé a iniciar sesión para activar los avisos." });
  const hash = await hashTimbreToken(args.token), now = Date.now();
  const old = await ctx.db.query("timbrePushDevices").withIndex("by_user_device", (q) => q.eq("userId", user._id).eq("deviceId", args.deviceId)).unique();
  const ownedToken = await ctx.db.query("timbrePushDevices").withIndex("by_token_hash", (q) => q.eq("tokenHash", hash)).unique();
  // FCM identifies a physical installation. Switching VISO accounts must remove
  // the previous association, never deliver the old account to the new one.
  if (ownedToken && ownedToken._id !== old?._id) await ctx.db.delete("timbrePushDevices", ownedToken._id);
  const fields = { userId: user._id, sessionId: session._id, deviceId: args.deviceId, token: args.token, tokenHash: hash, enabled: true, updatedAt: now, lastSeenAt: now };
  if (old) await ctx.db.patch("timbrePushDevices", old._id, fields);
  else {
    const devices = await ctx.db.query("timbrePushDevices").withIndex("by_user", (q) => q.eq("userId", user._id)).take(11);
    let active = 0;
    for (const device of devices) {
      const existingSession = await ctx.db.get("authSessions", device.sessionId);
      if (device.lastSeenAt <= now - FRESH || !existingSession || existingSession.userId !== user._id || existingSession.expirationTime <= now)
        await ctx.db.delete("timbrePushDevices", device._id);
      else active++;
    }
    if (active >= 10) throw new ConvexError({ code: "TIMBRE_PUSH_LIMIT", message: "Alcanzaste el límite de 10 dispositivos. Desactivá uno antes de agregar otro." });
    await ctx.db.insert("timbrePushDevices", { ...fields, createdAt: now });
  }
  return { registered: true, configured: timbreFcmConfiguration(process.env) !== null };
} });
export const unregisterDevice = mutation({ args: { deviceId: v.string() }, handler: async (ctx, { deviceId }) => {
  const user = await requireCurrentUser(ctx); deviceInput(deviceId);
  const row = await ctx.db.query("timbrePushDevices").withIndex("by_user_device", (q) => q.eq("userId", user._id).eq("deviceId", deviceId)).unique();
  if (row) await ctx.db.delete("timbrePushDevices", row._id);
  return { disabled: true };
} });
export const configuration = query({ args: {}, handler: async (ctx) => {
  const user = await requireCurrentUser(ctx);
  const devices = await ctx.db.query("timbrePushDevices").withIndex("by_user", (q) => q.eq("userId", user._id)).take(10);
  return { configured: timbreFcmConfiguration(process.env) !== null,
    devices: devices.map((device) => ({ deviceId: device.deviceId, enabled: device.enabled && device.lastSeenAt > Date.now() - FRESH, lastSeenAt: device.lastSeenAt })) };
} });

async function validCall(ctx: QueryCtx | MutationCtx, args: Event) {
  const call = await ctx.db.get("timbreCalls", args.callId);
  if (!call || (args.kind === "incoming" ? call.status !== "ringing" || call.expiresAt <= Date.now() : call.status === "ringing")) return null;
  const site = await ctx.db.get("timbreSites", call.siteId), qr = await ctx.db.get("timbreQrs", call.qrId);
  if (!site?.notificationsEnabled || !site.enabled || !qr?.enabled || qr.revokedAt || qr.siteId !== site._id || !await ctx.db.get("users", site.ownerId)) return null;
  if (args.kind === "incoming" && !getTimbreAvailability(site).available) return null;
  if (call.unitId) { const unit = await ctx.db.get("timbreUnits", call.unitId); if (!unit?.enabled || unit.siteId !== site._id) return null; }
  try { const license = await requireActiveTimbreLicense(ctx, site); if (!effectiveTimbreFeatures(site, license.features)[call.mode]) return null; }
  catch { return null; }
  return { call, site };
}
async function validRecipient(ctx: QueryCtx | MutationCtx, call: Doc<"timbreCalls">, userId: Id<"users">) {
  if (!await ctx.db.get("users", userId)) return false;
  const member = await ctx.db.query("timbreMembers").withIndex("by_site_user", (q) => q.eq("siteId", call.siteId).eq("userId", userId)).unique();
  if (!member?.canReceive) return false;
  const site = await ctx.db.get("timbreSites", call.siteId);
  if (!site || (member.role === "owner" && site.ownerId !== userId)) return false;
  return member.role !== "resident" || (call.unitId ? member.unitIds.includes(call.unitId) : site.kind !== "building");
}
export const deliveryTargets = internalQuery({ args: { ...event, deviceId: v.optional(v.id("timbrePushDevices")) }, handler: async (ctx, args): Promise<Target[]> => {
  const context = await validCall(ctx, args); if (!context) return [];
  const recipients = await ctx.db.query("timbreCallRecipients").withIndex("by_call", (q) => q.eq("callId", args.callId)).take(100);
  const result: Target[] = [];
  for (const recipient of recipients) {
    if (args.kind === "incoming" && (recipient.rejectedAt || (args.wave && recipient.wave !== args.wave))) continue;
    if (!await validRecipient(ctx, context.call, recipient.userId)) continue;
    const devices = args.deviceId ? [await ctx.db.get("timbrePushDevices", args.deviceId)]
      : await ctx.db.query("timbrePushDevices").withIndex("by_user", (q) => q.eq("userId", recipient.userId)).take(10);
    for (const device of devices) {
      if (!device?.enabled || device.userId !== recipient.userId || device.lastSeenAt <= Date.now() - FRESH) continue;
      const session = await ctx.db.get("authSessions", device.sessionId);
      if (!session || session.userId !== device.userId || session.expirationTime <= Date.now()) continue;
      result.push({ deviceId: device._id, userId: device.userId, token: device.token, tokenHash: device.tokenHash,
        expiresAt: args.kind === "incoming" ? context.call.expiresAt : Date.now() + 20_000 });
    }
  }
  return result;
} });
export const claimDelivery = internalMutation({ args: { ...event, deviceId: v.id("timbrePushDevices"), tokenHash: v.string() }, handler: async (ctx, args) => {
  const device = await ctx.db.get("timbrePushDevices", args.deviceId);
  const context = await validCall(ctx, args);
  if (!device?.enabled || device.tokenHash !== args.tokenHash || device.lastSeenAt <= Date.now() - FRESH || !context || !await validRecipient(ctx, context.call, device.userId)) return null;
  const session = await ctx.db.get("authSessions", device.sessionId);
  if (!session || session.userId !== device.userId || session.expirationTime <= Date.now()) return null;
  const recipient = await ctx.db.query("timbreCallRecipients").withIndex("by_call_user", (q) => q.eq("callId", args.callId).eq("userId", device.userId)).unique();
  if (!recipient || (args.kind === "incoming" && (recipient.rejectedAt || (args.wave && args.wave !== recipient.wave)))) return null;
  const existing = await ctx.db.query("timbrePushDeliveries").withIndex("by_call_device_kind", (q) => q.eq("callId", args.callId).eq("deviceId", args.deviceId).eq("kind", args.kind)).unique();
  if (existing?.state === "sent" || (existing?.state === "sending" && existing.attemptedAt > Date.now() - 15_000)) return null;
  if (existing) { await ctx.db.patch("timbrePushDeliveries", existing._id, { state: "sending", attemptedAt: Date.now() }); return existing._id; }
  const id = await ctx.db.insert("timbrePushDeliveries", { callId: args.callId, deviceId: args.deviceId, kind: args.kind, state: "sending", attemptedAt: Date.now(), expiresAt: Date.now() + DAY });
  await ctx.scheduler.runAfter(DAY, pruneRef, {});
  return id;
} });
export const completeDelivery = internalMutation({ args: { deliveryId: v.id("timbrePushDeliveries"), tokenHash: v.string(), state: v.union(v.literal("sent"), v.literal("failed"), v.literal("invalid")) }, handler: async (ctx, args) => {
  const delivery = await ctx.db.get("timbrePushDeliveries", args.deliveryId); if (!delivery) return;
  await ctx.db.patch("timbrePushDeliveries", delivery._id, { state: args.state === "sent" ? "sent" : "failed" });
  if (args.state === "invalid") {
    const device = await ctx.db.get("timbrePushDevices", delivery.deviceId);
    if (device?.tokenHash === args.tokenHash) await ctx.db.delete("timbrePushDevices", device._id);
  }
} });
export const pruneDeliveries = internalMutation({ args: {}, handler: async (ctx) => {
  const expired = await ctx.db.query("timbrePushDeliveries").withIndex("by_expires", (q) => q.lte("expiresAt", Date.now())).take(100);
  for (const row of expired) await ctx.db.delete("timbrePushDeliveries", row._id);
  if (expired.length === 100) await ctx.scheduler.runAfter(0, pruneRef, {});
} });
export const deliverCall = internalAction({ args: { ...event, attempt: v.optional(v.number()) }, handler: async (ctx, args) => {
  const credentials = timbreFcmConfiguration(process.env);
  if (!credentials) return { configured: false, sent: 0 };
  const attempt = args.attempt ?? 0;
  if (!Number.isInteger(attempt) || attempt < 0 || attempt > 2) return { configured: true, sent: 0 };
  const queryArgs: Event = { callId: args.callId, kind: args.kind, ...(args.wave ? { wave: args.wave } : {}) };
  const targets = await ctx.runQuery(targetsRef, queryArgs);
  if (!targets.length) return { configured: true, sent: 0 };
  let accessToken: string;
  try { accessToken = await timbreFcmAccessToken(credentials); }
  catch {
    if (attempt < 2) await ctx.scheduler.runAfter(2_000 * (attempt + 1), retryRef, { ...queryArgs, attempt: attempt + 1 });
    return { configured: true, sent: 0 };
  }
  let sent = 0, retry = false;
  const send = async (target: Target) => {
    // Re-read authorization after OAuth/network waits and before each send.
    const [current] = await ctx.runQuery(targetsRef, { ...queryArgs, deviceId: target.deviceId });
    if (!current || current.tokenHash !== target.tokenHash) return;
    const deliveryId = await ctx.runMutation(claimRef, { ...queryArgs, deviceId: current.deviceId, tokenHash: current.tokenHash });
    if (!deliveryId) return;
    const state = await sendTimbreFcm(credentials, accessToken, current.token, { type: "timbre_call", kind: args.kind,
      callId: args.callId, ownerId: current.userId, expiresAt: String(current.expiresAt) });
    await ctx.runMutation(completeRef, { deliveryId, tokenHash: current.tokenHash, state: state === "retry" ? "failed" : state });
    if (state === "sent") sent++; if (state === "retry") retry = true;
  };
  for (let offset = 0; offset < targets.length && offset < 100; offset += 5)
    await Promise.all(targets.slice(offset, offset + 5).map(send));
  if (retry && attempt < 2) await ctx.scheduler.runAfter(2_000 * (attempt + 1), retryRef, { ...queryArgs, attempt: attempt + 1 });
  return { configured: true, sent };
} });
