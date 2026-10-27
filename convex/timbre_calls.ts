import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireCurrentUser } from "./lib/current_user";
import {
  effectiveTimbreFeatures,
  requireActiveTimbreLicense,
  requireSiteMember,
  resolvePublicQr,
} from "./lib/timbre_access";
import {
  beginTimbrePresence,
  endTimbrePresence,
  beginTimbreRingPresence,
  endTimbreRingPresence,
} from "./lib/timbre_presence";
import {
  createTurnCredentials,
  createCloudflareTurnCredentials,
  hashCapability,
  randomCapability,
  TIMBRE_CALL_MS,
  TIMBRE_LEASE_MS,
  TIMBRE_RING_MS,
  timbreTurnProviderConfiguration,
  validateSignal,
} from "./lib/timbre_rtc";
import { timbreCallMode, timbreSignalKind } from "./timbre_calls_tables";
import { teavisoPortalReason } from "./teaviso_spaces";

type ReadCtx = QueryCtx | MutationCtx;
type Call = Doc<"timbreCalls">;
const sessionArgs = {
  callId: v.id("timbreCalls"),
  visitorToken: v.optional(v.string()),
};
const expireRef = makeFunctionReference<"mutation">("timbre_calls:expireCall");
const fallbackRef = makeFunctionReference<"mutation">(
  "timbre_calls:notifyFallback",
);
const purgeRef = makeFunctionReference<"mutation">("timbre_calls:purgeCall");
const purgeMessageRef = makeFunctionReference<"mutation">(
  "timbre_calls:purgeMessage",
);
const pruneLimitRef = makeFunctionReference<"mutation">(
  "timbre_calls:pruneRateLimit",
);
const pushRef = makeFunctionReference<"action">("timbre_push:deliverCall");
const rtcAuthRef = makeFunctionReference<
  "query",
  { callId: Id<"timbreCalls">; visitorToken?: string },
  { callId: string; role: "visitor" | "owner"; expiresAt: number }
>("timbre_calls:rtcAuthorization");
const rtcClaimRef = makeFunctionReference<
  "mutation",
  { callId: Id<"timbreCalls">; visitorToken?: string },
  null
>("timbre_calls:claimManagedRtcConfiguration");
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

function unavailable(message = "Esta comunicación no está disponible."): never {
  throw new ConvexError({ code: "TIMBRE_UNAVAILABLE", message });
}
function alive(call: Call) {
  return call.status === "ringing" || call.status === "accepted";
}
function expired(call: Call, now = Date.now()) {
  return (
    call.expiresAt <= now ||
    (call.status === "accepted" &&
      (call.visitorSeenAt + TIMBRE_LEASE_MS <= now ||
        (call.ownerSeenAt ?? 0) + TIMBRE_LEASE_MS <= now))
  );
}
function requireLive(call: Call) {
  if (!alive(call) || expired(call)) unavailable("Esta llamada ya terminó.");
}

async function membershipCanReceive(
  ctx: ReadCtx,
  siteId: Id<"timbreSites">,
  userId: Id<"users">,
  unitId?: Id<"timbreUnits">,
) {
  const member = await ctx.db
    .query("timbreMembers")
    .withIndex("by_site_user", (q) =>
      q.eq("siteId", siteId).eq("userId", userId),
    )
    .unique();
  if (!member || !member.canReceive) return false;
  const site = await ctx.db.get("timbreSites", siteId);
  if (!site || (member.role === "owner" && site.ownerId !== userId))
    return false;
  return (
    member.role !== "resident" ||
    (unitId ? member.unitIds.includes(unitId) : site.kind !== "building")
  );
}

async function checkCallEntitlement(ctx: ReadCtx, call: Call) {
  const site = await ctx.db.get("timbreSites", call.siteId);
  const qr = await ctx.db.get("timbreQrs", call.qrId);
  if (
    !site?.enabled ||
    !qr?.enabled ||
    qr.revokedAt ||
    qr.siteId !== call.siteId
  )
    unavailable();
  if (call.unitId) {
    const unit = await ctx.db.get("timbreUnits", call.unitId);
    if (!unit?.enabled || unit.siteId !== site._id) unavailable();
  }
  const entitlement = await requireActiveTimbreLicense(ctx, site);
  const features = effectiveTimbreFeatures(site, entitlement.features);
  if (!features[call.mode]) unavailable("Esta modalidad no está habilitada.");
  return { site, features };
}

async function participant(
  ctx: ReadCtx,
  args: { callId: Id<"timbreCalls">; visitorToken?: string },
  options: { cleanup?: boolean; ownerWinner?: boolean } = {},
) {
  const call = await ctx.db.get("timbreCalls", args.callId);
  if (!call) unavailable();
  let role: "visitor" | "owner";
  let userId: Id<"users"> | undefined;
  if (args.visitorToken !== undefined) {
    if (
      !/^[a-f0-9]{64}$/.test(args.visitorToken) ||
      (await hashCapability(args.visitorToken)) !== call.visitorTokenHash
    )
      unavailable();
    if (!options.cleanup && call.expiresAt + 5 * MINUTE <= Date.now())
      unavailable("La sesión de visitante venció.");
    role = "visitor";
  } else {
    const user = await requireCurrentUser(ctx);
    userId = user._id;
    if (!(options.cleanup && call.acceptedBy === user._id)) {
      await requireSiteMember(ctx, call.siteId);
      const recipient = await ctx.db
        .query("timbreCallRecipients")
        .withIndex("by_call_user", (q) =>
          q.eq("callId", call._id).eq("userId", user._id),
        )
        .unique();
      if (
        !recipient ||
        !(await membershipCanReceive(ctx, call.siteId, user._id, call.unitId))
      )
        unavailable();
    }
    if (
      options.ownerWinner &&
      call.status === "accepted" &&
      call.acceptedBy !== user._id
    )
      unavailable("Otra persona atendió esta llamada.");
    role = "owner";
  }
  const entitlement = options.cleanup
    ? null
    : await checkCallEntitlement(ctx, call);
  return { call, role, userId, ...entitlement };
}

async function rateLimit(
  ctx: MutationCtx,
  key: string,
  maximum: number,
  windowMs: number,
  cooldownMs = 0,
) {
  const now = Date.now();
  const record = await ctx.db
    .query("timbreCallRateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (
    record &&
    (now - record.lastAt < cooldownMs ||
      (now - record.windowStart < windowMs && record.count >= maximum))
  )
    unavailable("Esperá un momento antes de volver a intentar.");
  const fields = {
    key,
    windowStart:
      record && now - record.windowStart < windowMs ? record.windowStart : now,
    count: record && now - record.windowStart < windowMs ? record.count + 1 : 1,
    lastAt: now,
    expiresAt: now + DAY,
  };
  if (record) await ctx.db.patch("timbreCallRateLimits", record._id, fields);
  else {
    const id = await ctx.db.insert("timbreCallRateLimits", fields);
    await ctx.scheduler.runAfter(DAY, pruneLimitRef, { id });
  }
}

async function visitorGuard(
  ctx: MutationCtx,
  siteId: Id<"timbreSites">,
  qrId: Id<"timbreQrs">,
  nonce: string,
  kind: string,
) {
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(nonce))
    unavailable("Recargá la página para iniciar la comunicación.");
  // Bound to the site, preventing the nonce from correlating visitors across homes.
  const nonceHash = await hashCapability(`${siteId}:${nonce}`);
  const block = await ctx.db
    .query("timbreVisitorBlocks")
    .withIndex("by_site_nonce", (q) =>
      q.eq("siteId", siteId).eq("nonceHash", nonceHash),
    )
    .unique();
  if (block && block.expiresAt > Date.now()) unavailable();
  // QR-wide limits remain effective when an abusive client rotates its nonce.
  // A Convex mutation has no trusted source IP; do not claim IP-based protection.
  await rateLimit(ctx, `${kind}:qr:${qrId}`, 6, MINUTE, 3_000);
  await rateLimit(
    ctx,
    `${kind}:visitor:${qrId}:${nonceHash}`,
    3,
    MINUTE,
    10_000,
  );
  return nonceHash;
}

async function addRecipients(
  ctx: MutationCtx,
  call: Pick<Call, "_id" | "siteId" | "unitId">,
  ids: Id<"users">[],
  wave: "primary" | "fallback",
) {
  let count = 0;
  for (const userId of [...new Set(ids)].slice(0, 50)) {
    if (!(await membershipCanReceive(ctx, call.siteId, userId, call.unitId)))
      continue;
    const exists = await ctx.db
      .query("timbreCallRecipients")
      .withIndex("by_call_user", (q) =>
        q.eq("callId", call._id).eq("userId", userId),
      )
      .unique();
    if (!exists) {
      await ctx.db.insert("timbreCallRecipients", {
        callId: call._id,
        userId,
        wave,
        createdAt: Date.now(),
      });
      count++;
    }
  }
  return count;
}

async function finish(
  ctx: MutationCtx,
  call: Call,
  status: "ended" | "rejected" | "missed" | "cancelled",
  reason: string,
) {
  if (!alive(call)) return;
  await ctx.db.patch("timbreCalls", call._id, {
    status,
    endedAt: Date.now(),
    reason,
  });
  await ctx.scheduler.runAfter(0, pushRef, {
    callId: call._id,
    kind: "cancel",
  });
  if (call.acceptedBy) await endTimbrePresence(ctx, call.acceptedBy, call._id);
  const site = await ctx.db.get("timbreSites", call.siteId);
  if (site) await endTimbreRingPresence(ctx, site.ownerId, call._id);
  await ctx.db.insert("timbreAuditEvents", {
    siteId: call.siteId,
    action: `call_${status}`,
    targetId: call._id,
    createdAt: Date.now(),
  });
  // SDP and ICE contain network information. Remove immediately on completion;
  // message bodies expire in 30 days; metadata/history in 90 days.
  for (const signal of await ctx.db
    .query("timbreSignals")
    .withIndex("by_call", (q) => q.eq("callId", call._id))
    .take(256))
    await ctx.db.delete("timbreSignals", signal._id);
  await ctx.scheduler.runAfter(90 * DAY, purgeRef, { callId: call._id });
}

export const rtcAvailability = query({
  args: { qrToken: v.string() },
  handler: async (ctx, { qrToken }) => {
    await resolvePublicQr(ctx, qrToken);
    return { available: timbreTurnProviderConfiguration(process.env) !== null };
  },
});

export const startCall = mutation({
  args: {
    qrToken: v.string(),
    mode: timbreCallMode,
    unitId: v.optional(v.id("timbreUnits")),
    visitorNonce: v.string(),
    portalToken: v.optional(v.string()),
    templateId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { qr, site, unit, effectiveFeatures, availability } =
      await resolvePublicQr(ctx, args.qrToken, args.unitId);
    if (Boolean(args.portalToken) !== Boolean(args.templateId)) unavailable("Revisá el motivo de la visita.");
    const visitorReason = args.portalToken && args.templateId
      ? await teavisoPortalReason(ctx, args.portalToken, args.templateId, qr._id)
      : {};
    if (!availability.available)
      unavailable(
        site.absenceMessage || "El Timbre no está atendiendo en este momento.",
      );
    if (!effectiveFeatures[args.mode])
      unavailable("Esta modalidad no está habilitada.");
    if (site.kind === "building" && !unit) unavailable("Elegí una unidad.");
    if (args.mode !== "chat" && !timbreTurnProviderConfiguration(process.env))
      unavailable(
        "Las llamadas todavía no están habilitadas. Falta configurar el servicio de conexión.",
      );
    const nonceHash = await visitorGuard(
      ctx,
      site._id,
      qr._id,
      args.visitorNonce,
      "call",
    );
    const recent = await ctx.db
      .query("timbreCalls")
      .withIndex("by_qr_created", (q) =>
        q.eq("qrId", qr._id).gte("createdAt", Date.now() - TIMBRE_CALL_MS),
      )
      .order("desc")
      .take(100);
    if (
      recent.filter((call) => alive(call) && !expired(call)).length >= 2 ||
      recent.some(
        (call) =>
          call.visitorNonceHash === nonceHash && alive(call) && !expired(call),
      )
    )
      unavailable(
        "Este Timbre ya está recibiendo una llamada. Intentá más tarde.",
      );
    const visitorToken = randomCapability();
    const now = Date.now(),
      expiresAt = now + TIMBRE_RING_MS;
    const callId = await ctx.db.insert("timbreCalls", {
      siteId: site._id,
      qrId: qr._id,
      ...(unit ? { unitId: unit._id } : {}),
      mode: args.mode,
      status: "ringing",
      visitorTokenHash: await hashCapability(visitorToken),
      visitorNonceHash: nonceHash,
      ...visitorReason,
      createdAt: now,
      expiresAt,
      visitorSeenAt: now,
    });
    const count = await addRecipients(
      ctx,
      { _id: callId, siteId: site._id, unitId: unit?._id },
      unit ? unit.recipientIds : site.recipientIds,
      "primary",
    );
    if (!count)
      unavailable("No hay destinatarios disponibles para este Timbre.");
    if (site.ringStatusId)
      await beginTimbreRingPresence(
        ctx,
        site.ownerId,
        callId,
        site.ringStatusId,
      );
    await ctx.scheduler.runAfter(0, pushRef, {
      callId,
      kind: "incoming",
      wave: "primary",
    });
    await ctx.scheduler.runAfter(TIMBRE_RING_MS, expireRef, { callId });
    if (site.fallbackRecipientIds?.length)
      await ctx.scheduler.runAfter(
        Math.max(5_000, Math.min(75_000, site.fallbackAfterSeconds * 1000)),
        fallbackRef,
        { callId },
      );
    await ctx.db.insert("timbreAuditEvents", {
      siteId: site._id,
      action: "call_ringing",
      targetId: callId,
      createdAt: now,
    });
    return { callId, visitorToken, status: "ringing" as const, expiresAt };
  },
});

export const session = query({
  args: sessionArgs,
  handler: async (ctx, args) => {
    const { call, role, userId, site, features } = await participant(ctx, args);
    return {
      callId: call._id,
      siteName: site!.name + (call.visitorLabel ? ` · ${call.visitorLabel}` : ""),
      visitorLabel:call.visitorLabel, visitorMessage:call.visitorMessage,
      mode: call.mode,
      status: alive(call) && expired(call) ? ("ended" as const) : call.status,
      role,
      acceptedByMe: role === "owner" && call.acceptedBy === userId,
      expiresAt: call.expiresAt,
      chatEnabled: features!.chat,
      messagesEnabled: features!.messages,
    };
  },
});

export const accept = mutation({
  args: { callId: v.id("timbreCalls") },
  handler: async (ctx, args) => {
    const { call, userId, site } = await participant(ctx, args);
    requireLive(call);
    if (call.status !== "ringing")
      unavailable("Otra persona atendió esta llamada.");
    const recipient = await ctx.db
      .query("timbreCallRecipients")
      .withIndex("by_call_user", (q) =>
        q.eq("callId", call._id).eq("userId", userId!),
      )
      .unique();
    if (recipient?.rejectedAt) unavailable("Ya rechazaste esta llamada.");
    const now = Date.now();
    // Convex mutations serialize conflicts: exactly one invited member can win.
    await ctx.db.patch("timbreCalls", call._id, {
      status: "accepted",
      acceptedBy: userId,
      acceptedAt: now,
      visitorSeenAt: now,
      ownerSeenAt: now,
      expiresAt: now + TIMBRE_CALL_MS,
    });
    // Register the accepted source before removing the ringing source to avoid
    // briefly restoring a baseline color between two events in the same call.
    if (site!.signalStatusOnAccept !== false)
      await beginTimbrePresence(ctx, userId!, call._id);
    await endTimbreRingPresence(ctx, site!.ownerId, call._id);
    await ctx.scheduler.runAfter(0, pushRef, {
      callId: call._id,
      kind: "cancel",
    });
    await ctx.scheduler.runAfter(TIMBRE_LEASE_MS, expireRef, {
      callId: call._id,
    });
    return { accepted: true };
  },
});

export const reject = mutation({
  args: { callId: v.id("timbreCalls") },
  handler: async (ctx, args) => {
    const { call, userId, site } = await participant(ctx, args);
    requireLive(call);
    if (call.status !== "ringing") unavailable("La llamada ya fue atendida.");
    const recipient = await ctx.db
      .query("timbreCallRecipients")
      .withIndex("by_call_user", (q) =>
        q.eq("callId", call._id).eq("userId", userId!),
      )
      .unique();
    await ctx.db.patch("timbreCallRecipients", recipient!._id, {
      rejectedAt: Date.now(),
    });
    const remaining = (
      await ctx.db
        .query("timbreCallRecipients")
        .withIndex("by_call", (q) => q.eq("callId", call._id))
        .collect()
    ).filter((r) => !r.rejectedAt);
    if (!remaining.length && !site!.fallbackRecipientIds?.length)
      await finish(ctx, call, "rejected", "recipients_rejected");
    return { rejected: true };
  },
});

export const end = mutation({
  args: sessionArgs,
  handler: async (ctx, args) => {
    // Cleanup remains possible after license/QR revocation; it grants no further
    // media, messaging, access or TURN credentials.
    const { call, role, userId } = await participant(ctx, args, {
      cleanup: true,
    });
    if (
      call.status === "accepted" &&
      role === "owner" &&
      call.acceptedBy !== userId
    )
      unavailable("Otra persona atendió esta llamada.");
    await finish(
      ctx,
      call,
      call.status === "ringing" && role === "visitor" ? "cancelled" : "ended",
      "participant_ended",
    );
    return { ended: true };
  },
});

export const heartbeat = mutation({
  args: sessionArgs,
  handler: async (ctx, args) => {
    const { call, role, userId } = await participant(ctx, args, {
      cleanup: true,
    });
    if (!alive(call)) return { status: call.status };
    try {
      await checkCallEntitlement(ctx, call);
      if (
        role === "owner" &&
        !(await membershipCanReceive(ctx, call.siteId, userId!, call.unitId))
      )
        unavailable();
    } catch {
      await finish(ctx, call, "ended", "access_revoked");
      return { status: "ended" as const };
    }
    if (expired(call)) {
      await finish(
        ctx,
        call,
        call.status === "ringing" ? "missed" : "ended",
        "session_expired",
      );
      return { status: "ended" as const };
    }
    if (
      call.status === "accepted" &&
      role === "owner" &&
      call.acceptedBy !== userId
    )
      unavailable("Otra persona atendió esta llamada.");
    await ctx.db.patch(
      "timbreCalls",
      call._id,
      role === "visitor"
        ? { visitorSeenAt: Date.now() }
        : { ownerSeenAt: Date.now() },
    );
    return { status: call.status };
  },
});

export const incoming = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const rows = await ctx.db
      .query("timbreCallRecipients")
      .withIndex("by_user_created", (q) =>
        q.eq("userId", user._id).gte("createdAt", Date.now() - TIMBRE_CALL_MS),
      )
      .order("desc")
      .take(50);
    const result = [];
    for (const row of rows) {
      const call = await ctx.db.get("timbreCalls", row.callId);
      if (
        !call ||
        !alive(call) ||
        expired(call) ||
        row.rejectedAt ||
        (call.acceptedBy && call.acceptedBy !== user._id)
      )
        continue;
      if (
        !(await membershipCanReceive(ctx, call.siteId, user._id, call.unitId))
      )
        continue;
      try {
        const { site } = await checkCallEntitlement(ctx, call);
        result.push({
          callId: call._id,
          siteId: site._id,
          siteName: site.name + (call.visitorLabel ? ` · ${call.visitorLabel}` : ""),
          visitorLabel:call.visitorLabel, visitorMessage:call.visitorMessage,
          mode: call.mode,
          status: call.status,
          createdAt: call.createdAt,
          expiresAt: call.expiresAt,
          notificationsEnabled: site.notificationsEnabled,
        });
      } catch {
        /* Revoked/expired licenses are never represented as incoming. */
      }
    }
    return result;
  },
});

export const history = query({
  args: { siteId: v.id("timbreSites") },
  handler: async (ctx, { siteId }) => {
    const { site, membership, user } = await requireSiteMember(ctx, siteId);
    await requireActiveTimbreLicense(ctx, site);
    const rows = await ctx.db
      .query("timbreCalls")
      .withIndex("by_site_created", (q) =>
        q.eq("siteId", siteId).gte("createdAt", Date.now() - 90 * DAY),
      )
      .order("desc")
      .take(100);
    return rows
      .filter(
        (call) =>
          membership.role !== "resident" ||
          (call.unitId
            ? membership.unitIds.includes(call.unitId)
            : site.kind !== "building"),
      )
      .map((call) => ({
        callId: call._id,
        unitId: call.unitId,
        mode: call.mode,
        status: call.status,
        createdAt: call.createdAt,
        acceptedAt: call.acceptedAt,
        endedAt: call.endedAt,
        acceptedByMe: call.acceptedBy === user._id,
      }));
  },
});

export const signals = query({
  args: sessionArgs,
  handler: async (ctx, args) => {
    const { call, role, userId } = await participant(ctx, args);
    // A subscription can observe the terminal transition before the UI unmounts.
    // Return no network information to the losing recipient or a finished call.
    if (
      call.status !== "accepted" ||
      expired(call) ||
      call.mode === "chat" ||
      (role === "owner" && call.acceptedBy !== userId)
    )
      return [];
    return (
      await ctx.db
        .query("timbreSignals")
        .withIndex("by_call", (q) => q.eq("callId", call._id))
        .take(256)
    )
      .filter((signal) => signal.from !== role)
      .map((signal) => ({
        id: signal._id,
        kind: signal.kind,
        payload: signal.payload,
        from: signal.from,
      }));
  },
});

export const sendSignal = mutation({
  args: { ...sessionArgs, kind: timbreSignalKind, payload: v.string() },
  handler: async (ctx, args) => {
    const { call, role } = await participant(ctx, args, {
      ownerWinner: !args.visitorToken,
    });
    requireLive(call);
    if (call.status !== "accepted" || call.mode === "chat") unavailable();
    if (
      (args.kind === "offer" && role !== "visitor") ||
      (args.kind === "answer" && role !== "owner")
    )
      unavailable("La señal no corresponde a este participante.");
    try {
      validateSignal(args.kind, args.payload);
    } catch {
      unavailable("Señal de llamada inválida.");
    }
    const existing = await ctx.db
      .query("timbreSignals")
      .withIndex("by_call", (q) => q.eq("callId", call._id))
      .take(256);
    if (existing.length >= 256)
      unavailable("Se alcanzó el límite de conexión de esta llamada.");
    if (
      args.kind !== "ice" &&
      existing.some((signal) => signal.kind === args.kind)
    )
      unavailable("Esta señal ya fue enviada.");
    if (
      args.kind === "answer" &&
      !existing.some((signal) => signal.kind === "offer")
    )
      unavailable("Falta la oferta de conexión.");
    await ctx.db.insert("timbreSignals", {
      callId: call._id,
      from: role,
      kind: args.kind,
      payload: args.payload,
      createdAt: Date.now(),
    });
  },
});

export const rtcAuthorization = internalQuery({
  args: sessionArgs,
  handler: async (ctx, args) => {
    const { call, role } = await participant(ctx, args, {
      ownerWinner: !args.visitorToken,
    });
    requireLive(call);
    if (call.status !== "accepted" || call.mode === "chat") unavailable();
    return { callId: call._id, role, expiresAt: call.expiresAt };
  },
});

export const claimManagedRtcConfiguration = internalMutation({
  args: sessionArgs,
  handler: async (ctx, args) => {
    const { call, role } = await participant(ctx, args, {
      ownerWinner: !args.visitorToken,
    });
    requireLive(call);
    if (call.status !== "accepted" || call.mode === "chat") unavailable();
    // One public call capability cannot issue unlimited provider requests.
    // Reuse the existing transactional limiter instead of client-side counters.
    await rateLimit(ctx, `rtc:${call._id}:${role}`, 3, MINUTE, 5_000);
    return null;
  },
});

export const getRtcConfiguration = action({
  args: sessionArgs,
  handler: async (ctx, args) => {
    const authorization = await ctx.runQuery(rtcAuthRef, args);
    const config = timbreTurnProviderConfiguration(process.env);
    if (!config) unavailable("El servicio de conexión no está configurado.");
    if (config.provider === "cloudflare") {
      await ctx.runMutation(rtcClaimRef, args);
      let credentials;
      try {
        credentials = await createCloudflareTurnCredentials(
          config,
          Date.now(),
          authorization.expiresAt,
        );
      } catch {
        unavailable(
          "No pudimos conectar con el servicio de llamadas. Intentá nuevamente.",
        );
      }
      // A call, member, QR or license may be revoked while the provider is slow.
      // Never return newly minted credentials after that access is withdrawn.
      const current = await ctx.runQuery(rtcAuthRef, args);
      if (
        current.expiresAt !== authorization.expiresAt ||
        current.role !== authorization.role
      )
        unavailable();
      return credentials;
    }
    return await createTurnCredentials(
      config,
      `${authorization.callId}:${authorization.role}`,
      Date.now(),
      authorization.expiresAt,
    );
  },
});

function validMessage(text: string) {
  const clean = text.trim();
  if (
    !clean ||
    clean.length > 2_000 ||
    Array.from(clean).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 && code !== 9 && code !== 10 && code !== 13;
    })
  )
    unavailable("Escribí un mensaje de hasta 2000 caracteres.");
  return clean;
}

export const chat = query({
  args: sessionArgs,
  handler: async (ctx, args) => {
    const { call, features, role, userId } = await participant(ctx, args);
    if (!features!.chat) unavailable("El chat no está habilitado.");
    if (role === "owner" && call.acceptedBy && call.acceptedBy !== userId)
      return [];
    return (
      await ctx.db
        .query("timbreMessages")
        .withIndex("by_call", (q) => q.eq("callId", call._id))
        .order("asc")
        .take(100)
    ).map((message) => ({
      id: message._id,
      from: message.from,
      text: message.text,
      createdAt: message.createdAt,
    }));
  },
});

export const sendMessage = mutation({
  args: { ...sessionArgs, text: v.string() },
  handler: async (ctx, args) => {
    const { call, role, features } = await participant(ctx, args, {
      ownerWinner: !args.visitorToken,
    });
    requireLive(call);
    if (!features!.chat || call.status !== "accepted")
      unavailable("El chat no está habilitado para esta llamada.");
    const text = validMessage(args.text);
    await rateLimit(ctx, `chat:${call._id}:${role}`, 20, MINUTE, 500);
    if (
      (
        await ctx.db
          .query("timbreMessages")
          .withIndex("by_call", (q) => q.eq("callId", call._id))
          .take(100)
      ).length >= 100
    )
      unavailable("Se alcanzó el límite de mensajes.");
    const id = await ctx.db.insert("timbreMessages", {
      siteId: call.siteId,
      unitId: call.unitId,
      callId: call._id,
      from: role,
      kind: "chat",
      text,
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(30 * DAY, purgeMessageRef, { id });
    return { sent: true };
  },
});

export const leaveMessage = mutation({
  args: {
    qrToken: v.string(),
    unitId: v.optional(v.id("timbreUnits")),
    visitorNonce: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const { qr, site, unit, effectiveFeatures } = await resolvePublicQr(
      ctx,
      args.qrToken,
      args.unitId,
    );
    if (!effectiveFeatures.messages)
      unavailable("Este Timbre no recibe mensajes.");
    if (site.kind === "building" && !unit) unavailable("Elegí una unidad.");
    const text = validMessage(args.text);
    await visitorGuard(ctx, site._id, qr._id, args.visitorNonce, "message");
    const id = await ctx.db.insert("timbreMessages", {
      siteId: site._id,
      ...(unit ? { unitId: unit._id } : {}),
      from: "visitor",
      kind: "message",
      text,
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(30 * DAY, purgeMessageRef, { id });
    return { sent: true };
  },
});

export const messages = query({
  args: { siteId: v.id("timbreSites") },
  handler: async (ctx, { siteId }) => {
    const { site, membership } = await requireSiteMember(ctx, siteId);
    const { features } = await requireActiveTimbreLicense(ctx, site);
    if (!features.messages || !site.messagesEnabled) unavailable();
    return (
      await ctx.db
        .query("timbreMessages")
        .withIndex("by_site_created", (q) =>
          q.eq("siteId", siteId).gte("createdAt", Date.now() - 30 * DAY),
        )
        .order("desc")
        .take(100)
    )
      .filter(
        (message) =>
          message.kind === "message" &&
          (membership.role !== "resident" ||
            (message.unitId
              ? membership.unitIds.includes(message.unitId)
              : site.kind !== "building")),
      )
      .map((message) => ({
        id: message._id,
        unitId: message.unitId,
        text: message.text,
        createdAt: message.createdAt,
      }));
  },
});

export const blockVisitor = mutation({
  args: { callId: v.id("timbreCalls") },
  handler: async (ctx, { callId }) => {
    const { call } = await participant(ctx, { callId });
    const existing = await ctx.db
      .query("timbreVisitorBlocks")
      .withIndex("by_site_nonce", (q) =>
        q.eq("siteId", call.siteId).eq("nonceHash", call.visitorNonceHash),
      )
      .unique();
    const fields = {
      siteId: call.siteId,
      nonceHash: call.visitorNonceHash,
      expiresAt: Date.now() + 30 * DAY,
      createdAt: Date.now(),
    };
    if (existing)
      await ctx.db.patch("timbreVisitorBlocks", existing._id, fields);
    else await ctx.db.insert("timbreVisitorBlocks", fields);
    await finish(ctx, call, "rejected", "visitor_blocked");
    return { blocked: true };
  },
});

export const expireCall = internalMutation({
  args: { callId: v.id("timbreCalls") },
  handler: async (ctx, { callId }) => {
    const call = await ctx.db.get("timbreCalls", callId);
    if (!call || !alive(call)) return;
    try {
      await checkCallEntitlement(ctx, call);
      if (
        call.acceptedBy &&
        !(await membershipCanReceive(
          ctx,
          call.siteId,
          call.acceptedBy,
          call.unitId,
        ))
      )
        unavailable();
    } catch {
      await finish(ctx, call, "ended", "access_revoked");
      return;
    }
    if (expired(call)) {
      await finish(
        ctx,
        call,
        call.status === "ringing" ? "missed" : "ended",
        "session_expired",
      );
      return;
    }
    const next =
      call.status === "accepted"
        ? Math.min(
            call.expiresAt,
            call.visitorSeenAt + TIMBRE_LEASE_MS,
            (call.ownerSeenAt ?? 0) + TIMBRE_LEASE_MS,
          )
        : call.expiresAt;
    await ctx.scheduler.runAfter(
      Math.max(1_000, next - Date.now()),
      expireRef,
      { callId },
    );
  },
});

export const notifyFallback = internalMutation({
  args: { callId: v.id("timbreCalls") },
  handler: async (ctx, { callId }) => {
    const call = await ctx.db.get("timbreCalls", callId);
    if (!call || call.status !== "ringing" || expired(call)) return;
    let site;
    try {
      ({ site } = await checkCallEntitlement(ctx, call));
    } catch {
      await finish(ctx, call, "ended", "access_revoked");
      return;
    }
    if (site.fallbackRecipientIds?.length) {
      const added = await addRecipients(
        ctx,
        call,
        site.fallbackRecipientIds,
        "fallback",
      );
      if (added)
        await ctx.scheduler.runAfter(0, pushRef, {
          callId,
          kind: "incoming",
          wave: "fallback",
        });
    }
  },
});

export const purgeMessage = internalMutation({
  args: { id: v.id("timbreMessages") },
  handler: async (ctx, { id }) => {
    const message = await ctx.db.get("timbreMessages", id);
    if (message && message.createdAt <= Date.now() - 30 * DAY)
      await ctx.db.delete("timbreMessages", id);
  },
});
export const purgeCall = internalMutation({
  args: { callId: v.id("timbreCalls") },
  handler: async (ctx, { callId }) => {
    const call = await ctx.db.get("timbreCalls", callId);
    if (
      !call ||
      alive(call) ||
      (call.endedAt ?? call.createdAt) > Date.now() - 90 * DAY
    )
      return;
    for (const recipient of await ctx.db
      .query("timbreCallRecipients")
      .withIndex("by_call", (q) => q.eq("callId", callId))
      .take(100))
      await ctx.db.delete("timbreCallRecipients", recipient._id);
    for (const signal of await ctx.db
      .query("timbreSignals")
      .withIndex("by_call", (q) => q.eq("callId", callId))
      .take(256))
      await ctx.db.delete("timbreSignals", signal._id);
    await ctx.db.delete("timbreCalls", callId);
  },
});
export const pruneRateLimit = internalMutation({
  args: { id: v.id("timbreCallRateLimits") },
  handler: async (ctx, { id }) => {
    const record = await ctx.db.get("timbreCallRateLimits", id);
    if (!record) return;
    if (record.expiresAt <= Date.now())
      await ctx.db.delete("timbreCallRateLimits", id);
    else
      await ctx.scheduler.runAfter(
        record.expiresAt - Date.now(),
        pruneLimitRef,
        { id },
      );
  },
});
