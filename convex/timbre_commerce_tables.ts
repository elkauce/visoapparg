import { defineTable } from "convex/server";
import { v } from "convex/values";
import { timbreQrDesign } from "./timbre_tables";

export const timbreOfferCode = v.union(v.literal("digital"), v.literal("personalizado"), v.literal("hardware"), v.literal("edificios"));
export const timbrePeriod = v.union(v.literal("monthly"), v.literal("yearly"), v.literal("one_time"));
export const timbreFeatures = v.object({
  audio: v.boolean(), video: v.boolean(), chat: v.boolean(), messages: v.boolean(),
  families: v.boolean(), buildings: v.boolean(), offices: v.boolean(), access: v.boolean(),
});
export const timbreLimits = v.object({ maxSites: v.number(), maxQrs: v.number(), maxMembers: v.number(), maxUnits: v.number() });
export const timbreLicenseStatus = v.union(v.literal("pending_payment"), v.literal("active"), v.literal("past_due"),
  v.literal("suspended"), v.literal("expired"), v.literal("revoked"));
export const timbreLicenseSource = v.union(v.literal("subscription"), v.literal("one_time_purchase"),
  v.literal("hardware_bundle"), v.literal("building_contract"), v.literal("admin_grant"), v.literal("internal_trial"));
export const timbreAddress = v.object({
  name: v.string(), street: v.string(), city: v.string(), region: v.string(), postalCode: v.string(),
  country: v.string(), phone: v.string(), notes: v.optional(v.string()),
});
export const timbrePrintDesign = timbreQrDesign;
export const timbrePlateStatus = v.union(v.literal("draft"), v.literal("pending_payment"), v.literal("paid"),
  v.literal("production"), v.literal("ready"), v.literal("shipped"), v.literal("delivered"),
  v.literal("cancelled"), v.literal("refunded"));

// Commercial configuration is deliberately empty until an administrator records
// real prices, materials, delivery conditions and licensed benefits.
export const timbreCommerceTables = {
  timbrePlans: defineTable({
    code: timbreOfferCode, name: v.string(), description: v.string(), enabled: v.boolean(),
    priceAmount: v.optional(v.number()), currency: v.union(v.literal("ARS"), v.literal("USD")), period: timbrePeriod,
    durationDays: v.optional(v.number()), features: timbreFeatures, limits: timbreLimits,
    sellerId: v.id("users"), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_code", ["code"]),
  timbreLicenses: defineTable({
    ownerId: v.id("users"), planId: v.id("timbrePlans"), planName: v.string(), status: timbreLicenseStatus,
    startsAt: v.number(), expiresAt: v.optional(v.number()), source: timbreLicenseSource, sourceReference: v.string(),
    sourceOrderId: v.optional(v.id("marketplaceOrders")), features: timbreFeatures, limits: timbreLimits,
    revokedAt: v.optional(v.number()), revocationReason: v.optional(v.string()), revokedByAdmin: v.optional(v.boolean()), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]).index("by_source_order", ["sourceOrderId"]).index("by_reference", ["sourceReference"]),
  timbreHardwareEligibility: defineTable({
    productId: v.string(), planId: v.id("timbrePlans"), enabled: v.boolean(), durationDays: v.optional(v.number()),
    updatedBy: v.id("users"), updatedAt: v.number(),
  }).index("by_product", ["productId"]),
  timbreOrderBenefits: defineTable({
    orderId: v.id("marketplaceOrders"), ownerId: v.id("users"), planId: v.id("timbrePlans"), planName: v.string(),
    source: timbreLicenseSource, durationDays: v.optional(v.number()), features: timbreFeatures, limits: timbreLimits,
    licenseId: v.optional(v.id("timbreLicenses")), state: v.union(v.literal("pending"), v.literal("granted"), v.literal("revoked")),
    discountId: v.optional(v.id("timbreDiscounts")), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_order", ["orderId"]).index("by_discount", ["discountId"]),
  timbrePlateVariants: defineTable({
    name: v.string(), material: v.string(), widthMm: v.number(), heightMm: v.number(), enabled: v.boolean(),
    priceAmount: v.optional(v.number()), currency: v.union(v.literal("ARS"), v.literal("USD")),
    availability: v.union(v.literal("unconfigured"), v.literal("available"), v.literal("unavailable")),
    productionNotes: v.string(), warranty: v.string(), includedPlanId: v.optional(v.id("timbrePlans")),
    sellerId: v.id("users"), updatedAt: v.number(),
  }),
  timbreShippingOptions: defineTable({
    name: v.string(), country: v.string(), regions: v.array(v.string()), enabled: v.boolean(),
    priceAmount: v.number(), currency: v.union(v.literal("ARS"), v.literal("USD")),
    terms: v.string(), updatedBy: v.id("users"), updatedAt: v.number(),
  }),
  timbrePlateOrders: defineTable({
    ownerId: v.id("users"), qrId: v.optional(v.id("timbreQrs")), qrTokenSnapshot: v.optional(v.string()), variantId: v.id("timbrePlateVariants"),
    variant: v.object({ name: v.string(), material: v.string(), widthMm: v.number(), heightMm: v.number(),
      warranty: v.string(), productionNotes: v.string(), priceAmount: v.number(), currency: v.string() }),
    design: timbrePrintDesign, shippingAddress: timbreAddress,
    shipping: v.object({ optionId: v.id("timbreShippingOptions"), name: v.string(), priceAmount: v.number(), terms: v.string() }),
    amount: v.number(), currency: v.string(), status: timbrePlateStatus,
    marketplaceOrderId: v.optional(v.id("marketplaceOrders")), includedPlanId: v.optional(v.id("timbrePlans")),
    includedBenefit: v.optional(v.object({ planId: v.id("timbrePlans"), planName: v.string(), durationDays: v.optional(v.number()),
      features: timbreFeatures, limits: timbreLimits })),
    trackingReference: v.optional(v.string()), carrier: v.optional(v.string()), productionFileId: v.optional(v.id("_storage")),
    productionFileName: v.optional(v.string()), productionFileSha256: v.optional(v.string()), productionQrToken: v.optional(v.string()),
    createdAt: v.number(), updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]).index("by_marketplace_order", ["marketplaceOrderId"]).index("by_qr", ["qrId"])
    .index("by_qr_status", ["qrId", "status"]),
  timbrePlateDesigns: defineTable({
    orderId: v.id("timbrePlateOrders"), design: timbrePrintDesign, createdAt: v.number(),
  }).index("by_order", ["orderId"]),
  timbreDiscounts: defineTable({
    code: v.string(), planIds: v.array(v.id("timbrePlans")), percentBps: v.number(), enabled: v.boolean(),
    startsAt: v.number(), expiresAt: v.number(), maxRedemptions: v.optional(v.number()), redemptions: v.number(),
    updatedBy: v.id("users"), updatedAt: v.number(),
  }).index("by_code", ["code"]),
  timbreSubscriptions: defineTable({
    ownerId: v.id("users"), planId: v.id("timbrePlans"),
    planSnapshot: v.object({ name: v.string(), priceAmount: v.number(), currency: v.string(), period: timbrePeriod,
      durationDays: v.optional(v.number()), features: timbreFeatures, limits: timbreLimits }),
    status: v.union(v.literal("pending_external"), v.literal("authorized"), v.literal("paused"), v.literal("cancelled")),
    // Provider authorization alone NEVER grants a paid license. A verified
    // charge for a specific period is required by the recurring adapter.
    providerReference: v.optional(v.string()), licenseId: v.optional(v.id("timbreLicenses")),
    sellerId: v.optional(v.id("users")), collectorId: v.optional(v.string()), applicationId: v.optional(v.string()),
    payerEmail: v.optional(v.string()), providerPayerId: v.optional(v.string()), initPoint: v.optional(v.string()),
    checkoutState: v.optional(v.union(v.literal("creating"), v.literal("ready"), v.literal("failed"))),
    coverageScheduledId: v.optional(v.id("_scheduled_functions")), coverageScheduledAt: v.optional(v.number()),
    billingAnchorDay: v.optional(v.number()),
    cancelRequestedAt: v.optional(v.number()), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]).index("by_provider", ["providerReference"]),
  timbreExternalPayments: defineTable({
    ownerId: v.id("users"), planId: v.id("timbrePlans"), reference: v.string(), amount: v.number(), currency: v.string(),
    paidAt: v.number(), recordedBy: v.id("users"), licenseId: v.id("timbreLicenses"), createdAt: v.number(),
  }).index("by_reference", ["reference"]),
};
