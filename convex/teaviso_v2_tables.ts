import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  signModel,
  signMaterial,
  signState,
  signFields,
} from "./lib/teaviso_signs";

export const spaceKind = v.union(
  v.literal("home"),
  v.literal("business"),
  v.literal("office"),
  v.literal("building"),
);
export const openingHours = v.array(
  v.object({ day: v.number(), start: v.number(), end: v.number() }),
);
export const visitTemplate = v.object({
  id: v.string(),
  label: v.string(),
  message: v.string(),
  imageId: v.optional(v.id("teavisoImages")),
});
export const bookingStatus = v.union(
  v.literal("pending"),
  v.literal("confirmed"),
  v.literal("cancelled"),
  v.literal("completed"),
  v.literal("no_show"),
  v.literal("expired"),
);
export const teavisoV2Tables = {
  teavisoSignRequests: defineTable({
    ownerId: v.id("users"),
    spaceId: v.id("teavisoSpaces"),
    spaceName: v.string(),
    qrToken: v.string(),
    model: signModel,
    material: signMaterial,
    fields: signFields,
    requestKey: v.string(),
    status: signState,
    adminNotes: v.string(),
    reviewedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_key", ["ownerId", "requestKey"]),
  // Product membership and profile are separate from the shared login identity.
  // Opening VISO alone never enrolls that user in the Te Aviso customer directory.
  teavisoAccounts: defineTable({
    userId: v.id("users"),
    name: v.string(),
    contactPhone: v.string(),
    searchText: v.string(),
    deckLinked: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .searchIndex("search", { searchField: "searchText" }),
  teavisoAdminEvents: defineTable({
    actorId: v.id("users"),
    ownerId: v.id("users"),
    action: v.string(),
    targetId: v.string(),
    reason: v.string(),
    createdAt: v.number(),
  }).index("by_owner_created", ["ownerId", "createdAt"]),
  teavisoSpaces: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    kind: spaceKind,
    token: v.string(),
    timezone: v.string(),
    enabled: v.boolean(),
    phone: v.optional(v.string()),
    message: v.string(),
    whatsappQrId: v.optional(v.id("teavisoWhatsappQrs")),
    timbreSiteId: v.optional(v.id("timbreSites")),
    timbreQrId: v.optional(v.id("timbreQrs")),
    licenseId: v.optional(v.id("timbreLicenses")),
    schedule: openingHours,
    bookingsEnabled: v.boolean(),
    portalEnabled: v.boolean(),
    autoConfirm: v.boolean(),
    leadMinutes: v.number(),
    horizonDays: v.number(),
    cancelHours: v.number(),
    templates: v.array(visitTemplate),
    revision: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_token", ["token"])
    .index("by_whatsapp", ["whatsappQrId"]),
  teavisoServices: defineTable({
    spaceId: v.id("teavisoSpaces"),
    name: v.string(),
    duration: v.number(),
    enabled: v.boolean(),
    createdAt: v.number(),
  }).index("by_space", ["spaceId"]),
  teavisoProfessionals: defineTable({
    spaceId: v.id("teavisoSpaces"),
    name: v.string(),
    enabled: v.boolean(),
    serviceIds: v.array(v.id("teavisoServices")),
  }).index("by_space", ["spaceId"]),
  teavisoBookings: defineTable({
    spaceId: v.id("teavisoSpaces"),
    serviceId: v.id("teavisoServices"),
    professionalId: v.id("teavisoProfessionals"),
    serviceName: v.string(),
    professionalName: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    status: bookingStatus,
    name: v.string(),
    contact: v.string(),
    manageHash: v.string(),
    requestKey: v.string(),
    expiresAt: v.optional(v.number()),
    timezone: v.string(),
    cancelHours: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_space_start", ["spaceId", "startsAt"])
    .index("by_professional_start", ["professionalId", "startsAt"])
    .index("by_space_request", ["spaceId", "requestKey"]),
  teavisoBlocks: defineTable({
    spaceId: v.id("teavisoSpaces"),
    professionalId: v.optional(v.id("teavisoProfessionals")),
    startsAt: v.number(),
    endsAt: v.number(),
    note: v.string(),
  }).index("by_space_start", ["spaceId", "startsAt"]),
  teavisoVisits: defineTable({
    spaceId: v.id("teavisoSpaces"),
    templateId: v.string(),
    label: v.string(),
    message: v.string(),
    nonceHash: v.string(),
    seen: v.boolean(),
    createdAt: v.number(),
  }).index("by_space_created", ["spaceId", "createdAt"]),
  teavisoPublicRates: defineTable({
    key: v.string(),
    count: v.number(),
    expiresAt: v.number(),
  }).index("by_key", ["key"]),
  teavisoImages: defineTable({
    ownerId: v.id("users"),
    storageId: v.id("_storage"),
    createdAt: v.number(),
  })
    .index("by_storage", ["storageId"])
    .index("by_owner", ["ownerId"]),
};
