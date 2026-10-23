import { defineTable } from "convex/server";
import { v } from "convex/values";

export const timbreCallMode = v.union(
  v.literal("audio"),
  v.literal("video"),
  v.literal("chat"),
);
export const timbreCallStatus = v.union(
  v.literal("ringing"),
  v.literal("accepted"),
  v.literal("ended"),
  v.literal("rejected"),
  v.literal("missed"),
  v.literal("cancelled"),
);
export const timbrePeerRole = v.union(v.literal("visitor"), v.literal("owner"));
export const timbreSignalKind = v.union(
  v.literal("offer"),
  v.literal("answer"),
  v.literal("ice"),
);

export const timbreCallTables = {
  timbreCalls: defineTable({
    siteId: v.id("timbreSites"),
    unitId: v.optional(v.id("timbreUnits")),
    qrId: v.id("timbreQrs"),
    mode: timbreCallMode,
    status: timbreCallStatus,
    visitorTokenHash: v.string(),
    visitorNonceHash: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    visitorSeenAt: v.number(),
    ownerSeenAt: v.optional(v.number()),
    acceptedBy: v.optional(v.id("users")),
    acceptedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    reason: v.optional(v.string()),
  })
    .index("by_site_created", ["siteId", "createdAt"])
    .index("by_qr_created", ["qrId", "createdAt"]),
  timbreCallRecipients: defineTable({
    callId: v.id("timbreCalls"),
    userId: v.id("users"),
    wave: v.union(v.literal("primary"), v.literal("fallback")),
    createdAt: v.number(),
    rejectedAt: v.optional(v.number()),
  })
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_call", ["callId"])
    .index("by_call_user", ["callId", "userId"]),
  timbreSignals: defineTable({
    callId: v.id("timbreCalls"),
    from: timbrePeerRole,
    kind: timbreSignalKind,
    payload: v.string(),
    createdAt: v.number(),
  }).index("by_call", ["callId"]),
  timbreMessages: defineTable({
    siteId: v.id("timbreSites"),
    unitId: v.optional(v.id("timbreUnits")),
    callId: v.optional(v.id("timbreCalls")),
    from: timbrePeerRole,
    kind: v.union(v.literal("chat"), v.literal("message")),
    text: v.string(),
    createdAt: v.number(),
  })
    .index("by_call", ["callId"])
    .index("by_site_created", ["siteId", "createdAt"]),
  timbreCallRateLimits: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
    lastAt: v.number(),
    expiresAt: v.number(),
  }).index("by_key", ["key"]),
  timbreVisitorBlocks: defineTable({
    siteId: v.id("timbreSites"),
    nonceHash: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  }).index("by_site_nonce", ["siteId", "nonceHash"]),
};
