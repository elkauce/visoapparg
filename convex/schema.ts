import { screenKind } from "./lib/screen_settings";
import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { deckKeyContent } from "./lib/deck_key_content.ts";
import { deckGrid } from "./lib/deck_grid.ts";
import { deckAppearance, deckCanvas } from "./lib/deck_appearance.ts";
import {
  marketplaceAsset,
  marketplaceCategory,
  marketplaceDelivery,
  marketplaceMediaType,
  marketplacePriceMode,
} from "./lib/marketplace_validation";

export default defineSchema({
  ...authTables,
  users: defineTable({
    ...authTables.users.validator.fields,
    // Se conserva para filas antiguas; las cuentas propias se identifican por _id.
    tokenIdentifier: v.optional(v.string()),
    // Estado que el usuario tiene marcado ahora mismo
    activeStatusId: v.optional(v.id("statuses")),
    activeStatusRevision: v.optional(v.number()),
    deckCatalogVersion: v.optional(v.number()),
    // Dirección (IP) de la Key Light de Elgato en la red local del usuario
    keyLightIp: v.optional(v.string()),
    // URL general (IFTTT, Home Assistant, Voice Monkey) que avisa en cada cambio de estado
    homeWebhookUrl: v.optional(v.string()),
    // Volumen (0-100) de los videos del Display público. 0 = silencio
    deckIdle: v.optional(
      v.object({
        enabled: v.boolean(),
        mainPageId: v.id("deckPages"),
        restPageId: v.id("deckPages"),
        seconds: v.number(),
      }),
    ),
    displayVolume: v.optional(v.number()),
    displayBackground: v.optional(
      v.object({
        mediaStorageId: v.id("_storage"),
        mediaType: v.union(v.literal("image"), v.literal("video")),
        fit: v.union(v.literal("cover"), v.literal("contain")),
        showStatus: v.boolean(),
      }),
    ),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_token", ["tokenIdentifier"]),

  // One explicit account-link request per authenticated browser session.
  socialLinkIntents: defineTable({
    userId: v.id("users"),
    sessionId: v.id("authSessions"),
    createdAt: v.number(),
    expires: v.number(),
  }).index("by_session", ["sessionId"]),
  // Google proves its identity at the OAuth callback; VISO proves its existing
  // session and PKCE verifier only when the browser redeems this one-use code.
  socialPendingLinks: defineTable({
    userId: v.id("users"),
    sessionId: v.id("authSessions"),
    verifierId: v.id("authVerifiers"),
    codeHash: v.string(),
    expires: v.number(),
    signature: v.string(),
    googleSubject: v.string(),
    profile: v.object({
      email: v.string(),
      emailVerified: v.literal(true),
      googleSubject: v.string(),
      name: v.optional(v.string()),
      image: v.optional(v.string()),
    }),
  })
    .index("by_code", ["codeHash"])
    .index("by_session", ["sessionId"]),

  presenceDevices: defineTable({
    userId: v.id("users"),
    deviceId: v.string(),
    secretHash: v.string(),
    lastSeen: v.optional(v.number()),
    expires: v.number(),
    enabled: v.boolean(),
    calling: v.boolean(),
    suppressed: v.boolean(),
    previous: v.optional(v.id("statuses")),
    appliedRevision: v.optional(v.number()),
  })
    .index("by_owner_device", ["userId", "deviceId"])
    .index("by_owner", ["userId"])
    .index("by_secret", ["secretHash"]),
  statuses: defineTable({
    userId: v.id("users"),
    name: v.string(),
    // Color en formato hex, ej: #22c55e
    color: v.string(),
    // Clave del icono (ver src/lib/status-icons.ts)
    icon: v.string(),
    order: v.number(),
    // Ajuste de la Key Light que se aplica al activar el estado (desde el navegador)
    light: v.optional(
      v.object({
        on: v.boolean(),
        brightness: v.number(),
        temperature: v.number(),
      }),
    ),
    // URL a la que el servidor avisa (POST) al activar el estado
    webhookUrl: v.optional(v.string()),
    // Imagen, PNG o video que el Display muestra a pantalla completa al activar el estado
    mediaStorageId: v.optional(v.id("_storage")),
    mediaType: v.optional(v.union(v.literal("image"), v.literal("video"))),
  }).index("by_user_and_order", ["userId", "order"]),

  // Link público de cada usuario (/s/:slug) para mostrar su estado a pantalla completa
  publicLinks: defineTable({
    userId: v.id("users"),
    slug: v.string(),
  })
    .index("by_slug", ["slug"])
    .index("by_user", ["userId"]),

  // Token secreto por usuario para activar estados desde el software de Elgato (GET con URL)
  deckTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),

  // Páginas del deck de pantalla completa (cada una es una cuadrícula de teclas)
  deckPages: defineTable({
    kind: v.optional(screenKind),
    screenSettings: v.optional(v.any()),
    standbySettings: v.optional(v.any()),
    standbyPhotos: v.optional(v.array(v.id("_storage"))),
    userId: v.id("users"),
    name: v.string(),
    order: v.number(),
    // Ausente conserva la cuadrícula original de 5 × 3.
    grid: v.optional(deckGrid),
    canvas: v.optional(deckCanvas),
  }).index("by_user_and_order", ["userId", "order"]),

  // Teclas colocadas en una posición de una página
  deckKeys: defineTable({
    userId: v.id("users"),
    pageId: v.id("deckPages"),
    position: v.number(),
    content: deckKeyContent,
    appearance: v.optional(deckAppearance),
  })
    .index("by_user", ["userId"])
    .index("by_page_and_position", ["pageId", "position"]),

  // Solo el endpoint autenticado de subida crea estos enlaces de propiedad.
  deckMedia: defineTable({
    userId: v.id("users"),
    storageId: v.id("_storage"),
    mediaType: v.union(v.literal("image"), v.literal("video")),
  })
    .index("by_user", ["userId"])
    .index("by_storage", ["storageId"]),

  creatorProfiles: defineTable({
    userId: v.id("users"),
    displayName: v.string(),
    bio: v.string(),
    website: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    reviewReason: v.optional(v.string()),
    reviewedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  marketplaceUploads: defineTable({
    userId: v.id("users"),
    storageId: v.id("_storage"),
    mediaType: marketplaceMediaType,
    contentType: v.string(),
    size: v.number(),
    createdAt: v.number(),
  })
    .index("by_storage", ["storageId"])
    .index("by_user", ["userId"]),

  marketplaceProducts: defineTable({
    userId: v.id("users"),
    creatorId: v.optional(v.id("creatorProfiles")),
    creatorName: v.string(),
    title: v.string(),
    description: v.string(),
    category: marketplaceCategory,
    coverStorageId: v.optional(v.id("_storage")),
    priceMode: marketplacePriceMode,
    delivery: marketplaceDelivery,
    externalUrl: v.optional(v.string()),
    affiliate: v.boolean(),
    assets: v.array(marketplaceAsset),
    status: v.union(
      v.literal("draft"),
      v.literal("pending"),
      v.literal("published"),
      v.literal("rejected"),
      v.literal("archived"),
    ),
    reviewReason: v.optional(v.string()),
    reviewedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
    publishedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_category_status", ["category", "status"]),

  // Acquisition snapshots keep a creator from replacing an acquired free asset
  // with a different file or a future paid download after publication.
  marketplaceLibrary: defineTable({
    userId: v.id("users"),
    productId: v.string(),
    title: v.string(),
    category: marketplaceCategory,
    creatorName: v.string(),
    delivery: marketplaceDelivery,
    assets: v.array(marketplaceAsset),
    profileTemplate: v.optional(v.literal("essential")),
    acquiredAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_product", ["userId", "productId"]),

  // Recibos de pulsaciones: deviceId es identificación no secreta, nunca autenticación.
  deckActionRequests: defineTable({
    userId: v.id("users"),
    requestId: v.string(),
    deviceId: v.string(),
    fingerprint: v.string(),
    completedAt: v.number(),
  })
    .index("by_user_and_request", ["userId", "requestId"])
    .index("by_user_and_time", ["userId", "completedAt"]),
});
