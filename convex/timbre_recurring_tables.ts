import { defineTable } from "convex/server";
import { v } from "convex/values";

export const timbreRecurringTables = {
  timbreRecurringEvents: defineTable({
    key: v.string(), status: v.union(v.literal("processing"), v.literal("done")), leaseUntil: v.number(),
    expiresAt: v.number(), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_key", ["key"]),
  timbreSubscriptionPeriods: defineTable({
    subscriptionId: v.id("timbreSubscriptions"), invoiceId: v.string(), paymentId: v.string(),
    startsAt: v.number(), endsAt: v.number(), amount: v.number(), currency: v.string(),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"), v.literal("cancelled"), v.literal("refunded"), v.literal("charged_back")),
    paidAt: v.optional(v.number()), verifiedAt: v.number(), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_subscription", ["subscriptionId"]).index("by_invoice", ["invoiceId"]).index("by_payment", ["paymentId"]),
};
