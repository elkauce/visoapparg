import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { isMarketplaceAdmin } from "./marketplace";
import {
  newTimbreToken,
  validateStoredTimbreDesign,
} from "./lib/timbre_access";
import { licenseIsActive } from "./lib/timbre_commerce";

const TRIAL_MS = 7 * 86_400_000;
const features = {
  audio: true,
  video: true,
  chat: false,
  messages: false,
  families: false,
  buildings: false,
  offices: false,
  access: false,
};
const limits = { maxSites: 1, maxQrs: 1, maxMembers: 1, maxUnits: 1 };

function unavailable(message: string): never {
  throw new ConvexError({ code: "TIMBRE_TRIAL_UNAVAILABLE", message });
}

/** Deployment-operator command for an explicitly approved internal trial.
 * It is not a customer endpoint, payment, paid contract, or registration perk.
 * The operator must invoke it only for the individually authorized account. */
export const grantApprovedTrial = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail || targetEmail.length > 254 || !targetEmail.includes("@"))
      unavailable("Indicá el correo exacto de la cuenta autorizada.");
    const matches = (
      await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", targetEmail))
        .collect()
    ).filter((user) => isMarketplaceAdmin(user._id));
    if (matches.length !== 1)
      unavailable(
        "La prueba requiere una única cuenta administradora existente con ese correo.",
      );
    const owner = matches[0];
    const reference = `internal_trial:${owner._id}`;
    const existing = await ctx.db
      .query("timbreLicenses")
      .withIndex("by_reference", (q) => q.eq("sourceReference", reference))
      .unique();
    const now = Date.now();

    if (existing) {
      if (
        existing.ownerId !== owner._id ||
        existing.source !== "internal_trial" ||
        existing.expiresAt !== existing.startsAt + TRIAL_MS
      )
        unavailable("La referencia de prueba requiere revisión del operador.");
      if (!licenseIsActive(existing, now))
        unavailable(
          "La prueba ya venció o fue desactivada; no se renueva automáticamente.",
        );
      const sites = await ctx.db
        .query("timbreSites")
        .withIndex("by_license", (q) => q.eq("licenseId", existing._id))
        .take(2);
      if (sites.length !== 1 || sites[0].ownerId !== owner._id)
        unavailable("La vivienda de prueba requiere revisión del operador.");
      const site = sites[0];
      const qrs = await ctx.db
        .query("timbreQrs")
        .withIndex("by_site_revoked", (q) =>
          q.eq("siteId", site._id).eq("revokedAt", undefined),
        )
        .take(2);
      const membership = await ctx.db
        .query("timbreMembers")
        .withIndex("by_site_user", (q) =>
          q.eq("siteId", site._id).eq("userId", owner._id),
        )
        .unique();
      if (qrs.length !== 1 || membership?.role !== "owner")
        unavailable(
          "El QR o la membresía de prueba requiere revisión del operador.",
        );
      // In particular, do not extend expiry, rotate the QR or restore settings
      // the owner disabled while testing.
      return {
        licenseId: existing._id,
        siteId: site._id,
        qrId: qrs[0]._id,
        qrToken: qrs[0].token,
        expiresAt: existing.expiresAt,
      };
    }

    const planId = await ctx.db.insert("timbrePlans", {
      code: "digital",
      name: "Prueba interna de Timbre · 7 días",
      description:
        "Acceso temporal de validación autorizado individualmente. No es una venta ni un plan comercial gratuito.",
      enabled: false,
      currency: "ARS",
      period: "one_time",
      durationDays: 7,
      features,
      limits,
      sellerId: owner._id,
      createdAt: now,
      updatedAt: now,
    });
    const expiresAt = now + TRIAL_MS;
    const licenseId = await ctx.db.insert("timbreLicenses", {
      ownerId: owner._id,
      planId,
      planName: "Prueba interna de Timbre · 7 días",
      status: "active",
      startsAt: now,
      expiresAt,
      source: "internal_trial",
      sourceReference: reference,
      features,
      limits,
      createdAt: now,
      updatedAt: now,
    });
    const siteId = await ctx.db.insert("timbreSites", {
      ownerId: owner._id,
      licenseId,
      kind: "home",
      name: "Timbre de prueba",
      timezone: "America/Argentina/Buenos_Aires",
      enabled: true,
      allowedAudio: true,
      allowedVideo: true,
      chatEnabled: false,
      messagesEnabled: false,
      notificationsEnabled: true,
      schedule: [],
      recipientIds: [owner._id],
      fallbackRecipientIds: [],
      fallbackAfterSeconds: 20,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("timbreMembers", {
      siteId,
      userId: owner._id,
      role: "owner",
      unitIds: [],
      canReceive: true,
      createdAt: now,
      updatedAt: now,
    });
    const qrToken = newTimbreToken();
    const design = validateStoredTimbreDesign({
      title: "Timbre de prueba",
      streetNumber: "",
      familyName: "",
      businessName: "",
      unit: "",
      legend: "Escaneá para comunicarte",
      backgroundColor: "#F5F3EF",
      textColor: "#17191D",
      qrColor: "#17191D",
      qrBackground: "#FFFFFF",
      font: "sans",
      emblem: "bell",
      widthMm: 90,
      heightMm: 130,
      bleedMm: 3,
    });
    const qrId = await ctx.db.insert("timbreQrs", {
      siteId,
      token: qrToken,
      label: "Prueba VISO",
      enabled: true,
      design,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("timbreAuditEvents", {
      siteId,
      // No actor user is fabricated: this is a deployment-operator operation.
      action: "operator.internal_trial.created",
      targetId: licenseId,
      createdAt: now,
    });
    return { licenseId, siteId, qrId, qrToken, expiresAt };
  },
});
