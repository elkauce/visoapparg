import { defineTable } from "convex/server";
import { v } from "convex/values";

export const timbreSiteKind = v.union(v.literal("home"), v.literal("building"), v.literal("office"));
export const timbreMemberRole = v.union(v.literal("owner"), v.literal("manager"), v.literal("resident"));
export const timbreSchedule = v.array(v.object({ day: v.number(), start: v.string(), end: v.string() }));
export const timbreQrDesign = v.object({
  title: v.string(), streetNumber: v.string(), familyName: v.string(), businessName: v.string(),
  unit: v.string(), legend: v.string(), backgroundColor: v.string(), textColor: v.string(),
  qrColor: v.string(), qrBackground: v.string(),
  font: v.union(v.literal("sans"), v.literal("serif"), v.literal("mono")),
  emblem: v.union(v.literal("none"), v.literal("bell"), v.literal("home"), v.literal("office"),
    v.literal("flag-ar"), v.literal("flag-br"), v.literal("flag-uy")),
  widthMm: v.number(), heightMm: v.number(), bleedMm: v.number(), imageDataUrl: v.optional(v.string()),
});

// These tables extend existing VISO accounts. A printed QR is a public contact
// identifier, never an owner credential or a door-opening authorization.
export const timbreTables = {
  timbreSites: defineTable({
    ownerId: v.id("users"), licenseId: v.id("timbreLicenses"), kind: timbreSiteKind,
    name: v.string(), timezone: v.string(), enabled: v.boolean(),
    allowedAudio: v.boolean(), allowedVideo: v.boolean(), chatEnabled: v.boolean(),
    messagesEnabled: v.boolean(), notificationsEnabled: v.boolean(),
    mutedUntil: v.optional(v.number()), schedule: timbreSchedule,
    recipientIds: v.array(v.id("users")), fallbackRecipientIds: v.optional(v.array(v.id("users"))), fallbackAfterSeconds: v.number(),
    absenceMessage: v.optional(v.string()), telegramUsername: v.optional(v.string()),
    signalStatusOnAccept: v.optional(v.boolean()), ringStatusId: v.optional(v.id("statuses")),
    createdAt: v.number(), updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]).index("by_license", ["licenseId"]),
  timbreUnits: defineTable({
    siteId: v.id("timbreSites"), name: v.string(), enabled: v.boolean(),
    recipientIds: v.array(v.id("users")), order: v.number(), telegramUsername: v.optional(v.string()),
    createdAt: v.number(), updatedAt: v.number(),
  }).index("by_site", ["siteId"]).index("by_site_enabled", ["siteId", "enabled"]),
  timbreMembers: defineTable({
    siteId: v.id("timbreSites"), userId: v.id("users"), role: timbreMemberRole,
    unitIds: v.array(v.id("timbreUnits")), canReceive: v.boolean(),
    createdAt: v.number(), updatedAt: v.number(),
  }).index("by_site_user", ["siteId", "userId"]).index("by_site", ["siteId"]).index("by_user", ["userId"]),
  timbreQrs: defineTable({
    siteId: v.id("timbreSites"), unitId: v.optional(v.id("timbreUnits")),
    token: v.string(), label: v.string(), enabled: v.boolean(), revokedAt: v.optional(v.number()),
    design: v.optional(timbreQrDesign), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_token", ["token"]).index("by_site", ["siteId"]).index("by_site_revoked", ["siteId", "revokedAt"]),
  // Large image payloads are fetched only for the selected authorized QR.
  timbreQrDesigns: defineTable({
    qrId: v.id("timbreQrs"), design: timbreQrDesign, updatedAt: v.number(),
  }).index("by_qr", ["qrId"]),
  timbreInvitations: defineTable({
    siteId: v.id("timbreSites"), role: v.union(v.literal("manager"), v.literal("resident")),
    unitIds: v.array(v.id("timbreUnits")), email: v.optional(v.string()),
    tokenHash: v.string(), expiresAt: v.number(), createdBy: v.id("users"),
    acceptedBy: v.optional(v.id("users")), acceptedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()), createdAt: v.number(),
  }).index("by_hash", ["tokenHash"]).index("by_site", ["siteId"])
    .index("by_site_pending", ["siteId", "acceptedAt", "revokedAt", "expiresAt"]),
  timbreAuditEvents: defineTable({
    siteId: v.id("timbreSites"), actorUserId: v.optional(v.id("users")),
    action: v.string(), targetId: v.optional(v.string()), createdAt: v.number(),
  }).index("by_site_created", ["siteId", "createdAt"]),
};
