import { defineTable } from "convex/server";
import { v } from "convex/values";

export const timbrePushTables = {
  timbrePushDevices: defineTable({
    userId: v.id("users"), sessionId: v.id("authSessions"), deviceId: v.string(), token: v.string(), tokenHash: v.string(),
    enabled: v.boolean(), createdAt: v.number(), updatedAt: v.number(), lastSeenAt: v.number(),
  }).index("by_user_device", ["userId", "deviceId"]).index("by_user", ["userId"])
    .index("by_token_hash", ["tokenHash"]),
  // Idempotent per event and physical installation. No message body or user PII.
  timbrePushDeliveries: defineTable({
    callId: v.id("timbreCalls"), deviceId: v.id("timbrePushDevices"),
    kind: v.union(v.literal("incoming"), v.literal("cancel")),
    state: v.union(v.literal("sending"), v.literal("sent"), v.literal("failed")),
    attemptedAt: v.number(), expiresAt: v.number(),
  }).index("by_call_device_kind", ["callId", "deviceId", "kind"])
    .index("by_expires", ["expiresAt"]),
};
