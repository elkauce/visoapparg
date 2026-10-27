import { enrollTeaviso } from "./lib/teaviso_accounts";
import { teavisoQrTemplate } from "./teaviso_tables";
import { v, ConvexError } from "convex/values";
import { query, mutation, internalMutation, action } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getCurrentUserOrNull, requireCurrentUser } from "./lib/current_user";
import { isMarketplaceAdmin } from "./marketplace";
import { googleAvailable } from "./lib/google_auth";
import {
  teavisoOrigin,
  teavisoText,
  whatsappPhone,
  whatsappUrl,
} from "./lib/teaviso";
import {
  checkoutPreference,
  createServiceOrder,
  paymentReadiness,
} from "./timbre_commerce";

async function admin(ctx: QueryCtx | MutationCtx) {
  const user = await requireCurrentUser(ctx);
  if (!isMarketplaceAdmin(user._id))
    throw new ConvexError("No tenés permiso de administración.");
  return user;
}
async function settings(ctx: QueryCtx | MutationCtx) {
  return ctx.db
    .query("teavisoBusinessSettings")
    .withIndex("by_key", (q) => q.eq("key", "business"))
    .unique();
}
function token() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}

export const configuration = query({
  args: { origin: v.string() },
  handler: async (ctx, args) => {
    const config = await settings(ctx);
    return {
      // Native clients must wait for a server that accepts their own callback.
      androidGoogle: googleAvailable(),
      google:
        googleAvailable() &&
        !!teavisoOrigin(process.env.TEAVISO_WEB_ORIGIN) &&
        args.origin === teavisoOrigin(process.env.TEAVISO_WEB_ORIGIN),
      business: config
        ? {
            enabled: config.enabled,
            priceAmount: config.priceAmount,
            currency: config.currency,
            terms: config.terms,
            buyable:
              config.enabled &&
              config.priceAmount > 0 &&
              !!teavisoOrigin(process.env.TEAVISO_WEB_ORIGIN) &&
              (await paymentReadiness(ctx)),
          }
        : null,
    };
  },
});
export const account = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    return user
      ? {
          name: user.name ?? null,
          email: user.email ?? null,
          isAdmin: isMarketplaceAdmin(user._id),
        }
      : null;
  },
});
export const myWhatsappQrs = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    return (
      await ctx.db
        .query("teavisoWhatsappQrs")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .collect()
    ).filter((row) => !row.archived);
  },
});
export const saveWhatsappQr = mutation({
  args: {
    id: v.optional(v.id("teavisoWhatsappQrs")),
    label: v.string(),
    phone: v.string(),
    message: v.string(),
    enabled: v.boolean(),
    consent: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    await enrollTeaviso(ctx, user._id);
    if (!args.consent)
      throw new ConvexError(
        "Confirmá que podés publicar este número de WhatsApp.",
      );
    const old = args.id
      ? await ctx.db.get("teavisoWhatsappQrs", args.id)
      : null;
    if (args.id && (!old || old.ownerId !== user._id || old.archived))
      throw new ConvexError("No se encontró ese QR en tu cuenta.");
    const values = {
      label: teavisoText(args.label, 80),
      phone: whatsappPhone(args.phone),
      message: teavisoText(args.message, 500, false),
      enabled: args.enabled,
      consentAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (old) {
      await ctx.db.patch("teavisoWhatsappQrs", old._id, values);
      return old._id;
    }
    const existing = await ctx.db
      .query("teavisoWhatsappQrs")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    if (existing.length >= 50)
      throw new ConvexError(
        "Alcanzaste el límite de 50 QR de la cuenta. Podés editar los existentes.",
      );
    return ctx.db.insert("teavisoWhatsappQrs", {
      ...values,
      ownerId: user._id,
      token: token(),
      archived: false,
      createdAt: Date.now(),
    });
  },
});
export const archiveWhatsappQr = mutation({
  args: { id: v.id("teavisoWhatsappQrs") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const qr = await ctx.db.get("teavisoWhatsappQrs", args.id);
    if (!qr || qr.ownerId !== user._id)
      throw new ConvexError("No se encontró ese QR en tu cuenta.");
    await ctx.db.patch("teavisoWhatsappQrs", qr._id, {
      archived: true,
      enabled: false,
      updatedAt: Date.now(),
    });
  },
});
export const publicWhatsapp = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!/^[a-f0-9]{64}$/.test(args.token)) return null;
    const qr = await ctx.db
      .query("teavisoWhatsappQrs")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (qr)
      return qr.enabled && !qr.archived
        ? { label: qr.label, url: whatsappUrl(qr.phone, qr.message) }
        : null;
    const request = await ctx.db
      .query("teavisoBusinessRequests")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (
      !request ||
      request.status !== "active" ||
      !request.enabled ||
      !request.assignedPhone ||
      !request.orderId
    )
      return null;
    const order = await ctx.db.get("marketplaceOrders", request.orderId);
    if (order?.status !== "approved" || order.buyerId !== request.ownerId)
      return null;
    return {
      label: request.businessName,
      url: whatsappUrl(request.assignedPhone, request.message),
    };
  },
});
export const myBusinessRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const rows = await ctx.db
      .query("teavisoBusinessRequests")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    return rows.map(({ adminNotes: _private, ...row }) => {
      void _private;
      return row;
    });
  },
});
export const requestBusiness = mutation({
  args: {
    businessName: v.string(),
    contactPhone: v.string(),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    await enrollTeaviso(ctx, user._id);
    const rows = await ctx.db
      .query("teavisoBusinessRequests")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    if (rows.length >= 20)
      throw new ConvexError(
        "Alcanzaste el límite de solicitudes. Contactá al equipo para continuar.",
      );
    return ctx.db.insert("teavisoBusinessRequests", {
      ownerId: user._id,
      businessName: teavisoText(args.businessName, 100),
      contactPhone: whatsappPhone(args.contactPhone),
      notes: teavisoText(args.notes, 1000, false),
      status: "requested",
      enabled: false,
      token: token(),
      message: "Hola, estoy en la puerta. ¿Podés atenderme?",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
export const reserveBusinessOrder = internalMutation({
  args: {
    requestId: v.id("teavisoBusinessRequests"),
    acceptedTerms: v.string(),
    acceptedAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const request = await ctx.db.get("teavisoBusinessRequests", args.requestId);
    const config = await settings(ctx);
    if (
      !request ||
      request.ownerId !== user._id ||
      !["requested", "awaiting_payment"].includes(request.status)
    )
      throw new ConvexError("La solicitud no está disponible para pago.");
    if (
      !config?.enabled ||
      config.priceAmount <= 0 ||
      args.acceptedAmount !== config.priceAmount ||
      args.acceptedTerms !== config.terms ||
      !teavisoOrigin(process.env.TEAVISO_WEB_ORIGIN)
    )
      throw new ConvexError(
        "Las condiciones cambiaron o el servicio no está disponible. Revisalas antes de pagar.",
      );
    // Reuse the pending order, locking price and terms to avoid duplicate charges.
    if (request.orderId) {
      const existing = await ctx.db.get("marketplaceOrders", request.orderId);
      if (
        existing?.status !== "pending" ||
        request.priceAmount !== config.priceAmount ||
        request.terms !== config.terms
      )
        throw new ConvexError(
          "Esta solicitud ya tiene una compra. Contactá al equipo para revisarla.",
        );
      return {
        orderId: existing._id,
        sellerId: existing.sellerId,
        title: existing.title,
        amount: existing.amount,
        currency: existing.currency,
      };
    }
    const orderId = await createServiceOrder(
      ctx,
      user._id,
      config.updatedBy,
      `teaviso:business:${request._id}`,
      "Te a Viso · WhatsApp Business con configuración",
      config.priceAmount,
      "ARS",
    );
    await ctx.db.patch("teavisoBusinessRequests", request._id, {
      orderId,
      status: "awaiting_payment",
      priceAmount: config.priceAmount,
      terms: config.terms,
      acceptedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return {
      orderId,
      sellerId: config.updatedBy,
      title: "Te a Viso · WhatsApp Business con configuración",
      amount: config.priceAmount,
      currency: "ARS",
    };
  },
});
export const createBusinessCheckout = action({
  args: {
    requestId: v.id("teavisoBusinessRequests"),
    acceptedTerms: v.string(),
    acceptedAmount: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ checkoutUrl: string; orderId: Id<"marketplaceOrders"> }> => {
    const order = await ctx.runMutation(
      internal.teaviso.reserveBusinessOrder,
      args,
    );
    return checkoutPreference(ctx, order, {
      origin: process.env.TEAVISO_WEB_ORIGIN,
      returnPath: "/panel/business",
    });
  },
});
export const saveBusinessSettings = mutation({
  args: { enabled: v.boolean(), priceAmount: v.number(), terms: v.string() },
  handler: async (ctx, args) => {
    const user = await admin(ctx);
    const terms = teavisoText(args.terms, 5000);
    if (
      !Number.isSafeInteger(args.priceAmount) ||
      args.priceAmount < 1 ||
      args.priceAmount > 100_000_000
    )
      throw new ConvexError("Ingresá un importe válido en centavos de ARS.");
    if (terms.length < 40)
      throw new ConvexError(
        "Detallá qué incluye la configuración, la provisión del número, mantenimiento y condiciones.",
      );
    const old = await settings(ctx);
    const values = {
      key: "business" as const,
      ...args,
      terms,
      currency: "ARS" as const,
      updatedBy: user._id,
      updatedAt: Date.now(),
    };
    if (old) await ctx.db.replace("teavisoBusinessSettings", old._id, values);
    else await ctx.db.insert("teavisoBusinessSettings", values);
  },
});
export const adminBusiness = query({
  args: {},
  handler: async (ctx) => {
    await admin(ctx);
    return {
      settings: await settings(ctx),
      requests: await ctx.db
        .query("teavisoBusinessRequests")
        .order("desc")
        .take(100),
    };
  },
});
export const provisionBusiness = mutation({
  args: {
    requestId: v.id("teavisoBusinessRequests"),
    assignedPhone: v.string(),
    message: v.string(),
    activate: v.boolean(),
    adminNotes: v.string(),
  },
  handler: async (ctx, args) => {
    await admin(ctx);
    const request = await ctx.db.get("teavisoBusinessRequests", args.requestId);
    if (
      !request?.orderId ||
      !["paid", "configuring", "active"].includes(request.status)
    )
      throw new ConvexError("Primero debe verificarse el pago del servicio.");
    const order = await ctx.db.get("marketplaceOrders", request.orderId);
    if (
      !order ||
      order.status !== "approved" ||
      order.buyerId !== request.ownerId
    )
      throw new ConvexError("El pago del servicio no está aprobado.");
    const phone = whatsappPhone(args.assignedPhone);
    const sameNumber = await ctx.db
      .query("teavisoBusinessRequests")
      .withIndex("by_assigned_phone", (q) => q.eq("assignedPhone", phone))
      .collect();
    if (
      sameNumber.some(
        (row) => row._id !== request._id && row.status !== "cancelled",
      )
    )
      throw new ConvexError("Ese número ya está asignado a otro servicio.");
    await ctx.db.patch("teavisoBusinessRequests", request._id, {
      assignedPhone: phone,
      message: teavisoText(args.message, 500, false),
      adminNotes: teavisoText(args.adminNotes, 2000, false),
      enabled: args.activate,
      status: args.activate ? "active" : "configuring",
      updatedAt: Date.now(),
    });
  },
});

export const updateBusinessContact = mutation({
  args: {
    requestId: v.id("teavisoBusinessRequests"),
    message: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const request = await ctx.db.get("teavisoBusinessRequests", args.requestId);
    if (
      !request ||
      request.ownerId !== user._id ||
      request.status !== "active" ||
      !request.orderId
    )
      throw new ConvexError("El servicio no está activo en tu cuenta.");
    const order = await ctx.db.get("marketplaceOrders", request.orderId);
    if (order?.status !== "approved" || order.buyerId !== user._id)
      throw new ConvexError("El pago del servicio no está aprobado.");
    await ctx.db.patch("teavisoBusinessRequests", request._id, {
      message: teavisoText(args.message, 500, false),
      enabled: args.enabled,
      updatedAt: Date.now(),
    });
  },
});

export const saveQrTemplate = mutation({
  args: {
    kind: v.union(v.literal("personal"), v.literal("business")),
    id: v.string(),
    template: teavisoQrTemplate,
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    if (args.kind === "personal") {
      const id = ctx.db.normalizeId("teavisoWhatsappQrs", args.id);
      const row = id ? await ctx.db.get("teavisoWhatsappQrs", id) : null;
      if (!row || row.ownerId !== user._id || row.archived)
        throw new ConvexError("No se encontró esa entrada en tu cuenta.");
      await ctx.db.patch("teavisoWhatsappQrs", row._id, {
        qrTemplate: args.template,
        updatedAt: Date.now(),
      });
    } else {
      const id = ctx.db.normalizeId("teavisoBusinessRequests", args.id);
      const row = id ? await ctx.db.get("teavisoBusinessRequests", id) : null;
      if (
        !row ||
        row.ownerId !== user._id ||
        row.status !== "active" ||
        !row.orderId
      )
        throw new ConvexError("El servicio no está activo en tu cuenta.");
      const order = await ctx.db.get("marketplaceOrders", row.orderId);
      if (order?.status !== "approved" || order.buyerId !== user._id)
        throw new ConvexError("El pago del servicio no está aprobado.");
      await ctx.db.patch("teavisoBusinessRequests", row._id, {
        qrTemplate: args.template,
        updatedAt: Date.now(),
      });
    }
  },
});
