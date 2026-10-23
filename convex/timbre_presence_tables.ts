import { defineTable } from "convex/server";
import { v } from "convex/values";

// One baseline per user, shared by telephone, calendar and accepted Timbre calls.
export const timbrePresenceTables = {
  presenceArbiters: defineTable({
    userId: v.id("users"),
    baselineStatusId: v.optional(v.id("statuses")),
    appliedRevision: v.number(),
    suppressed: v.boolean(),
  }).index("by_user", ["userId"]),
  presenceSources: defineTable({
    userId: v.id("users"),
    sourceKey: v.string(),
    kind: v.union(
      v.literal("telephone"),
      v.literal("meeting"),
      v.literal("timbre"),
      v.literal("timbre-ring"),
    ),
    statusId: v.id("statuses"),
    expiresAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_source", ["userId", "sourceKey"]),
};
