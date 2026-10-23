import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { setActiveStatus } from "./activate_status";
import { findVisoStatus, VISO_STATES } from "./viso_preset_states";

export type PresenceSourceKind =
  "telephone" | "meeting" | "timbre" | "timbre-ring";
export const FOREGROUND_PRESENCE_LEASE_MS = 90_000;
export const TELEPHONE_PRESENCE_LEASE_MS = 90_000;
// Accepted calls also have a bounded recovery lease if call cleanup is interrupted.
export const TIMBRE_PRESENCE_LEASE_MS = 2 * 60 * 60 * 1_000;
export const TIMBRE_RING_PRESENCE_LEASE_MS = 90_000;
const priority: Record<PresenceSourceKind, number> = {
  telephone: 3,
  timbre: 3,
  "timbre-ring": 2,
  meeting: 1,
};
const expireSource = makeFunctionReference<"mutation">(
  "timbre_presence:expireSource",
);

async function sourcesFor(ctx: MutationCtx, userId: Id<"users">) {
  return ctx.db
    .query("presenceSources")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
}

/** Only coordinator writes advance appliedRevision. Any other revision is a manual
 * intervention, including selecting the same state or deleting the active state. */
async function reconcile(ctx: MutationCtx, userId: Id<"users">) {
  const user = await ctx.db.get("users", userId);
  const arbiter = await ctx.db
    .query("presenceArbiters")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (!user || !arbiter) return;
  const suppressed =
    arbiter.suppressed ||
    (user.activeStatusRevision ?? 0) !== arbiter.appliedRevision;
  const sources = await sourcesFor(ctx, userId);
  const live: Doc<"presenceSources">[] = [];
  for (const source of sources) {
    const status = await ctx.db.get("statuses", source.statusId);
    if (source.expiresAt <= Date.now() || status?.userId !== userId) {
      await ctx.db.delete("presenceSources", source._id);
    } else live.push(source);
  }
  // Calls take precedence over calendar events. Equal priority sources share the
  // oldest live call, so duplicate accepts/heartbeats cannot cause light flicker.
  live.sort(
    (a, b) =>
      priority[b.kind] - priority[a.kind] ||
      a._creationTime - b._creationTime ||
      a.sourceKey.localeCompare(b.sourceKey),
  );
  let target: Id<"statuses"> | null = live[0]?.statusId ?? null;
  if (!live.length) {
    const baseline = arbiter.baselineStatusId
      ? await ctx.db.get("statuses", arbiter.baselineStatusId)
      : null;
    target = baseline?.userId === userId ? baseline._id : null;
  }
  if (!suppressed && (user.activeStatusId ?? null) !== target)
    await setActiveStatus(ctx, userId, target);
  if (!live.length) {
    await ctx.db.delete("presenceArbiters", arbiter._id);
  } else {
    const current = await ctx.db.get("users", userId);
    await ctx.db.patch("presenceArbiters", arbiter._id, {
      suppressed,
      appliedRevision: current?.activeStatusRevision ?? 0,
    });
  }
}

export async function setPresenceSource(
  ctx: MutationCtx,
  userId: Id<"users">,
  source: {
    sourceKey: string;
    kind: PresenceSourceKind;
    statusId: Id<"statuses">;
    expiresAt: number;
  },
) {
  const user = await ctx.db.get("users", userId);
  const status = await ctx.db.get("statuses", source.statusId);
  if (!user || status?.userId !== userId) return;
  const arbiter = await ctx.db
    .query("presenceArbiters")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (!arbiter) {
    // Adopt a telephone episode that was already running when this server was
    // upgraded. The old native APK keeps the same capability and HTTP contract.
    const phones = (
      await ctx.db
        .query("presenceDevices")
        .withIndex("by_owner", (q) => q.eq("userId", userId))
        .collect()
    ).filter(
      (device) =>
        device.enabled &&
        device.calling &&
        device.appliedRevision !== undefined &&
        device.expires > Date.now() &&
        (device.lastSeen ?? 0) > Date.now() - TELEPHONE_PRESENCE_LEASE_MS,
    );
    const owner = phones.find(
      (device) =>
        !device.suppressed &&
        device.appliedRevision === (user.activeStatusRevision ?? 0),
    );
    await ctx.db.insert("presenceArbiters", {
      userId,
      baselineStatusId: owner ? owner.previous : user.activeStatusId,
      appliedRevision: user.activeStatusRevision ?? 0,
      suppressed: phones.length > 0 && !owner,
    });
    for (const phone of phones) {
      const sourceKey = `phone:${phone._id}`;
      const existing = await ctx.db
        .query("presenceSources")
        .withIndex("by_user_source", (q) =>
          q.eq("userId", userId).eq("sourceKey", sourceKey),
        )
        .unique();
      if (!existing) {
        const statusId = await getAutomaticPresenceStatus(
          ctx,
          userId,
          "telephone",
        );
        const expiresAt =
          (phone.lastSeen ?? Date.now()) + TELEPHONE_PRESENCE_LEASE_MS;
        await ctx.db.insert("presenceSources", {
          userId,
          sourceKey,
          kind: "telephone",
          statusId,
          expiresAt,
          updatedAt: Date.now(),
        });
        await ctx.scheduler.runAfter(
          Math.max(0, expiresAt - Date.now()),
          expireSource,
          {
            userId,
            sourceKey,
          },
        );
      }
    }
  }
  const previous = await ctx.db
    .query("presenceSources")
    .withIndex("by_user_source", (q) =>
      q.eq("userId", userId).eq("sourceKey", source.sourceKey),
    )
    .unique();
  const fields = { ...source, userId, updatedAt: Date.now() };
  if (previous) await ctx.db.patch("presenceSources", previous._id, fields);
  else {
    if ((await sourcesFor(ctx, userId)).length >= 64)
      throw new ConvexError({
        code: "RATE_LIMITED",
        message: "Demasiadas señales automáticas simultáneas.",
      });
    await ctx.db.insert("presenceSources", fields);
  }
  // Schedule only the first expiry. The expiry handler reschedules to the most
  // recent lease, avoiding one queued task per native heartbeat.
  if (!previous)
    await ctx.scheduler.runAfter(
      Math.max(0, source.expiresAt - Date.now()),
      expireSource,
      { userId, sourceKey: source.sourceKey },
    );
  await reconcile(ctx, userId);
}

export async function removePresenceSource(
  ctx: MutationCtx,
  userId: Id<"users">,
  sourceKey: string,
) {
  const source = await ctx.db
    .query("presenceSources")
    .withIndex("by_user_source", (q) =>
      q.eq("userId", userId).eq("sourceKey", sourceKey),
    )
    .unique();
  if (source) await ctx.db.delete("presenceSources", source._id);
  await reconcile(ctx, userId);
}

export async function expirePresenceSource(
  ctx: MutationCtx,
  userId: Id<"users">,
  sourceKey: string,
) {
  const source = await ctx.db
    .query("presenceSources")
    .withIndex("by_user_source", (q) =>
      q.eq("userId", userId).eq("sourceKey", sourceKey),
    )
    .unique();
  if (!source) return;
  if (source.expiresAt > Date.now()) {
    await ctx.scheduler.runAfter(source.expiresAt - Date.now(), expireSource, {
      userId,
      sourceKey,
    });
    return;
  }
  await removePresenceSource(ctx, userId, sourceKey);
}

export async function getAutomaticPresenceStatus(
  ctx: MutationCtx,
  userId: Id<"users">,
  kind: "telephone" | "meeting",
) {
  const statuses = await ctx.db
    .query("statuses")
    .withIndex("by_user_and_order", (q) => q.eq("userId", userId))
    .collect();
  const definition = VISO_STATES.find(
    (state) => state.key === (kind === "meeting" ? "reunion" : "llamada"),
  )!;
  const existing = findVisoStatus(definition, statuses);
  return (
    existing?._id ??
    ctx.db.insert("statuses", {
      userId,
      name: definition.name,
      color: definition.defaultColor,
      icon: definition.icon,
      order: statuses.length,
    })
  );
}

/** Called only after the authenticated, authorized call accept transaction. */
export async function beginTimbrePresence(
  ctx: MutationCtx,
  userId: Id<"users">,
  callId: string,
) {
  const statusId = await getAutomaticPresenceStatus(ctx, userId, "telephone");
  await setPresenceSource(ctx, userId, {
    sourceKey: `timbre:${callId}`,
    kind: "timbre",
    statusId,
    expiresAt: Date.now() + TIMBRE_PRESENCE_LEASE_MS,
  });
}

/** Idempotent; ringing, rejection and a second recipient never own this source. */
export async function endTimbrePresence(
  ctx: MutationCtx,
  userId: Id<"users">,
  callId: string,
) {
  await removePresenceSource(ctx, userId, `timbre:${callId}`);
}

/** Explicit site-owner opt-in only. The caller validates the site setting; the
 * arbiter additionally verifies ownership of the chosen signaling status. */
export async function beginTimbreRingPresence(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  callId: string,
  statusId: Id<"statuses">,
) {
  await setPresenceSource(ctx, ownerId, {
    sourceKey: `timbre-ring:${callId}`,
    kind: "timbre-ring",
    statusId,
    expiresAt: Date.now() + TIMBRE_RING_PRESENCE_LEASE_MS,
  });
}

export async function endTimbreRingPresence(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  callId: string,
) {
  await removePresenceSource(ctx, ownerId, `timbre-ring:${callId}`);
}
