import { enrollTeaviso } from "./lib/teaviso_accounts";
import { locationUsage, linkedSpace, linkedSite } from "./lib/teaviso_quota";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireCurrentUser } from "./lib/current_user";
import { getValidTimbreLicense, requireValidTimbreLicense } from "./lib/timbre_commerce";
import {
  effectiveTimbreFeatures, hashTimbreToken, newTimbreToken, recordTimbreAudit,
  requireActiveTimbreLicense, requireSiteMember, resolvePublicQr, timbreError,
  validateTimbreSchedule, validateTimbreTimezone, validateStoredTimbreDesign,
} from "./lib/timbre_access";
import { timbreQrDesign, timbreSchedule, timbreSiteKind } from "./timbre_tables";

const managers = ["owner", "manager"] as const;
type ReadCtx = QueryCtx | MutationCtx;
function text(value: string, max = 100) {
  const result = value.trim();
  if (!result || result.length > max || [...result].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) timbreError(`Usá un texto entre 1 y ${max} caracteres.`);
  return result;
}
function optionalText(value: string | undefined, max = 300) { return value?.trim() ? text(value, max) : undefined; }
function uniqueIds<T extends string>(values: T[]) { return [...new Set(values)]; }

async function siteUnits(ctx: ReadCtx, siteId: Id<"timbreSites">) {
  return await ctx.db.query("timbreUnits").withIndex("by_site", (q) => q.eq("siteId", siteId)).take(1001);
}
async function siteMembers(ctx: ReadCtx, siteId: Id<"timbreSites">) {
  return await ctx.db.query("timbreMembers").withIndex("by_site", (q) => q.eq("siteId", siteId)).take(1001);
}
async function validateUnits(ctx: ReadCtx, siteId: Id<"timbreSites">, unitIds: Id<"timbreUnits">[]) {
  const values = uniqueIds(unitIds);
  if (values.length > 100) timbreError("Elegí hasta 100 unidades por integrante.");
  for (const id of values) {
    const unit = await ctx.db.get("timbreUnits", id);
    if (!unit || unit.siteId !== siteId || !unit.enabled) timbreError("Una unidad no pertenece a este Timbre o está desactivada.");
  }
  return values;
}
async function validateRecipients(ctx: ReadCtx, siteId: Id<"timbreSites">, ids: Id<"users">[], unitId?: Id<"timbreUnits">) {
  const values = uniqueIds(ids);
  if (values.length > 100) timbreError("Elegí hasta 100 destinatarios.");
  const members = await siteMembers(ctx, siteId);
  for (const id of values) {
    const member = members.find((row) => row.userId === id && row.canReceive);
    if (!member || (unitId && member.role === "resident" && !member.unitIds.includes(unitId))) {
      timbreError("Cada destinatario debe ser un integrante habilitado de este Timbre y unidad.");
    }
  }
  return values;
}
async function requireQrManager(ctx: ReadCtx, qrId: Id<"timbreQrs">) {
  const qr = await ctx.db.get("timbreQrs", qrId);
  if (!qr) timbreError("No se encontró este QR.");
  return { qr, ...await requireSiteMember(ctx, qr.siteId, managers) };
}

export const workspace = query({ args: {}, handler: async (ctx) => {
  const user = await requireCurrentUser(ctx);
  const memberships = await ctx.db.query("timbreMembers").withIndex("by_user", (q) => q.eq("userId", user._id)).take(101);
  const sites = [];
  for (const membership of memberships) {
    const site = await ctx.db.get("timbreSites", membership.siteId);
    if (!site) continue;
    const license = await getValidTimbreLicense(ctx, site.licenseId, site.ownerId);
    sites.push({ ...site, role: membership.role, licenseActive: !!license,
      licensedFeatures: license?.features ?? null,
      features: license ? effectiveTimbreFeatures(site, license.features) : null });
  }
  return { sites, memberships };
} });

export const createSite = mutation({
  args: { name: v.string(), kind: timbreSiteKind, licenseId: v.id("timbreLicenses"), timezone: v.string(), teavisoSpaceId: v.optional(v.id("teavisoSpaces")) },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    await enrollTeaviso(ctx, user._id);
    const license = await requireValidTimbreLicense(ctx, args.licenseId, user._id);
    if (args.kind === "building" && !license.features.buildings) timbreError("Tu licencia no incluye edificios.");
    if (args.kind === "office" && !license.features.offices) timbreError("Tu licencia no incluye oficinas.");
    const space=args.teavisoSpaceId?await ctx.db.get("teavisoSpaces",args.teavisoSpaceId):null;
    if(args.teavisoSpaceId&&(!space||space.ownerId!==user._id))timbreError("No tenés acceso a esta entrada.");
    if(space&&await linkedSite(ctx,space))timbreError("Esta entrada ya tiene un timbre digital vinculado.");
    if(space?.kind==="building"&&args.kind!=="building")timbreError("Elegí el tipo edificio para esta entrada.");
    if (await locationUsage(ctx,user._id,license._id,space?._id) >= Math.min(license.limits.maxSites, 100)) timbreError("Alcanzaste el límite de Timbres de esta licencia.");
    const now = Date.now();
    const siteId = await ctx.db.insert("timbreSites", {
      ownerId: user._id, licenseId: license._id, name: text(args.name), kind: args.kind,
      timezone: validateTimbreTimezone(args.timezone), enabled: true,
      allowedAudio: license.features.audio, allowedVideo: license.features.video,
      chatEnabled: license.features.chat, messagesEnabled: license.features.messages,
      notificationsEnabled: true, schedule: [], recipientIds: [user._id], fallbackRecipientIds: [],
      fallbackAfterSeconds: 20, createdAt: now, updatedAt: now,
    });
    await ctx.db.insert("timbreMembers", { siteId, userId: user._id, role: "owner", unitIds: [], canReceive: true, createdAt: now, updatedAt: now });
    if(space)await ctx.db.patch("teavisoSpaces",space._id,{timbreSiteId:siteId,licenseId:license._id,revision:space.revision+1,updatedAt:now});
    await recordTimbreAudit(ctx, siteId, user._id, "site.created", siteId);
    return siteId;
  },
});

export const saveSiteSettings = mutation({
  args: { siteId: v.id("timbreSites"), name: v.optional(v.string()), timezone: v.optional(v.string()),
    enabled: v.optional(v.boolean()), allowedAudio: v.optional(v.boolean()), allowedVideo: v.optional(v.boolean()),
    chatEnabled: v.optional(v.boolean()), messagesEnabled: v.optional(v.boolean()), notificationsEnabled: v.optional(v.boolean()),
    mutedUntil: v.optional(v.union(v.number(), v.null())), schedule: v.optional(timbreSchedule),
    recipientIds: v.optional(v.array(v.id("users"))), fallbackRecipientIds: v.optional(v.array(v.id("users"))),
    fallbackAfterSeconds: v.optional(v.number()), absenceMessage: v.optional(v.string()),
    signalStatusOnAccept: v.optional(v.boolean()), ringStatusId: v.optional(v.union(v.id("statuses"), v.null())) },
  handler: async (ctx, args) => {
    const { site, user } = await requireSiteMember(ctx, args.siteId, managers);
    if ((args.ringStatusId !== undefined || args.signalStatusOnAccept !== undefined) && user._id !== site.ownerId) timbreError("Solo el propietario puede configurar la señalización de sus dispositivos.");
    if (args.ringStatusId) {
      const status = await ctx.db.get("statuses", args.ringStatusId);
      if (status?.userId !== site.ownerId) timbreError("Elegí un estado de la cuenta propietaria.");
      await requireActiveTimbreLicense(ctx, site);
    }
    // Expired owners can still disable their QR/service or turn off a capability.
    const needsLicense = args.enabled === true || args.allowedAudio === true || args.allowedVideo === true ||
      args.chatEnabled === true || args.messagesEnabled === true || args.recipientIds !== undefined || args.fallbackRecipientIds !== undefined;
    const license = needsLicense ? (await requireActiveTimbreLicense(ctx, site)).license : null;
    for (const [setting, feature] of [["allowedAudio", "audio"], ["allowedVideo", "video"], ["chatEnabled", "chat"], ["messagesEnabled", "messages"]] as const) {
      if (args[setting] && !license?.features[feature]) timbreError("Esta función no está incluida en tu licencia.");
    }
    if (args.fallbackAfterSeconds !== undefined && (!Number.isInteger(args.fallbackAfterSeconds) || args.fallbackAfterSeconds < 10 || args.fallbackAfterSeconds > 120)) {
      timbreError("El aviso alternativo debe esperar entre 10 y 120 segundos.");
    }
    if (typeof args.mutedUntil === "number" && (!Number.isFinite(args.mutedUntil) || args.mutedUntil < Date.now() || args.mutedUntil > Date.now() + 366 * 86400_000)) {
      timbreError("Elegí una fecha de silencio durante el próximo año.");
    }
    const { siteId: _siteId, ...supplied } = args;
    void _siteId;
    const patch: Partial<Doc<"timbreSites">> = { ...supplied, ringStatusId: args.ringStatusId ?? undefined, mutedUntil: args.mutedUntil ?? undefined, updatedAt: Date.now() };
    if (args.ringStatusId === undefined) delete patch.ringStatusId;
    if (args.mutedUntil === undefined) delete patch.mutedUntil;
    if (args.name !== undefined) patch.name = text(args.name);
    if (args.timezone !== undefined) patch.timezone = validateTimbreTimezone(args.timezone);
    if (args.absenceMessage !== undefined) patch.absenceMessage = optionalText(args.absenceMessage, 500);
    if (args.schedule !== undefined) patch.schedule = validateTimbreSchedule(args.schedule);
    if (args.recipientIds !== undefined) patch.recipientIds = await validateRecipients(ctx, site._id, args.recipientIds);
    if (args.fallbackRecipientIds !== undefined) patch.fallbackRecipientIds = await validateRecipients(ctx, site._id, args.fallbackRecipientIds);
    await ctx.db.patch("timbreSites", site._id, patch);
    await recordTimbreAudit(ctx, site._id, user._id, "site.settings_updated", site._id);
  },
});

export const changeSiteLicense = mutation({ args: { siteId: v.id("timbreSites"), licenseId: v.id("timbreLicenses") }, handler: async (ctx, args) => {
  const { site, user } = await requireSiteMember(ctx, args.siteId, ["owner"]);
  const license = await requireValidTimbreLicense(ctx, args.licenseId, user._id);
  if (site.kind === "building" && !license.features.buildings) timbreError("La licencia nueva no incluye edificios.");
  if (site.kind === "office" && !license.features.offices) timbreError("La licencia nueva no incluye oficinas.");
  const [qrs, members, units] = await Promise.all([
    ctx.db.query("timbreQrs").withIndex("by_site_revoked", (q) => q.eq("siteId", site._id).eq("revokedAt", undefined)).take(1001),
    siteMembers(ctx, site._id),
    ctx.db.query("timbreUnits").withIndex("by_site_enabled", (q) => q.eq("siteId", site._id).eq("enabled", true)).take(1001),
  ]);
  const associated=await linkedSpace(ctx,user._id,site._id);
  if (await locationUsage(ctx,user._id,license._id,associated?._id,site._id) >= Math.min(license.limits.maxSites, 100) ||
      qrs.length > Math.min(license.limits.maxQrs, 1000) || members.length > Math.min(license.limits.maxMembers, 1000) ||
      units.length > Math.min(license.limits.maxUnits, 1000) || (site.kind === "home" && members.length > 1 && !license.features.families)) {
    timbreError("La licencia nueva no alcanza para los QR, integrantes o unidades de este Timbre. Elegí un plan compatible o reducí la configuración.");
  }
  await ctx.db.patch("timbreSites", site._id, { licenseId: license._id, updatedAt: Date.now() });
  if(associated)await ctx.db.patch("teavisoSpaces",associated._id,{licenseId:license._id,revision:associated.revision+1,updatedAt:Date.now()});
  await recordTimbreAudit(ctx, site._id, user._id, "site.license_changed", license._id);
} });

export const listQrs = query({ args: { siteId: v.id("timbreSites") }, handler: async (ctx, { siteId }) => {
  const { membership } = await requireSiteMember(ctx, siteId);
  const qrs = await ctx.db.query("timbreQrs").withIndex("by_site", (q) => q.eq("siteId", siteId)).order("desc").take(1001);
  return membership.role === "resident" ? qrs.filter((qr) => qr.unitId && membership.unitIds.includes(qr.unitId)) : qrs;
} });
export const createQr = mutation({
  args: { siteId: v.id("timbreSites"), label: v.string(), unitId: v.optional(v.id("timbreUnits")) },
  handler: async (ctx, args) => {
    const { site, user } = await requireSiteMember(ctx, args.siteId, managers);
    const { limits } = await requireActiveTimbreLicense(ctx, site);
    if (args.unitId) await validateUnits(ctx, site._id, [args.unitId]);
    const qrs = await ctx.db.query("timbreQrs").withIndex("by_site_revoked", (q) => q.eq("siteId", site._id).eq("revokedAt", undefined)).take(1001);
    if (qrs.length >= Math.min(limits.maxQrs, 1000)) timbreError("Alcanzaste el límite de QR de esta licencia.");
    const now = Date.now();
    const qrId = await ctx.db.insert("timbreQrs", { siteId: site._id, ...(args.unitId ? { unitId: args.unitId } : {}),
      label: text(args.label), token: newTimbreToken(), enabled: true, createdAt: now, updatedAt: now });
    const associated=await linkedSpace(ctx,site.ownerId,site._id);
    if(associated&&!associated.timbreQrId&&!args.unitId)await ctx.db.patch("teavisoSpaces",associated._id,{timbreQrId:qrId,revision:associated.revision+1,updatedAt:now});
    await recordTimbreAudit(ctx, site._id, user._id, "qr.created", qrId);
    return qrId;
  },
});
export const saveQr = mutation({ args: { qrId: v.id("timbreQrs"), label: v.optional(v.string()), enabled: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const { qr, site, user } = await requireQrManager(ctx, args.qrId);
    if (qr.revokedAt) timbreError("Este QR está revocado. Generá uno nuevo.");
    if (args.enabled) await requireActiveTimbreLicense(ctx, site);
    await ctx.db.patch("timbreQrs", qr._id, { ...(args.label !== undefined ? { label: text(args.label) } : {}),
      ...(args.enabled !== undefined ? { enabled: args.enabled } : {}), updatedAt: Date.now() });
    await recordTimbreAudit(ctx, site._id, user._id, "qr.updated", qr._id);
  } });
export const rotateQr = mutation({ args: { qrId: v.id("timbreQrs") }, handler: async (ctx, args) => {
  const { qr, site, user } = await requireQrManager(ctx, args.qrId);
  await requireActiveTimbreLicense(ctx, site);
  if (qr.revokedAt) timbreError("Este QR está revocado. Generá uno nuevo.");
  const plates = await Promise.all((["production", "ready"] as const).map((status) => ctx.db.query("timbrePlateOrders")
    .withIndex("by_qr_status", (q) => q.eq("qrId", qr._id).eq("status", status)).first()));
  if (plates.some(Boolean)) {
    timbreError("El QR está asociado a una placa en producción o lista para despachar. Esperá a que termine el pedido para cambiar su enlace.");
  }
  const token = newTimbreToken();
  await ctx.db.patch("timbreQrs", qr._id, { token, updatedAt: Date.now() });
  await recordTimbreAudit(ctx, site._id, user._id, "qr.rotated", qr._id);
  return token;
} });
export const revokeQr = mutation({ args: { qrId: v.id("timbreQrs") }, handler: async (ctx, args) => {
  const { qr, site, user } = await requireQrManager(ctx, args.qrId);
  if (!qr.revokedAt) {
    await ctx.db.patch("timbreQrs", qr._id, { enabled: false, revokedAt: Date.now(), updatedAt: Date.now() });
    await recordTimbreAudit(ctx, site._id, user._id, "qr.revoked", qr._id);
  }
} });

export const saveQrDesign = mutation({ args: { qrId: v.id("timbreQrs"), design: timbreQrDesign }, handler: async (ctx, args) => {
  const { qr, site, user } = await requireQrManager(ctx, args.qrId);
  await requireActiveTimbreLicense(ctx, site);
  if (qr.revokedAt) timbreError("Este QR está revocado.");
  const full = validateStoredTimbreDesign(args.design);
  const existing = await ctx.db.query("timbreQrDesigns").withIndex("by_qr", (q) => q.eq("qrId", qr._id)).unique();
  const now = Date.now();
  if (existing) await ctx.db.replace("timbreQrDesigns", existing._id, { qrId: qr._id, design: full, updatedAt: now });
  else await ctx.db.insert("timbreQrDesigns", { qrId: qr._id, design: full, updatedAt: now });
  const { imageDataUrl: _image, ...summary } = full; void _image;
  await ctx.db.patch("timbreQrs", qr._id, { design: summary, updatedAt: now });
  await recordTimbreAudit(ctx, site._id, user._id, "qr.design_updated", qr._id);
} });
export const qrForExport = query({ args: { qrId: v.id("timbreQrs") }, handler: async (ctx, args) => {
  const { qr, site } = await requireQrManager(ctx, args.qrId);
  await requireActiveTimbreLicense(ctx, site);
  if (qr.revokedAt) timbreError("Este QR está revocado.");
  const stored = await ctx.db.query("timbreQrDesigns").withIndex("by_qr", (q) => q.eq("qrId", qr._id)).unique();
  return { qr: { ...qr, design: stored?.design ?? qr.design }, siteName: site.name, quietZoneModules: 4, errorCorrection: "H" as const };
} });

export const publicQr = query({ args: { qrToken: v.string() }, handler: async (ctx, { qrToken }) => {
  try {
    const { qr, site, unit, effectiveFeatures, availability } = await resolvePublicQr(ctx, qrToken);
    const units = unit ? [] : (await ctx.db.query("timbreUnits").withIndex("by_site_enabled", (q) => q.eq("siteId", site._id).eq("enabled", true)).take(1000))
      .sort((a, b) => a.order - b.order).map((row) => ({ id: row._id, name: row.name }));
    return { label: qr.label, siteName: site.name, kind: site.kind, units, ...(unit ? { unitId: unit._id, unitName: unit.name } : {}),
      audioEnabled: effectiveFeatures.audio, videoEnabled: effectiveFeatures.video, chatEnabled: effectiveFeatures.chat,
      messagesEnabled: effectiveFeatures.messages, ...availability, ...(site.absenceMessage ? { absenceMessage: site.absenceMessage } : {}) };
  } catch (error) {
    if (error instanceof ConvexError) return null;
    throw error;
  }
} });

export const listUnits = query({ args: { siteId: v.id("timbreSites") }, handler: async (ctx, { siteId }) => {
  const { membership } = await requireSiteMember(ctx, siteId);
  const units = await siteUnits(ctx, siteId);
  return units.filter((unit) => membership.role !== "resident" || membership.unitIds.includes(unit._id)).sort((a, b) => a.order - b.order);
} });
export const createUnit = mutation({ args: { siteId: v.id("timbreSites"), name: v.string() }, handler: async (ctx, args) => {
  const { site, user } = await requireSiteMember(ctx, args.siteId, managers);
  const { limits } = await requireActiveTimbreLicense(ctx, site);
  if (site.kind === "home") timbreError("Las unidades corresponden a edificios u oficinas.");
  const units = await siteUnits(ctx, site._id);
  const activeUnits = await ctx.db.query("timbreUnits").withIndex("by_site_enabled", (q) => q.eq("siteId", site._id).eq("enabled", true)).take(1001);
  if (activeUnits.length >= Math.min(limits.maxUnits, 1000)) timbreError("Alcanzaste el límite de unidades de esta licencia.");
  const now = Date.now();
  const unitId = await ctx.db.insert("timbreUnits", { siteId: site._id, name: text(args.name), enabled: true, recipientIds: [], order: units.length, createdAt: now, updatedAt: now });
  await recordTimbreAudit(ctx, site._id, user._id, "unit.created", unitId);
  return unitId;
} });
export const saveUnit = mutation({ args: { unitId: v.id("timbreUnits"), name: v.optional(v.string()), enabled: v.optional(v.boolean()), order: v.optional(v.number()), recipientIds: v.optional(v.array(v.id("users"))) },
  handler: async (ctx, args) => {
    const unit = await ctx.db.get("timbreUnits", args.unitId);
    if (!unit) timbreError("No se encontró esta unidad.");
    const { site, user } = await requireSiteMember(ctx, unit.siteId, managers);
    if (args.enabled || args.recipientIds) {
      const { limits } = await requireActiveTimbreLicense(ctx, site);
      const activeUnits = await ctx.db.query("timbreUnits").withIndex("by_site_enabled", (q) => q.eq("siteId", site._id).eq("enabled", true)).take(1001);
      if (args.enabled && !unit.enabled && activeUnits.length >= Math.min(limits.maxUnits, 1000)) {
        timbreError("Alcanzaste el límite de unidades de esta licencia.");
      }
    }
    if (args.order !== undefined && (!Number.isInteger(args.order) || args.order < 0 || args.order > 10000)) timbreError("Orden de unidad inválido.");
    await ctx.db.patch("timbreUnits", unit._id, { ...(args.name !== undefined ? { name: text(args.name) } : {}),
      ...(args.enabled !== undefined ? { enabled: args.enabled } : {}), ...(args.order !== undefined ? { order: args.order } : {}),
      ...(args.recipientIds !== undefined ? { recipientIds: await validateRecipients(ctx, site._id, args.recipientIds, unit._id) } : {}), updatedAt: Date.now() });
    await recordTimbreAudit(ctx, site._id, user._id, "unit.updated", unit._id);
  } });

export const listMembers = query({ args: { siteId: v.id("timbreSites") }, handler: async (ctx, { siteId }) => {
  const { membership } = await requireSiteMember(ctx, siteId);
  const members = await siteMembers(ctx, siteId);
  return await Promise.all(members.filter((row) => membership.role !== "resident" || row.userId === membership.userId).map(async (row) => {
    const user = await ctx.db.get("users", row.userId);
    return { ...row, name: user?.name ?? "Integrante", ...(membership.role !== "resident" && user?.email ? { email: user.email } : {}) };
  }));
} });
export const saveMember = mutation({ args: { memberId: v.id("timbreMembers"), role: v.optional(v.union(v.literal("manager"), v.literal("resident"))), unitIds: v.optional(v.array(v.id("timbreUnits"))), canReceive: v.optional(v.boolean()) }, handler: async (ctx, args) => {
  const member = await ctx.db.get("timbreMembers", args.memberId);
  if (!member) timbreError("No se encontró este integrante.");
  const { site, user, membership } = await requireSiteMember(ctx, member.siteId, managers);
  await requireActiveTimbreLicense(ctx, site);
  if (member.role === "owner" || (membership.role === "manager" && (member.role !== "resident" || args.role === "manager"))) timbreError("Solo el propietario puede administrar responsables. No se puede modificar al propietario.");
  await ctx.db.patch("timbreMembers", member._id, { ...(args.role ? { role: args.role } : {}),
    ...(args.unitIds ? { unitIds: await validateUnits(ctx, site._id, args.unitIds) } : {}), ...(args.canReceive !== undefined ? { canReceive: args.canReceive } : {}), updatedAt: Date.now() });
  if (args.canReceive === false) await pruneRecipients(ctx, site, member.userId);
  else if ((args.role ?? member.role) === "resident" && args.unitIds !== undefined) {
    for (const unit of await siteUnits(ctx, site._id)) {
      if (!args.unitIds.includes(unit._id) && unit.recipientIds.includes(member.userId)) {
        await ctx.db.patch("timbreUnits", unit._id, { recipientIds: unit.recipientIds.filter((id) => id !== member.userId), updatedAt: Date.now() });
      }
    }
  }
  await recordTimbreAudit(ctx, site._id, user._id, "member.updated", member._id);
} });
async function pruneRecipients(ctx: MutationCtx, site: Doc<"timbreSites">, userId: Id<"users">) {
  await ctx.db.patch("timbreSites", site._id, { recipientIds: site.recipientIds.filter((id) => id !== userId),
    fallbackRecipientIds: (site.fallbackRecipientIds ?? []).filter((id) => id !== userId), updatedAt: Date.now() });
  for (const unit of await siteUnits(ctx, site._id)) {
    if (unit.recipientIds.includes(userId)) await ctx.db.patch("timbreUnits", unit._id, { recipientIds: unit.recipientIds.filter((id) => id !== userId), updatedAt: Date.now() });
  }
}
export const removeMember = mutation({ args: { memberId: v.id("timbreMembers") }, handler: async (ctx, { memberId }) => {
  const member = await ctx.db.get("timbreMembers", memberId);
  if (!member) timbreError("No se encontró este integrante.");
  const { site, user, membership } = await requireSiteMember(ctx, member.siteId, managers);
  if (member.role === "owner" || (membership.role === "manager" && member.role !== "resident")) timbreError("No tenés permiso para quitar a este integrante.");
  await pruneRecipients(ctx, site, member.userId);
  await ctx.db.delete("timbreMembers", member._id);
  await recordTimbreAudit(ctx, site._id, user._id, "member.removed", member._id);
} });

export const createInvite = mutation({ args: { siteId: v.id("timbreSites"), role: v.union(v.literal("manager"), v.literal("resident")),
  email: v.optional(v.string()), unitIds: v.optional(v.array(v.id("timbreUnits"))), expiresInHours: v.optional(v.number()) }, handler: async (ctx, args) => {
  const { site, user, membership } = await requireSiteMember(ctx, args.siteId, managers);
  const { limits, features } = await requireActiveTimbreLicense(ctx, site);
  if (membership.role !== "owner" && args.role === "manager") timbreError("Solo el propietario puede invitar responsables.");
  if (site.kind === "home" && !features.families) timbreError("Tu licencia no incluye integrantes de la familia.");
  if ((await siteMembers(ctx, site._id)).length >= Math.min(limits.maxMembers, 1000)) timbreError("Alcanzaste el límite de integrantes de esta licencia.");
  const pending = await ctx.db.query("timbreInvitations").withIndex("by_site_pending", (q) => q.eq("siteId", site._id)
    .eq("acceptedAt", undefined).eq("revokedAt", undefined).gt("expiresAt", Date.now())).take(101);
  if (pending.length >= 100) timbreError("Ya hay 100 invitaciones pendientes.");
  const hours = args.expiresInHours ?? 48;
  if (!Number.isInteger(hours) || hours < 1 || hours > 168) timbreError("La invitación puede durar entre 1 y 168 horas.");
  const email = args.email?.trim().toLowerCase();
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) timbreError("Revisá el correo de la invitación.");
  const token = newTimbreToken(); const now = Date.now(); const expiresAt = now + hours * 3600_000;
  const invitationId = await ctx.db.insert("timbreInvitations", { siteId: site._id, role: args.role,
    unitIds: await validateUnits(ctx, site._id, args.unitIds ?? []), ...(email ? { email } : {}), tokenHash: await hashTimbreToken(token),
    expiresAt, createdBy: user._id, createdAt: now });
  await recordTimbreAudit(ctx, site._id, user._id, "invitation.created", invitationId);
  return { invitationId, token, expiresAt };
} });
export const listInvites = query({ args: { siteId: v.id("timbreSites") }, handler: async (ctx, { siteId }) => {
  await requireSiteMember(ctx, siteId, managers);
  return (await ctx.db.query("timbreInvitations").withIndex("by_site", (q) => q.eq("siteId", siteId)).order("desc").take(1001))
    .map(({ tokenHash: _secret, ...row }) => { void _secret; return row; });
} });
export const acceptInvite = mutation({ args: { token: v.string() }, handler: async (ctx, { token }) => {
  const user = await requireCurrentUser(ctx);
    await enrollTeaviso(ctx, user._id);
  if (!/^[a-f0-9]{64}$/.test(token)) timbreError("La invitación no es válida o venció.");
  const hash = await hashTimbreToken(token);
  const invite = await ctx.db.query("timbreInvitations").withIndex("by_hash", (q) => q.eq("tokenHash", hash)).unique();
  if (!invite || invite.revokedAt || invite.acceptedAt || invite.expiresAt <= Date.now()) timbreError("La invitación no es válida o venció.");
  if (invite.email && (user.email?.toLowerCase() !== invite.email || !user.emailVerificationTime)) timbreError("Ingresá con el correo verificado al que se envió esta invitación.");
  const site = await ctx.db.get("timbreSites", invite.siteId);
  if (!site) timbreError("El Timbre ya no está disponible.");
  const issuer = await ctx.db.query("timbreMembers").withIndex("by_site_user", (q) => q.eq("siteId", site._id).eq("userId", invite.createdBy)).unique();
  if (!issuer || (issuer.role !== "owner" && issuer.role !== "manager") ||
      (invite.role === "manager" && issuer.role !== "owner")) timbreError("La persona que te invitó ya no puede autorizar el acceso. Pedí una invitación nueva.");
  const { limits, features } = await requireActiveTimbreLicense(ctx, site);
  if (site.kind === "home" && !features.families) timbreError("La licencia no incluye integrantes de la familia.");
  const member = await ctx.db.query("timbreMembers").withIndex("by_site_user", (q) => q.eq("siteId", site._id).eq("userId", user._id)).unique();
  if (member) timbreError("Ya sos integrante de este Timbre.");
  if ((await siteMembers(ctx, site._id)).length >= Math.min(limits.maxMembers, 1000)) timbreError("Alcanzaste el límite de integrantes de esta licencia.");
  const unitIds = await validateUnits(ctx, site._id, invite.unitIds);
  const now = Date.now();
  await ctx.db.insert("timbreMembers", { siteId: site._id, userId: user._id, role: invite.role, unitIds, canReceive: true, createdAt: now, updatedAt: now });
  await ctx.db.patch("timbreInvitations", invite._id, { acceptedAt: now, acceptedBy: user._id });
  await recordTimbreAudit(ctx, site._id, user._id, "invitation.accepted", invite._id);
  return site._id;
} });
export const revokeInvite = mutation({ args: { invitationId: v.id("timbreInvitations") }, handler: async (ctx, { invitationId }) => {
  const invite = await ctx.db.get("timbreInvitations", invitationId);
  if (!invite) timbreError("No se encontró esta invitación.");
  const { user, membership } = await requireSiteMember(ctx, invite.siteId, managers);
  if (membership.role === "manager" && invite.role === "manager") timbreError("Solo el propietario puede administrar invitaciones de responsables.");
  if (!invite.revokedAt) await ctx.db.patch("timbreInvitations", invite._id, { revokedAt: Date.now() });
  await recordTimbreAudit(ctx, invite.siteId, user._id, "invitation.revoked", invite._id);
} });
export const auditHistory = query({ args: { siteId: v.id("timbreSites") }, handler: async (ctx, { siteId }) => {
  await requireSiteMember(ctx, siteId, managers);
  return await ctx.db.query("timbreAuditEvents").withIndex("by_site_created", (q) => q.eq("siteId", siteId)).order("desc").take(100);
} });
