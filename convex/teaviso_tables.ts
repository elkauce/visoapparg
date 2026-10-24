import { defineTable } from "convex/server";
import { v } from "convex/values";
export const businessStatus = v.union(
  v.literal("requested"),
  v.literal("awaiting_payment"),
  v.literal("paid"),
  v.literal("configuring"),
  v.literal("active"),
  v.literal("cancelled"),
);
export const teavisoTables = {
  teavisoWhatsappQrs: defineTable({
    ownerId: v.id("users"),
    label: v.string(),
    phone: v.string(),
    message: v.string(),
    token: v.string(),
    enabled: v.boolean(),
    archived: v.boolean(),
    consentAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_token", ["token"]),
  teavisoBusinessSettings: defineTable({
    key: v.literal("business"),
    enabled: v.boolean(),
    priceAmount: v.number(),
    currency: v.literal("ARS"),
    terms: v.string(),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
  teavisoBusinessRequests: defineTable({
    ownerId: v.id("users"),
    businessName: v.string(),
    contactPhone: v.string(),
    notes: v.string(),
    status: businessStatus,
    enabled: v.boolean(),
    token: v.string(),
    assignedPhone: v.optional(v.string()),
    message: v.string(),
    orderId: v.optional(v.id("marketplaceOrders")),
    priceAmount: v.optional(v.number()),
    terms: v.optional(v.string()),
    acceptedAt: v.optional(v.number()),
    adminNotes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_order", ["orderId"])
    .index("by_assigned_phone", ["assignedPhone"])
    .index("by_token", ["token"]),
};
