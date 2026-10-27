import { locationUsage, linkedSite, linkedSpace } from "./lib/teaviso_quota";
import { ConvexError, v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireCurrentUser } from "./lib/current_user";
import { getValidTimbreLicense } from "./lib/timbre_commerce";
import { hashCapability, randomCapability } from "./lib/timbre_rtc";
import { teavisoText, whatsappPhone, whatsappUrl } from "./lib/teaviso";
import {
  DEFAULT_HOURS,
  dayBounds,
  intersects,
  localClock,
  occupies,
  permitsSlot,
  validTimezone,
  validateHours,
} from "./lib/teaviso_schedule";
import {
  bookingStatus,
  openingHours,
  spaceKind,
  visitTemplate,
} from "./teaviso_v2_tables";
type Read = QueryCtx | MutationCtx;
type Space = Doc<"teavisoSpaces">;
const HOUR = 3_600_000;
const pruneRef = makeFunctionReference<"mutation">("teaviso_spaces:pruneRate");
const expireRef = makeFunctionReference<"mutation">(
  "teaviso_spaces:expireBooking",
);
function fail(message: string): never {
  throw new ConvexError(message);
}
async function ownerSpace(ctx: Read, id: Id<"teavisoSpaces">) {
  const user = await requireCurrentUser(ctx),
    space = await ctx.db.get("teavisoSpaces", id);
  if (!space || space.ownerId !== user._id)
    fail("No tenés acceso a este espacio.");
  return space;
}
async function entry(ctx: Read, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const space = await ctx.db
    .query("teavisoSpaces")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!space?.enabled) return null;
  const legacy = space.whatsappQrId
    ? await ctx.db.get("teavisoWhatsappQrs", space.whatsappQrId)
    : null;
  if (
    space.whatsappQrId &&
    (!legacy ||
      legacy.ownerId !== space.ownerId ||
      !legacy.enabled ||
      legacy.archived)
  )
    return null;
  return {
    ...space,
    phone: legacy?.phone ?? space.phone,
    message: legacy?.message ?? space.message,
  };
}
async function capabilities(ctx: Read, space: Space) {
  const license = space.licenseId
    ? await getValidTimbreLicense(ctx, space.licenseId, space.ownerId)
    : null;
  return {
    bookings: license?.features.bookings === true,
    templates: license?.features.templates === true,
    license,
  };
}
async function licensedSpace(
  ctx: Read,
  space: Space,
  feature: "bookings" | "templates",
) {
  if (!(await capabilities(ctx, space))[feature])
    fail("Esta función requiere una licencia activa que la incluya.");
}
function tokenCheck(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token))
    fail("Revisá la solicitud y volvé a intentarlo.");
}
async function rate(
  ctx: MutationCtx,
  spaceId: Id<"teavisoSpaces">,
  nonce: string,
  kind: string,
) {
  tokenCheck(nonce);
  const bucket = Math.floor(Date.now() / HOUR),
    hash = await hashCapability(`${spaceId}:${nonce}`);
  for (const [suffix, maximum] of [
    ["all", 150],
    [hash, 8],
  ] as const) {
    const key = `${spaceId}:${kind}:${bucket}:${suffix}`;
    const row = await ctx.db
      .query("teavisoPublicRates")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if ((row?.count ?? 0) >= maximum)
      fail("Alcanzaste el límite de solicitudes. Intentá más tarde.");
    if (row)
      await ctx.db.patch("teavisoPublicRates", row._id, {
        count: row.count + 1,
      });
    else {
      const id = await ctx.db.insert("teavisoPublicRates", {
        key,
        count: 1,
        expiresAt: (bucket + 2) * HOUR,
      });
      await ctx.scheduler.runAfter(2 * HOUR, pruneRef, { id });
    }
  }
  return hash;
}
export const pruneRate = internalMutation({
  args: { id: v.id("teavisoPublicRates") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get("teavisoPublicRates", id);
    if (row && row.expiresAt <= Date.now())
      await ctx.db.delete("teavisoPublicRates", id);
  },
});
async function fitLicense(
  ctx: Read,
  space: Space,
  licenseId: Id<"timbreLicenses">,
  qrId: Id<"timbreQrs"> | undefined,
) {
  const license = await getValidTimbreLicense(ctx, licenseId, space.ownerId);
  if (!license) fail("Elegí una licencia activa de tu cuenta.");
  if (space.kind === "building" && !license.features.buildings)
    fail("La licencia debe incluir edificios.");
  if (space.kind === "office" && !license.features.offices)
    fail("La licencia debe incluir oficinas.");
  const desiredSite = qrId
    ? (await ctx.db.get("timbreQrs", qrId))?.siteId
    : await linkedSite(ctx, space);
  const occupied = desiredSite
    ? await linkedSpace(ctx, space.ownerId, desiredSite)
    : null;
  if (occupied && occupied._id !== space._id)
    fail("Ese timbre ya está vinculado a otra entrada.");
  const site = desiredSite
    ? await ctx.db.get("timbreSites", desiredSite)
    : null;
  const contribution = site?.licenseId === licenseId ? 0 : 1;
  if (
    (await locationUsage(ctx, space.ownerId, licenseId, space._id)) +
      contribution >
    license.limits.maxSites
  )
    fail("La licencia no tiene cupo para otro espacio.");
}
async function ownedQr(ctx: Read, ownerId: Id<"users">, id: Id<"timbreQrs">) {
  const qr = await ctx.db.get("timbreQrs", id),
    site = qr ? await ctx.db.get("timbreSites", qr.siteId) : null;
  if (!qr || !site || site.ownerId !== ownerId || qr.revokedAt)
    fail("Elegí un QR digital de tu cuenta.");
  return { qr, site };
}
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const rows = await ctx.db
      .query("teavisoSpaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    return Promise.all(
      rows.map(async (s) => ({
        ...s,
        capabilities: {
          bookings: (await capabilities(ctx, s)).bookings,
          templates: (await capabilities(ctx, s)).templates,
        },
      })),
    );
  },
});
export const get = query({
  args: { spaceId: v.id("teavisoSpaces") },
  handler: async (ctx, { spaceId }) => {
    const space = await ownerSpace(ctx, spaceId),
      caps = await capabilities(ctx, space);
    const legacy = space.whatsappQrId
      ? await ctx.db.get("teavisoWhatsappQrs", space.whatsappQrId)
      : null;
    return {
      ...space,
      phone: legacy?.phone ?? space.phone,
      message: legacy?.message ?? space.message,
      capabilities: { bookings: caps.bookings, templates: caps.templates },
      services: await ctx.db
        .query("teavisoServices")
        .withIndex("by_space", (q) => q.eq("spaceId", spaceId))
        .collect(),
      professionals: await ctx.db
        .query("teavisoProfessionals")
        .withIndex("by_space", (q) => q.eq("spaceId", spaceId))
        .collect(),
    };
  },
});
export const create = mutation({
  args: {
    name: v.string(),
    kind: spaceKind,
    timezone: v.string(),
    phone: v.optional(v.string()),
    consent: v.boolean(),
    existingQrId: v.optional(v.id("teavisoWhatsappQrs")),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx),
      rows = await ctx.db
        .query("teavisoSpaces")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .take(50);
    if (rows.length >= 50)
      fail("Alcanzaste el límite de espacios de la cuenta.");
    const name = teavisoText(args.name, 100),
      timezone = validTimezone(args.timezone),
      now = Date.now();
    let token = randomCapability(),
      phone = args.phone ? whatsappPhone(args.phone) : undefined,
      whatsappQrId = args.existingQrId;
    let message = "Hola, estoy en la entrada. ¿Podés atenderme?",
      enabled = true;
    if (whatsappQrId) {
      const qr = await ctx.db.get("teavisoWhatsappQrs", whatsappQrId);
      if (!qr || qr.ownerId !== user._id || qr.archived)
        fail("No tenés acceso a esta entrada.");
      const duplicate = await ctx.db
        .query("teavisoSpaces")
        .withIndex("by_whatsapp", (q) => q.eq("whatsappQrId", whatsappQrId))
        .unique();
      if (duplicate) return duplicate._id;
      token = qr.token;
      phone = qr.phone;
      message = qr.message;
      enabled = qr.enabled;
    } else if (phone) {
      if (!args.consent)
        fail("Confirmá que podés publicar este contacto de WhatsApp.");
      whatsappQrId = await ctx.db.insert("teavisoWhatsappQrs", {
        ownerId: user._id,
        label: name,
        phone,
        message,
        token,
        enabled: true,
        archived: false,
        consentAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
    return ctx.db.insert("teavisoSpaces", {
      ownerId: user._id,
      name,
      kind: args.kind,
      token,
      timezone,
      phone,
      message,
      whatsappQrId,
      enabled,
      schedule:
        args.kind === "home" || args.kind === "building"
          ? [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, start: 0, end: 1440 }))
          : DEFAULT_HOURS,
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
export const configure = mutation({
  args: {
    spaceId: v.id("teavisoSpaces"),
    revision: v.number(),
    name: v.string(),
    enabled: v.boolean(),
    timezone: v.string(),
    phone: v.string(),
    message: v.string(),
    consent: v.boolean(),
    schedule: openingHours,
    bookingsEnabled: v.boolean(),
    portalEnabled: v.boolean(),
    autoConfirm: v.boolean(),
    leadMinutes: v.number(),
    horizonDays: v.number(),
    cancelHours: v.number(),
    licenseId: v.union(v.id("timbreLicenses"), v.null()),
    timbreQrId: v.union(v.id("timbreQrs"), v.null()),
    templates: v.array(visitTemplate),
  },
  handler: async (ctx, args) => {
    const space = await ownerSpace(ctx, args.spaceId);
    if (space.revision !== args.revision)
      fail(
        "La configuración cambió en otra ventana. Recargá antes de guardar.",
      );
    const name = teavisoText(args.name, 100),
      phone = args.phone.trim() ? whatsappPhone(args.phone) : undefined,
      message = teavisoText(args.message, 500, false);
    if (phone !== space.phone && phone && !args.consent)
      fail("Confirmá que podés publicar este contacto.");
    const timezone = validTimezone(args.timezone),
      schedule = validateHours(args.schedule);
    for (const [value, min, max] of [
      [args.leadMinutes, 0, 10080],
      [args.horizonDays, 1, 90],
      [args.cancelHours, 0, 168],
    ])
      if (!Number.isSafeInteger(value) || value < min || value > max)
        fail("Revisá los límites de reserva.");
    const licenseId = args.licenseId ?? undefined,
      timbreQrId = args.timbreQrId ?? undefined;
    if (timbreQrId) {
      const { site } = await ownedQr(ctx, space.ownerId, timbreQrId);
      if (licenseId !== site.licenseId)
        fail("El QR digital y el espacio deben usar la misma licencia.");
    }
    if (licenseId) await fitLicense(ctx, space, licenseId, timbreQrId);
    const next = { ...space, licenseId };
    if (args.bookingsEnabled) await licensedSpace(ctx, next, "bookings");
    if (args.portalEnabled) await licensedSpace(ctx, next, "templates");
    if (
      args.templates.length > 12 ||
      new Set(args.templates.map((t) => t.id)).size !== args.templates.length
    )
      fail("Usá hasta 12 opciones diferentes.");
    const templates = [];
    for (const t of args.templates) {
      if (!/^[a-z0-9-]{1,50}$/.test(t.id))
        fail("Identificador de opción no válido.");
      if (t.imageId) {
        const image = await ctx.db.get("teavisoImages", t.imageId);
        if (!image || image.ownerId !== space.ownerId)
          fail("No tenés acceso a esta imagen.");
      }
      templates.push({
        ...t,
        label: teavisoText(t.label, 50),
        message: teavisoText(t.message, 500),
      });
    }
    let whatsappQrId = space.whatsappQrId;
    if (whatsappQrId) {
      const qr = await ctx.db.get("teavisoWhatsappQrs", whatsappQrId);
      if (!qr || qr.ownerId !== space.ownerId || qr.archived)
        fail("La entrada fue eliminada. Creá otra para continuar.");
      if (!phone) fail("La entrada de WhatsApp necesita un número.");
      await ctx.db.patch("teavisoWhatsappQrs", whatsappQrId, {
        label: name,
        phone,
        message,
        enabled: args.enabled,
        updatedAt: Date.now(),
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
        consentAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    const { spaceId, revision, consent, ...fields } = args;
    void revision;
    void consent;
    await ctx.db.patch("teavisoSpaces", spaceId, {
      ...fields,
      name,
      phone,
      message,
      timezone,
      schedule,
      templates,
      licenseId,
      timbreQrId,
      timbreSiteId: timbreQrId
        ? (await ctx.db.get("timbreQrs", timbreQrId))?.siteId
        : space.timbreQrId
          ? undefined
          : space.timbreSiteId,
      whatsappQrId,
      revision: space.revision + 1,
      updatedAt: Date.now(),
    });
  },
});
export const saveService = mutation({
  args: {
    spaceId: v.id("teavisoSpaces"),
    id: v.optional(v.id("teavisoServices")),
    name: v.string(),
    duration: v.number(),
    enabled: v.boolean(),
  },
  handler: async (ctx, a) => {
    await ownerSpace(ctx, a.spaceId);
    if (!Number.isInteger(a.duration) || a.duration < 5 || a.duration > 480)
      fail("La duración debe ser entre 5 y 480 minutos.");
    const old = a.id ? await ctx.db.get("teavisoServices", a.id) : null;
    if (a.id && old?.spaceId !== a.spaceId) fail("Servicio no disponible.");
    const rows = await ctx.db
      .query("teavisoServices")
      .withIndex("by_space", (q) => q.eq("spaceId", a.spaceId))
      .take(32);
    if (!old && rows.length >= 32) fail("Usá hasta 32 servicios.");
    const values = {
      spaceId: a.spaceId,
      name: teavisoText(a.name, 80),
      duration: a.duration,
      enabled: a.enabled,
    };
    if (old) {
      await ctx.db.patch("teavisoServices", old._id, values);
      return old._id;
    }
    return ctx.db.insert("teavisoServices", {
      ...values,
      createdAt: Date.now(),
    });
  },
});
export const saveProfessional = mutation({
  args: {
    spaceId: v.id("teavisoSpaces"),
    id: v.optional(v.id("teavisoProfessionals")),
    name: v.string(),
    enabled: v.boolean(),
    serviceIds: v.array(v.id("teavisoServices")),
  },
  handler: async (ctx, a) => {
    await ownerSpace(ctx, a.spaceId);
    const old = a.id ? await ctx.db.get("teavisoProfessionals", a.id) : null;
    if (a.id && old?.spaceId !== a.spaceId) fail("Profesional no disponible.");
    const rows = await ctx.db
      .query("teavisoProfessionals")
      .withIndex("by_space", (q) => q.eq("spaceId", a.spaceId))
      .take(16);
    if (!old && rows.length >= 16) fail("Usá hasta 16 profesionales.");
    if (a.serviceIds.length > 32) fail("Revisá los servicios.");
    for (const id of a.serviceIds) {
      if ((await ctx.db.get("teavisoServices", id))?.spaceId !== a.spaceId)
        fail("El servicio no pertenece a este espacio.");
    }
    const values = {
      spaceId: a.spaceId,
      name: teavisoText(a.name, 80),
      enabled: a.enabled,
      serviceIds: [...new Set(a.serviceIds)],
    };
    if (old) {
      await ctx.db.patch("teavisoProfessionals", old._id, values);
      return old._id;
    }
    return ctx.db.insert("teavisoProfessionals", values);
  },
});
export const registerImage = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const user = await requireCurrentUser(ctx),
      existing = await ctx.db
        .query("teavisoImages")
        .withIndex("by_storage", (q) => q.eq("storageId", storageId))
        .unique();
    if (existing) {
      if (existing.ownerId !== user._id) fail("No tenés acceso a esta imagen.");
      return existing._id;
    }
    const upload = await ctx.db
      .query("marketplaceUploads")
      .withIndex("by_storage", (q) => q.eq("storageId", storageId))
      .unique();
    if (!upload || upload.userId !== user._id || upload.mediaType !== "image")
      fail("La imagen no pertenece a tu cuenta.");
    const metadata = await ctx.db.system.get("_storage", storageId);
    if (
      !metadata ||
      metadata.size > 2_000_000 ||
      !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
        metadata.contentType ?? upload.contentType,
      )
    )
      fail("Usá PNG, JPG, WebP o GIF de hasta 2 MB.");
    // The existing authenticated HTTP upload records the owner server-side.
    return ctx.db.insert("teavisoImages", {
      ownerId: user._id,
      storageId,
      createdAt: Date.now(),
    });
  },
});
export const publicEntry = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const space = await entry(ctx, token);
    if (!space) return null;
    const caps = await capabilities(ctx, space);
    let callToken: string | undefined;
    if (space.timbreQrId) {
      const qr = await ctx.db.get("timbreQrs", space.timbreQrId),
        site = qr ? await ctx.db.get("timbreSites", qr.siteId) : null;
      if (
        qr?.enabled &&
        !qr.revokedAt &&
        site?.ownerId === space.ownerId &&
        site.enabled &&
        (await getValidTimbreLicense(ctx, site.licenseId, space.ownerId))
      )
        callToken = qr.token;
    }
    const enabled = space.bookingsEnabled && caps.bookings;
    return {
      name: space.name,
      kind: space.kind,
      timezone: space.timezone,
      schedule: space.schedule,
      phone: space.phone,
      message: space.message,
      whatsappUrl: space.phone ? whatsappUrl(space.phone, space.message) : null,
      callToken,
      bookings: enabled,
      portal: space.portalEnabled && caps.templates,
      cancelHours: space.cancelHours,
      autoConfirm: space.autoConfirm,
      horizonDays: space.horizonDays,
      templates:
        space.portalEnabled && caps.templates
          ? await Promise.all(
              space.templates.map(async (t) => {
                const image = t.imageId
                  ? await ctx.db.get("teavisoImages", t.imageId)
                  : null;
                return {
                  id: t.id,
                  label: t.label,
                  message: t.message,
                  imageUrl:
                    image?.ownerId === space.ownerId
                      ? await ctx.storage.getUrl(image.storageId)
                      : null,
                };
              }),
            )
          : [],
      services: enabled
        ? (
            await ctx.db
              .query("teavisoServices")
              .withIndex("by_space", (q) => q.eq("spaceId", space._id))
              .collect()
          )
            .filter((s) => s.enabled)
            .map((s) => ({ id: s._id, name: s.name, duration: s.duration }))
        : [],
      professionals: enabled
        ? (
            await ctx.db
              .query("teavisoProfessionals")
              .withIndex("by_space", (q) => q.eq("spaceId", space._id))
              .collect()
          )
            .filter((p) => p.enabled)
            .map((p) => ({ id: p._id, name: p.name, serviceIds: p.serviceIds }))
        : [],
    };
  },
});
async function catalogItem(
  ctx: Read,
  space: Space,
  serviceId: Id<"teavisoServices">,
  professionalId?: Id<"teavisoProfessionals">,
) {
  await licensedSpace(ctx, space, "bookings");
  if (!space.bookingsEnabled) fail("Las reservas no están disponibles.");
  const service = await ctx.db.get("teavisoServices", serviceId);
  if (!service?.enabled || service.spaceId !== space._id)
    fail("El servicio no está disponible.");
  const professionals = (
    await ctx.db
      .query("teavisoProfessionals")
      .withIndex("by_space", (q) => q.eq("spaceId", space._id))
      .collect()
  ).filter(
    (p) =>
      p.enabled &&
      p.serviceIds.includes(serviceId) &&
      (!professionalId || p._id === professionalId),
  );
  return { service, professionals };
}
async function conflicts(
  ctx: Read,
  spaceId: Id<"teavisoSpaces">,
  professionalId: Id<"teavisoProfessionals">,
  start: number,
  end: number,
  exclude?: Id<"teavisoBookings">,
) {
  const appointments = await ctx.db
    .query("teavisoBookings")
    .withIndex("by_professional_start", (q) =>
      q
        .eq("professionalId", professionalId)
        .gte("startsAt", start - 480 * 60_000)
        .lt("startsAt", end),
    )
    .collect();
  const blocks = await ctx.db
    .query("teavisoBlocks")
    .withIndex("by_space_start", (q) =>
      q.eq("spaceId", spaceId).lt("startsAt", end),
    )
    .collect();
  return (
    appointments.some(
      (b) =>
        b._id !== exclude &&
        occupies(b, Date.now()) &&
        intersects(start, end, b),
    ) ||
    blocks.some(
      (b) =>
        (!b.professionalId || b.professionalId === professionalId) &&
        intersects(start, end, b),
    )
  );
}
export const slots = query({
  args: {
    token: v.string(),
    date: v.string(),
    serviceId: v.id("teavisoServices"),
    professionalId: v.optional(v.id("teavisoProfessionals")),
  },
  handler: async (ctx, a) => {
    const space = await entry(ctx, a.token);
    if (!space) return [];
    const { service, professionals } = await catalogItem(
        ctx,
        space,
        a.serviceId,
        a.professionalId,
      ),
      bounds = dayBounds(a.date),
      now = Date.now(),
      clock = localClock(space.timezone);
    if (bounds.end < now || bounds.start > now + 91 * 86_400_000) return [];
    const booked = await ctx.db
      .query("teavisoBookings")
      .withIndex("by_space_start", (q) =>
        q
          .eq("spaceId", space._id)
          .gte("startsAt", bounds.start - 480 * 60_000)
          .lt("startsAt", bounds.end),
      )
      .collect();
    const blocks = await ctx.db
      .query("teavisoBlocks")
      .withIndex("by_space_start", (q) =>
        q.eq("spaceId", space._id).lt("startsAt", bounds.end),
      )
      .collect();
    const result = [];
    for (let start = bounds.start; start < bounds.end; start += 60_000) {
      if (
        clock(start).date !== a.date ||
        !permitsSlot(space, start, service.duration, now)
      )
        continue;
      const end = start + service.duration * 60_000;
      const available = professionals.find(
        (p) =>
          !booked.some(
            (b) =>
              b.professionalId === p._id &&
              occupies(b, now) &&
              intersects(start, end, b),
          ) &&
          !blocks.some(
            (b) =>
              (!b.professionalId || b.professionalId === p._id) &&
              intersects(start, end, b),
          ),
      );
      if (available)
        result.push({
          startsAt: start,
          professionalId: available._id,
          professionalName: available.name,
        });
      if (result.length >= 160) break;
    }
    return result;
  },
});
export const book = mutation({
  args: {
    token: v.string(),
    serviceId: v.id("teavisoServices"),
    professionalId: v.id("teavisoProfessionals"),
    startsAt: v.number(),
    name: v.string(),
    contact: v.string(),
    manageToken: v.string(),
    requestKey: v.string(),
    nonce: v.string(),
    consent: v.boolean(),
  },
  handler: async (ctx, a) => {
    tokenCheck(a.manageToken);
    tokenCheck(a.requestKey);
    const space = await entry(ctx, a.token);
    if (!space) fail("La entrada no está disponible.");
    const requestKey = await hashCapability(`${space._id}:${a.requestKey}`),
      manageHash = await hashCapability(a.manageToken),
      name = teavisoText(a.name, 100),
      contact = teavisoText(a.contact, 140);
    if (!a.consent)
      fail("Aceptá el uso del contacto para gestionar tu reserva.");
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) &&
      !/^\+?[\d ()-]{8,30}$/.test(contact)
    )
      fail("Ingresá un correo o teléfono de contacto válido.");
    const existing = await ctx.db
      .query("teavisoBookings")
      .withIndex("by_space_request", (q) =>
        q.eq("spaceId", space._id).eq("requestKey", requestKey),
      )
      .unique();
    if (existing) {
      if (
        existing.manageHash !== manageHash ||
        existing.serviceId !== a.serviceId ||
        existing.professionalId !== a.professionalId ||
        existing.startsAt !== a.startsAt ||
        existing.name !== name ||
        existing.contact !== contact
      )
        fail("Esta solicitud ya fue usada. Volvé a elegir el turno.");
      return { id: existing._id, status: existing.status };
    }
    const { service, professionals } = await catalogItem(
      ctx,
      space,
      a.serviceId,
      a.professionalId,
    );
    if (!professionals.length) fail("El profesional no está disponible.");
    const now = Date.now(),
      endsAt = a.startsAt + service.duration * 60_000;
    if (!permitsSlot(space, a.startsAt, service.duration, now))
      fail("El horario ya no está disponible.");
    if (await conflicts(ctx, space._id, a.professionalId, a.startsAt, endsAt))
      fail("Alguien reservó ese horario. Elegí otro turno.");
    await rate(ctx, space._id, a.nonce, "booking");
    const status = space.autoConfirm
        ? ("confirmed" as const)
        : ("pending" as const),
      expiresAt = space.autoConfirm ? undefined : now + 30 * 60_000;
    const id = await ctx.db.insert("teavisoBookings", {
      spaceId: space._id,
      serviceId: service._id,
      professionalId: a.professionalId,
      serviceName: service.name,
      professionalName: professionals[0].name,
      startsAt: a.startsAt,
      endsAt,
      status,
      name,
      contact,
      manageHash,
      requestKey,
      expiresAt,
      timezone: space.timezone,
      cancelHours: space.cancelHours,
      createdAt: now,
      updatedAt: now,
    });
    if (expiresAt) await ctx.scheduler.runAfter(30 * 60_000, expireRef, { id });
    return { id, status };
  },
});
export const expireBooking = internalMutation({
  args: { id: v.id("teavisoBookings") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get("teavisoBookings", id);
    if (row?.status === "pending" && (row.expiresAt ?? 0) <= Date.now())
      await ctx.db.patch("teavisoBookings", id, {
        status: "expired",
        updatedAt: Date.now(),
      });
  },
});
async function privateBooking(
  ctx: Read,
  id: Id<"teavisoBookings">,
  token: string,
) {
  tokenCheck(token);
  const b = await ctx.db.get("teavisoBookings", id);
  if (!b || b.manageHash !== (await hashCapability(token)))
    fail("La reserva no está disponible.");
  return b;
}
export const booking = query({
  args: { id: v.id("teavisoBookings"), manageToken: v.string() },
  handler: async (ctx, a) => {
    const b = await privateBooking(ctx, a.id, a.manageToken),
      space = await ctx.db.get("teavisoSpaces", b.spaceId);
    return {
      id: b._id,
      spaceName: space?.name ?? "Tu reserva",
      serviceName: b.serviceName,
      professionalName: b.professionalName,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      timezone: b.timezone,
      cancelHours: b.cancelHours,
      status:
        b.status === "pending" && (b.expiresAt ?? 0) <= Date.now()
          ? "expired"
          : b.status,
      name: b.name,
    };
  },
});
export const cancelBooking = mutation({
  args: { id: v.id("teavisoBookings"), manageToken: v.string() },
  handler: async (ctx, a) => {
    const b = await privateBooking(ctx, a.id, a.manageToken);
    if (b.status === "cancelled") return;
    if (
      !["pending", "confirmed"].includes(b.status) ||
      Date.now() > b.startsAt - b.cancelHours * HOUR
    )
      fail("El plazo para cancelar desde la web terminó. Contactá al negocio.");
    await ctx.db.patch("teavisoBookings", b._id, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
  },
});
export const agenda = query({
  args: { spaceId: v.id("teavisoSpaces"), from: v.number(), to: v.number() },
  handler: async (ctx, a) => {
    await ownerSpace(ctx, a.spaceId);
    if (
      !Number.isFinite(a.from) ||
      !Number.isFinite(a.to) ||
      a.to <= a.from ||
      a.to - a.from > 93 * 86_400_000
    )
      fail("Elegí un período de hasta 93 días.");
    const rows = await ctx.db
      .query("teavisoBookings")
      .withIndex("by_space_start", (q) =>
        q.eq("spaceId", a.spaceId).gte("startsAt", a.from).lt("startsAt", a.to),
      )
      .take(1500);
    return rows.map(({ manageHash, requestKey, ...b }) => {
      void manageHash;
      void requestKey;
      return {
        ...b,
        status:
          b.status === "pending" && (b.expiresAt ?? 0) <= Date.now()
            ? ("expired" as const)
            : b.status,
      };
    });
  },
});
export const updateBooking = mutation({
  args: { id: v.id("teavisoBookings"), status: bookingStatus },
  handler: async (ctx, a) => {
    const b = await ctx.db.get("teavisoBookings", a.id);
    if (!b) fail("La reserva no existe.");
    const space = await ownerSpace(ctx, b.spaceId);
    if (!["confirmed", "cancelled", "completed", "no_show"].includes(a.status))
      fail("Elegí un estado válido.");
    if (a.status === b.status) return;
    if (
      b.status === "cancelled" ||
      b.status === "expired" ||
      (b.status === "pending" && (b.expiresAt ?? 0) <= Date.now())
    )
      fail("La reserva ya no se puede confirmar.");
    if (a.status === "confirmed") {
      await licensedSpace(ctx, space, "bookings");
      if (b.status !== "pending" || b.startsAt <= Date.now())
        fail("El turno no puede confirmarse.");
    }
    if (["completed", "no_show"].includes(a.status) && b.startsAt > Date.now())
      fail("El turno todavía no comenzó.");
    await ctx.db.patch("teavisoBookings", b._id, {
      status: a.status,
      updatedAt: Date.now(),
    });
  },
});
export const blocks = query({
  args: { spaceId: v.id("teavisoSpaces") },
  handler: async (ctx, { spaceId }) => {
    await ownerSpace(ctx, spaceId);
    return ctx.db
      .query("teavisoBlocks")
      .withIndex("by_space_start", (q) => q.eq("spaceId", spaceId))
      .take(300);
  },
});
export const blockTime = mutation({
  args: {
    spaceId: v.id("teavisoSpaces"),
    professionalId: v.optional(v.id("teavisoProfessionals")),
    startsAt: v.number(),
    endsAt: v.number(),
    note: v.string(),
  },
  handler: async (ctx, a) => {
    await ownerSpace(ctx, a.spaceId);
    if (
      !Number.isSafeInteger(a.startsAt) ||
      !Number.isSafeInteger(a.endsAt) ||
      a.endsAt <= a.startsAt ||
      a.endsAt - a.startsAt > 31 * 86_400_000
    )
      fail("Revisá las fechas del bloqueo.");
    if (
      a.professionalId &&
      (await ctx.db.get("teavisoProfessionals", a.professionalId))?.spaceId !==
        a.spaceId
    )
      fail("El profesional no pertenece a este espacio.");
    const rows = await ctx.db
      .query("teavisoBlocks")
      .withIndex("by_space_start", (q) => q.eq("spaceId", a.spaceId))
      .take(300);
    if (rows.length >= 300)
      fail("Eliminá bloqueos anteriores antes de agregar otro.");
    return ctx.db.insert("teavisoBlocks", {
      ...a,
      note: teavisoText(a.note, 150, false),
    });
  },
});
export const removeBlock = mutation({
  args: { id: v.id("teavisoBlocks") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get("teavisoBlocks", id);
    if (!row) fail("El bloqueo no existe.");
    await ownerSpace(ctx, row.spaceId);
    await ctx.db.delete("teavisoBlocks", id);
  },
});
export const recordVisit = mutation({
  args: { token: v.string(), templateId: v.string(), nonce: v.string() },
  handler: async (ctx, a) => {
    const space = await entry(ctx, a.token);
    if (!space) fail("Esta entrada no está disponible.");
    await licensedSpace(ctx, space, "templates");
    if (!space.portalEnabled) fail("El portal está desactivado.");
    const template = space.templates.find((t) => t.id === a.templateId);
    if (!template) fail("Elegí una opción del portal.");
    if (space.kind === "building")
      fail("Para avisar a una unidad, usá el timbre digital del edificio.");
    const nonceHash = await hashCapability(`${space._id}:${a.nonce}`),
      recent = await ctx.db
        .query("teavisoVisits")
        .withIndex("by_space_created", (q) =>
          q.eq("spaceId", space._id).gte("createdAt", Date.now() - 60_000),
        )
        .collect();
    if (
      recent.some(
        (r) => r.nonceHash === nonceHash && r.templateId === template.id,
      )
    )
      return;
    await rate(ctx, space._id, a.nonce, "visit");
    await ctx.db.insert("teavisoVisits", {
      spaceId: space._id,
      templateId: template.id,
      label: template.label,
      message: template.message,
      nonceHash,
      seen: false,
      createdAt: Date.now(),
    });
  },
});
export const visits = query({
  args: { spaceId: v.id("teavisoSpaces") },
  handler: async (ctx, { spaceId }) => {
    await ownerSpace(ctx, spaceId);
    return (
      await ctx.db
        .query("teavisoVisits")
        .withIndex("by_space_created", (q) => q.eq("spaceId", spaceId))
        .order("desc")
        .take(100)
    ).map(({ nonceHash, ...v }) => {
      void nonceHash;
      return v;
    });
  },
});
export const readVisit = mutation({
  args: { id: v.id("teavisoVisits") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get("teavisoVisits", id);
    if (!row) fail("El aviso no existe.");
    await ownerSpace(ctx, row.spaceId);
    await ctx.db.patch("teavisoVisits", id, { seen: true });
  },
});

export const connections = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const licenses = (
      await ctx.db
        .query("timbreLicenses")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .collect()
    ).filter(
      (l) =>
        l.status === "active" &&
        l.startsAt <= Date.now() &&
        (l.expiresAt === undefined || l.expiresAt > Date.now()),
    );
    const sites = await ctx.db
      .query("timbreSites")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    const qrs = (
      await Promise.all(
        sites.map(async (site) =>
          (
            await ctx.db
              .query("timbreQrs")
              .withIndex("by_site", (q) => q.eq("siteId", site._id))
              .collect()
          )
            .filter((q) => !q.revokedAt)
            .map((q) => ({
              id: q._id,
              label: `${site.name} · ${q.label}`,
              licenseId: site.licenseId,
            })),
        ),
      )
    ).flat();
    return {
      licenses: licenses.map((l) => ({
        id: l._id,
        name: l.planName,
        bookings: l.features.bookings === true,
        templates: l.features.templates === true,
      })),
      qrs,
    };
  },
});

export const imageAccess = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const rows = await ctx.db
      .query("teavisoImages")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .take(50);
    return { userId: user._id, allowed: rows.length < 50 };
  },
});
export const recordUploadedImage = internalMutation({
  args: { storageId: v.id("_storage"), contentType:v.string() },
  handler: async (ctx, { storageId, contentType }) => {
    const user = await requireCurrentUser(ctx),
      rows = await ctx.db
        .query("teavisoImages")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .take(50);
    if (rows.length >= 50)
      fail("Alcanzaste el límite de 50 imágenes de tu cuenta.");
    const metadata = await ctx.db.system.get("_storage", storageId);
    if (
      !metadata ||
      metadata.size > 2_000_000 ||
      (metadata.contentType !== undefined && metadata.contentType !== contentType) ||
      !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
        contentType,
      )
    )
      fail("Archivo no válido.");
    return ctx.db.insert("teavisoImages", {
      ownerId: user._id,
      storageId,
      createdAt: Date.now(),
    });
  },
});
export const reschedule = mutation({
  args: {
    id: v.id("teavisoBookings"),
    startsAt: v.number(),
    professionalId: v.id("teavisoProfessionals"),
  },
  handler: async (ctx, a) => {
    const b = await ctx.db.get("teavisoBookings", a.id);
    if (!b) fail("La reserva no existe.");
    const space = await ownerSpace(ctx, b.spaceId);
    if (
      !["confirmed", "pending"].includes(b.status) ||
      (b.status === "pending" && (b.expiresAt ?? 0) <= Date.now())
    )
      fail("La reserva ya no se puede reprogramar.");
    const { service, professionals } = await catalogItem(
      ctx,
      space,
      b.serviceId,
      a.professionalId,
    );
    if (!professionals.length) fail("El profesional no está disponible.");
    const endsAt = a.startsAt + service.duration * 60_000;
    if (
      !permitsSlot(space, a.startsAt, service.duration, Date.now()) ||
      (await conflicts(
        ctx,
        space._id,
        a.professionalId,
        a.startsAt,
        endsAt,
        b._id,
      ))
    )
      fail("El nuevo horario no está disponible.");
    await ctx.db.patch("teavisoBookings", b._id, {
      startsAt: a.startsAt,
      endsAt,
      professionalId: a.professionalId,
      professionalName: professionals[0].name,
      timezone: space.timezone,
      status: "confirmed",
      updatedAt: Date.now(),
    });
  },
});

// Called by the actual digital doorbell, never by a public client with recipient IDs.
export async function teavisoPortalReason(
  ctx: Read,
  token: string,
  templateId: string,
  qrId: Id<"timbreQrs">,
) {
  const space = await entry(ctx, token);
  if (!space || !space.portalEnabled || space.timbreQrId !== qrId)
    fail("El motivo no corresponde a este timbre.");
  await licensedSpace(ctx, space, "templates");
  const template = space.templates.find((t) => t.id === templateId);
  if (!template) fail("El motivo de visita no está disponible.");
  return { visitorLabel: template.label, visitorMessage: template.message };
}
