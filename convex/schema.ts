import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { deckKeyContent } from "./lib/deck_key_content.ts";
import { deckGrid } from "./lib/deck_grid.ts";
import { deckAppearance, deckCanvas } from "./lib/deck_appearance.ts";

export default defineSchema({
  ...authTables,
  users: defineTable({
    ...authTables.users.validator.fields,
    // Se conserva para filas antiguas; las cuentas propias se identifican por _id.
    tokenIdentifier: v.optional(v.string()),
    // Estado que el usuario tiene marcado ahora mismo
    activeStatusId: v.optional(v.id("statuses")),
    // Dirección (IP) de la Key Light de Elgato en la red local del usuario
    keyLightIp: v.optional(v.string()),
    // URL general (IFTTT, Home Assistant, Voice Monkey) que avisa en cada cambio de estado
    homeWebhookUrl: v.optional(v.string()),
    // Volumen (0-100) de los videos del Display público. 0 = silencio
    displayVolume: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_token", ["tokenIdentifier"]),

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
