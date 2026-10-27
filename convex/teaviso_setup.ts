import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { spaceKind } from "./teaviso_v2_tables";
import { requireCurrentUser } from "./lib/current_user";
import { enrollTeaviso } from "./lib/teaviso_accounts";
import { teavisoText, whatsappPhone } from "./lib/teaviso";
import { DEFAULT_HOURS, validTimezone } from "./lib/teaviso_schedule";
import {
  getValidTimbreLicense,
  requireValidTimbreLicense,
} from "./lib/timbre_commerce";
import { locationUsage, linkedSite, linkedSpace } from "./lib/teaviso_quota";
import { randomCapability } from "./lib/timbre_rtc";
import { recordTimbreAudit } from "./lib/timbre_access";

type Read = QueryCtx | MutationCtx;
type Kind = Doc<"teavisoSpaces">["kind"];
const method = v.union(
  v.literal("whatsapp"),
  v.literal("calls"),
  v.literal("both"),
);
const generalMessage = "Hola, estoy en la entrada. ¿Podés atenderme?";
const hours = (kind: Kind) =>
  kind === "home" || kind === "building"
    ? [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, start: 0, end: 1440 }))
    : DEFAULT_HOURS;
function allowed(license: Doc<"timbreLicenses">, kind: Kind) {
  return (
    (license.features.audio || license.features.video) &&
    (kind !== "building" || license.features.buildings) &&
    ((kind !== "office" && kind !== "business") || license.features.offices)
  );
}
async function owned(ctx: Read, id: Id<"teavisoSpaces">) {
  const user = await requireCurrentUser(ctx),
    space = await ctx.db.get("teavisoSpaces", id);
  if (!space || space.ownerId !== user._id)
    throw new ConvexError("Este timbre no pertenece a tu cuenta.");
  return space;
}
async function commonQr(
  ctx: MutationCtx,
  site: Doc<"timbreSites">,
  license: Doc<"timbreLicenses">,
) {
  const rows = await ctx.db
    .query("timbreQrs")
    .withIndex("by_site", (q) => q.eq("siteId", site._id))
    .collect();
  const existing = rows.find((q) => !q.unitId && !q.revokedAt && q.enabled);
  if (existing) return existing;
  const paused = rows.find((q) => !q.unitId && !q.revokedAt);
  if (paused) {
    await ctx.db.patch("timbreQrs", paused._id, {
      enabled: true,
      updatedAt: Date.now(),
    });
    return { ...paused, enabled: true };
  }
  if (
    rows.filter((q) => !q.revokedAt).length >=
    Math.min(license.limits.maxQrs, 1000)
  )
    throw new ConvexError(
      "El plan no tiene lugar para otro QR. Revisá los QR de este timbre.",
    );
  const now = Date.now(),
    id = await ctx.db.insert("timbreQrs", {
      siteId: site._id,
      label: "Entrada principal",
      token: randomCapability(),
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
  await recordTimbreAudit(ctx, site._id, site.ownerId, "qr.created", id);
  return (await ctx.db.get("timbreQrs", id))!;
}
async function connectCalls(
  ctx: MutationCtx,
  space: Doc<"teavisoSpaces">,
  licenseId: Id<"timbreLicenses">,
) {
  const license = await requireValidTimbreLicense(
    ctx,
    licenseId,
    space.ownerId,
  );
  if (!allowed(license, space.kind))
    throw new ConvexError(
      "El plan seleccionado no incluye llamadas para este tipo de lugar.",
    );
  if (
    (space.bookingsEnabled && !license.features.bookings) ||
    (space.portalEnabled && !license.features.templates)
  )
    throw new ConvexError(
      "Elegí un plan que también incluya las reservas y mensajes que ya tenés activos.",
    );
  const linked = await linkedSite(ctx, space);
  let site = linked ? await ctx.db.get("timbreSites", linked) : null;
  if (site && site.ownerId !== space.ownerId)
    throw new ConvexError("El timbre conectado no pertenece a tu cuenta.");
  if (site && site.licenseId !== licenseId)
    throw new ConvexError(
      "Este timbre ya usa otro plan. Revisalo desde Ajustes avanzados.",
    );
  if (!site) {
    if (
      (await locationUsage(ctx, space.ownerId, licenseId, space._id)) >=
      Math.min(license.limits.maxSites, 100)
    )
      throw new ConvexError(
        "El plan ya tiene todos sus timbres en uso. Podés elegir otro plan o administrar los existentes.",
      );
    const now = Date.now(),
      id = await ctx.db.insert("timbreSites", {
        ownerId: space.ownerId,
        licenseId,
        kind:
          space.kind === "building"
            ? "building"
            : space.kind === "home"
              ? "home"
              : "office",
        name: space.name,
        timezone: space.timezone,
        enabled: space.enabled,
        allowedAudio: license.features.audio,
        allowedVideo: license.features.video,
        chatEnabled: license.features.chat,
        messagesEnabled: license.features.messages,
        notificationsEnabled: true,
        schedule: [],
        recipientIds: [space.ownerId],
        fallbackRecipientIds: [],
        fallbackAfterSeconds: 20,
        createdAt: now,
        updatedAt: now,
      });
    await ctx.db.insert("timbreMembers", {
      siteId: id,
      userId: space.ownerId,
      role: "owner",
      unitIds: [],
      canReceive: true,
      createdAt: now,
      updatedAt: now,
    });
    await recordTimbreAudit(ctx, id, space.ownerId, "site.created", id);
    site = (await ctx.db.get("timbreSites", id))!;
  }
  if (
    site.kind === "building" &&
    !(await ctx.db
      .query("timbreUnits")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .first())
  ) {
    if (license.limits.maxUnits < 1)
      throw new ConvexError(
        "El plan no permite configurar unidades del edificio.",
      );
    const now = Date.now();
    await ctx.db.insert("timbreUnits", {
      siteId: site._id,
      name: "Recepción",
      enabled: true,
      recipientIds: [space.ownerId],
      order: 0,
      createdAt: now,
      updatedAt: now,
    });
  }
  const qr = await commonQr(ctx, site, license);
  if (space.enabled && !site.enabled)
    await ctx.db.patch("timbreSites", site._id, {
      enabled: true,
      updatedAt: Date.now(),
    });
  return { siteId: site._id, qrId: qr._id, licenseId: license._id };
}
export const options = query({
  args: { kind: spaceKind, spaceId: v.optional(v.id("teavisoSpaces")) },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const target = args.spaceId ? await owned(ctx, args.spaceId) : null;
    const targetSite = target ? await linkedSite(ctx, target) : undefined;
    const rows = await ctx.db
        .query("timbreLicenses")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .collect(),
      plans = [];
    for (const row of rows) {
      const valid = await getValidTimbreLicense(ctx, row._id, user._id);
      if (
        !valid ||
        !allowed(valid, args.kind) ||
        (target?.bookingsEnabled && !valid.features.bookings) ||
        (target?.portalEnabled && !valid.features.templates)
      )
        continue;
      const used = await locationUsage(
        ctx,
        user._id,
        row._id,
        args.spaceId,
        targetSite,
      );
      plans.push({
        id: row._id,
        name: row.planName,
        remaining: Math.max(0, Math.min(row.limits.maxSites, 100) - used),
      });
    }
    const qr = target?.timbreQrId
      ? await ctx.db.get("timbreQrs", target.timbreQrId)
      : null;
    const site = qr ? await ctx.db.get("timbreSites", qr.siteId) : null;
    const entitlement =
      site?.ownerId === user._id
        ? await getValidTimbreLicense(ctx, site.licenseId, user._id)
        : null;
    const hasUnits =
      site?.kind !== "building" ||
      !!(await ctx.db
        .query("timbreUnits")
        .withIndex("by_site_enabled", (q) =>
          q.eq("siteId", site!._id).eq("enabled", true),
        )
        .first());
    const configured =
      !!qr &&
      !qr.revokedAt &&
      !!site &&
      hasUnits &&
      !!entitlement &&
      (entitlement.features.audio || entitlement.features.video);
    return {
      plans,
      calls: {
        configured,
        enabled:
          configured && !!target?.enabled && !!site?.enabled && !!qr?.enabled,
      },
    };
  },
});
export const create = mutation({
  args: {
    key: v.string(),
    method,
    name: v.string(),
    kind: spaceKind,
    timezone: v.string(),
    phone: v.optional(v.string()),
    consent: v.boolean(),
    licenseId: v.optional(v.id("timbreLicenses")),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    if (!/^[a-f0-9]{64}$/.test(args.key))
      throw new ConvexError("Volvé a abrir la configuración.");
    const previous = await ctx.db
      .query("teavisoSpaces")
      .withIndex("by_owner_setup", (q) =>
        q.eq("ownerId", user._id).eq("setupKey", args.key),
      )
      .unique();
    if (previous) return previous._id;
    const name = teavisoText(args.name, 100),
      timezone = validTimezone(args.timezone),
      wantsWhatsapp = args.method !== "calls",
      wantsCalls = args.method !== "whatsapp";
    const phone = wantsWhatsapp ? whatsappPhone(args.phone ?? "") : undefined;
    if (wantsWhatsapp && !args.consent)
      throw new ConvexError("Confirmá que podés usar ese número de WhatsApp.");
    if (wantsCalls && !args.licenseId)
      throw new ConvexError(
        "Elegí un plan que incluya llamadas antes de continuar.",
      );
    if (
      (
        await ctx.db
          .query("teavisoSpaces")
          .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
          .take(50)
      ).length >= 50
    )
      throw new ConvexError("Alcanzaste el límite de timbres de la cuenta.");
    const token = randomCapability(),
      now = Date.now();
    let whatsappQrId: Id<"teavisoWhatsappQrs"> | undefined;
    if (phone)
      whatsappQrId = await ctx.db.insert("teavisoWhatsappQrs", {
        ownerId: user._id,
        label: name,
        phone,
        message: generalMessage,
        token,
        enabled: true,
        archived: false,
        consentAt: now,
        createdAt: now,
        updatedAt: now,
      });
    const id = await ctx.db.insert("teavisoSpaces", {
      ownerId: user._id,
      name,
      kind: args.kind,
      token,
      timezone,
      phone,
      message: generalMessage,
      whatsappQrId,
      setupKey: args.key,
      enabled: true,
      schedule: hours(args.kind),
      bookingsEnabled: false,
      portalEnabled: false,
      autoConfirm: true,
      leadMinutes: 60,
      horizonDays: 30,
      cancelHours: 2,
      templates: [],
      revision: 1,
      createdAt: now,
      updatedAt: now,
    });
    if (wantsCalls) {
      const space = (await ctx.db.get("teavisoSpaces", id))!,
        connection = await connectCalls(ctx, space, args.licenseId!);
      await ctx.db.patch("teavisoSpaces", id, {
        timbreSiteId: connection.siteId,
        timbreQrId: connection.qrId,
        licenseId: connection.licenseId,
      });
    }
    await enrollTeaviso(ctx, user._id);
    return id;
  },
});
export const activateCalls = mutation({
  args: {
    spaceId: v.id("teavisoSpaces"),
    revision: v.number(),
    licenseId: v.id("timbreLicenses"),
  },
  handler: async (ctx, args) => {
    const space = await owned(ctx, args.spaceId);
    if (space.revision !== args.revision)
      throw new ConvexError(
        "La configuración cambió. Recargá antes de continuar.",
      );
    const link = await connectCalls(ctx, space, args.licenseId);
    await ctx.db.patch("teavisoSpaces", space._id, {
      timbreSiteId: link.siteId,
      timbreQrId: link.qrId,
      licenseId: link.licenseId,
      revision: space.revision + 1,
      updatedAt: Date.now(),
    });
    return link.siteId;
  },
});
export const saveBasics = mutation({
  args: {
    spaceId: v.id("teavisoSpaces"),
    revision: v.number(),
    name: v.string(),
    phone: v.string(),
    message: v.string(),
    enabled: v.boolean(),
    consent: v.boolean(),
  },
  handler: async (ctx, args) => {
    const space = await owned(ctx, args.spaceId);
    if (space.revision !== args.revision)
      throw new ConvexError(
        "Este timbre cambió en otra ventana. Recargá antes de guardar.",
      );
    const name = teavisoText(args.name, 100),
      phone = args.phone.trim() ? whatsappPhone(args.phone) : undefined,
      message = teavisoText(args.message, 500, false),
      now = Date.now();
    if (phone && phone !== space.phone && !args.consent)
      throw new ConvexError("Confirmá que podés usar este número de WhatsApp.");
    if (space.whatsappQrId && !phone)
      throw new ConvexError("Completá el número de WhatsApp de este timbre.");
    let whatsappQrId = space.whatsappQrId;
    if (whatsappQrId) {
      const qr = await ctx.db.get("teavisoWhatsappQrs", whatsappQrId);
      if (!qr || qr.ownerId !== space.ownerId || qr.archived)
        throw new ConvexError(
          "El contacto fue eliminado. Revisá el timbre antes de continuar.",
        );
      await ctx.db.patch("teavisoWhatsappQrs", qr._id, {
        label: name,
        phone: phone!,
        message,
        enabled: args.enabled,
        updatedAt: now,
      });
    } else if (phone)
      whatsappQrId = await ctx.db.insert("teavisoWhatsappQrs", {
        ownerId: space.ownerId,
        label: name,
        phone,
        message,
        token: space.token,
        enabled: args.enabled,
        archived: false,
        consentAt: now,
        createdAt: now,
        updatedAt: now,
      });
    await ctx.db.patch("teavisoSpaces", space._id, {
      name,
      phone,
      message,
      enabled: args.enabled,
      whatsappQrId,
      revision: space.revision + 1,
      updatedAt: now,
    });
    const siteId = await linkedSite(ctx, space);
    if (space.enabled !== args.enabled && space.timbreQrId) {
      const qr = await ctx.db.get("timbreQrs", space.timbreQrId);
      if (qr && !qr.revokedAt && qr.siteId === siteId)
        await ctx.db.patch("timbreQrs", qr._id, {
          enabled: args.enabled,
          updatedAt: now,
        });
    }
    if (siteId) {
      const siblings = await ctx.db
        .query("teavisoSpaces")
        .withIndex("by_owner", (q) => q.eq("ownerId", space.ownerId))
        .collect();
      if (
        !siblings.some((s) => s._id !== space._id && s.timbreSiteId === siteId)
      ) {
        const site = await ctx.db.get("timbreSites", siteId);
        if (site?.ownerId === space.ownerId)
          await ctx.db.patch("timbreSites", siteId, {
            name,
            enabled: args.enabled,
            updatedAt: now,
          });
      }
    }
  },
});
export const adoptDigital = mutation({
  args: { siteId: v.id("timbreSites") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx),
      site = await ctx.db.get("timbreSites", args.siteId);
    if (!site || site.ownerId !== user._id)
      throw new ConvexError(
        "Solo el propietario puede configurar este timbre.",
      );
    const previous = await linkedSpace(ctx, user._id, site._id);
    if (previous) return previous._id;
    if (
      (
        await ctx.db
          .query("teavisoSpaces")
          .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
          .take(50)
      ).length >= 50
    )
      throw new ConvexError("Alcanzaste el límite de timbres.");
    const all = await ctx.db
      .query("timbreQrs")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .collect();
    let qr =
      all.find((q) => !q.unitId && !q.revokedAt && q.enabled) ??
      all.find((q) => !q.unitId && !q.revokedAt);
    if (!qr) {
      const license = await requireValidTimbreLicense(
        ctx,
        site.licenseId,
        user._id,
      );
      qr = await commonQr(ctx, site, license);
    }
    const kind = site.kind,
      now = Date.now();
    await enrollTeaviso(ctx, user._id);
    return ctx.db.insert("teavisoSpaces", {
      ownerId: user._id,
      name: site.name,
      kind,
      token: qr.token,
      timezone: site.timezone,
      enabled: site.enabled && qr.enabled,
      message: generalMessage,
      timbreSiteId: site._id,
      timbreQrId: qr._id,
      licenseId: site.licenseId,
      schedule: site.schedule.length
        ? site.schedule.map((h) => ({
            day: h.day,
            start: Number(h.start.slice(0, 2)) * 60 + Number(h.start.slice(3)),
            end:
              h.end === "00:00"
                ? 1440
                : Number(h.end.slice(0, 2)) * 60 + Number(h.end.slice(3)),
          }))
        : [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, start: 0, end: 1440 })),
      bookingsEnabled: false,
      portalEnabled: false,
      autoConfirm: true,
      leadMinutes: 60,
      horizonDays: 30,
      cancelHours: 2,
      templates: [],
      revision: 1,
      createdAt: now,
      updatedAt: now,
    });
  },
});
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx),
      spaces = await ctx.db
        .query("teavisoSpaces")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .collect(),
      whatsapp = await ctx.db
        .query("teavisoWhatsappQrs")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .collect(),
      members = await ctx.db
        .query("timbreMembers")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
    const rows: {
      id: string;
      source: "space" | "whatsapp" | "site";
      name: string;
      enabled: boolean;
      method: string;
      owner: boolean;
    }[] = spaces.map((s) => ({
      id: s._id,
      source: "space",
      name: s.name,
      enabled: s.enabled,
      method: s.phone
        ? s.timbreQrId
          ? "WhatsApp y llamadas"
          : "WhatsApp"
        : s.timbreQrId
          ? "Llamadas Te Aviso"
          : s.bookingsEnabled
            ? "Reservas"
            : "Configuración pendiente",
      owner: true,
    }));
    for (const qr of whatsapp)
      if (!qr.archived && !spaces.some((s) => s.whatsappQrId === qr._id))
        rows.push({
          id: qr._id,
          source: "whatsapp",
          name: qr.label,
          enabled: qr.enabled,
          method: "WhatsApp",
          owner: true,
        });
    for (const member of members) {
      const site = await ctx.db.get("timbreSites", member.siteId);
      if (!site || spaces.some((s) => s.timbreSiteId === site._id)) continue;
      rows.push({
        id: site._id,
        source: "site",
        name: site.name,
        enabled: site.enabled,
        method: "Llamadas Te Aviso",
        owner: site.ownerId === user._id,
      });
    }
    return rows;
  },
});
