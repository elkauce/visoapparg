import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireCurrentUser } from "./current_user";
import { requireValidTimbreLicense } from "./timbre_commerce";
import { withinTimbreSchedule } from "./timbre_rtc";

type ReadCtx = QueryCtx | MutationCtx;
export type TimbreRole = "owner" | "manager" | "resident";

export function timbreError(message: string): never {
  throw new ConvexError({ code: "TIMBRE_UNAVAILABLE", message });
}

export async function requireSiteMember(ctx: ReadCtx, siteId: Id<"timbreSites">, roles?: readonly TimbreRole[]) {
  const user = await requireCurrentUser(ctx);
  const site = await ctx.db.get("timbreSites", siteId);
  if (!site) timbreError("No se encontró este Timbre.");
  const membership = await ctx.db.query("timbreMembers")
    .withIndex("by_site_user", (q) => q.eq("siteId", siteId).eq("userId", user._id)).unique();
  if (!membership || (site.ownerId !== user._id && membership.role === "owner") ||
      (roles && !roles.includes(membership.role))) {
    timbreError("No tenés permiso para administrar este Timbre.");
  }
  return { user, site, membership };
}

// Entitlements are explicit purchased snapshots; an account, a downloaded
// marketplace resource or provider failure never substitutes for a license.
export async function requireActiveTimbreLicense(ctx: ReadCtx, site: Doc<"timbreSites">) {
  const license = await requireValidTimbreLicense(ctx, site.licenseId, site.ownerId);
  if (site.kind === "building" && !license.features.buildings) timbreError("Tu licencia no incluye edificios.");
  if (site.kind === "office" && !license.features.offices) timbreError("Tu licencia no incluye oficinas.");
  return { license, features: license.features, limits: license.limits };
}

export function effectiveTimbreFeatures(site: Doc<"timbreSites">, features: Doc<"timbreLicenses">["features"]) {
  return {
    audio: site.allowedAudio && features.audio, video: site.allowedVideo && features.video,
    chat: site.chatEnabled && features.chat, messages: site.messagesEnabled && features.messages,
  };
}

export function validateTimbreTimezone(value: string): string {
  const timezone = value.trim();
  if (!timezone || timezone.length > 80) timbreError("Elegí una zona horaria válida.");
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(0); }
  catch { timbreError("Elegí una zona horaria válida."); }
  return timezone;
}

export function validateTimbreSchedule(schedule: Doc<"timbreSites">["schedule"]) {
  if (schedule.length > 28) timbreError("Usá hasta 28 franjas de atención.");
  const clean = schedule.map(({ day, start, end }) => {
    if (!Number.isInteger(day) || day < 0 || day > 6 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || start === end) {
      timbreError("Revisá los horarios y usá horas de inicio y fin diferentes.");
    }
    return { day, start, end };
  }).sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
  const minute = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const intervals = clean.flatMap(({ day, start, end }) => start < end ? [{ day, start: minute(start), end: minute(end) }] :
    [{ day, start: minute(start), end: 1440 }, { day: (day + 1) % 7, start: 0, end: minute(end) }])
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.day - b.day || a.start - b.start);
  for (let i = 1; i < intervals.length; i++) {
    if (intervals[i].day === intervals[i - 1].day && intervals[i].start < intervals[i - 1].end) {
      timbreError("Las franjas de atención no pueden superponerse.");
    }
  }
  return clean;
}

export function getTimbreAvailability(site: Pick<Doc<"timbreSites">, "enabled" | "mutedUntil" | "schedule" | "timezone">, now = Date.now()) {
  if (!site.enabled) return { available: false, reason: "disabled" as const };
  if (site.mutedUntil && site.mutedUntil > now) return { available: false, reason: "muted" as const };
  if (!withinTimbreSchedule(site.schedule, site.timezone, now)) return { available: false, reason: "outside_schedule" as const };
  return { available: true, reason: "available" as const };
}

export function newTimbreToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashTimbreToken(token: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))),
    (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function resolvePublicQr(ctx: ReadCtx, qrToken: string, unitId?: Id<"timbreUnits">) {
  if (!/^[a-f0-9]{64}$/.test(qrToken)) timbreError("Este QR no está disponible.");
  const qr = await ctx.db.query("timbreQrs").withIndex("by_token", (q) => q.eq("token", qrToken)).unique();
  if (!qr || !qr.enabled || qr.revokedAt) timbreError("Este QR no está disponible.");
  const site = await ctx.db.get("timbreSites", qr.siteId);
  if (!site || !site.enabled) timbreError("Este Timbre no está disponible.");
  const entitlement = await requireActiveTimbreLicense(ctx, site);
  if (qr.unitId && unitId && qr.unitId !== unitId) timbreError("La unidad no corresponde a este QR.");
  const selectedUnitId = qr.unitId ?? unitId;
  const unit = selectedUnitId ? await ctx.db.get("timbreUnits", selectedUnitId) : null;
  if (selectedUnitId && (!unit || unit.siteId !== site._id || !unit.enabled)) {
    timbreError("Esta unidad no está disponible.");
  }
  return { qr, site, unit, ...entitlement,
    effectiveFeatures: effectiveTimbreFeatures(site, entitlement.features), availability: getTimbreAvailability(site) };
}

export async function recordTimbreAudit(ctx: MutationCtx, siteId: Id<"timbreSites">,
  actorUserId: Id<"users">, action: string, targetId?: string) {
  await ctx.db.insert("timbreAuditEvents", { siteId, actorUserId, action, ...(targetId ? { targetId } : {}), createdAt: Date.now() });
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
export function validateStoredTimbreDesign(design: NonNullable<Doc<"timbreQrs">["design"]>) {
  for (const color of [design.backgroundColor, design.textColor, design.qrColor, design.qrBackground]) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) timbreError("Elegí colores HEX válidos.");
  }
  if (luminance(design.qrColor) >= luminance(design.qrBackground) ||
      (luminance(design.qrBackground) + 0.05) / (luminance(design.qrColor) + 0.05) < 7) {
    timbreError("El QR necesita módulos oscuros sobre fondo claro con contraste mínimo 7:1.");
  }
  const textContrast = (Math.max(luminance(design.textColor), luminance(design.backgroundColor)) + 0.05) /
    (Math.min(luminance(design.textColor), luminance(design.backgroundColor)) + 0.05);
  if (textContrast < 4.5) timbreError("El texto necesita contraste mínimo 4,5:1.");
  if ([design.widthMm, design.heightMm].some((n) => !Number.isFinite(n) || n < 50 || n > 300) ||
      Math.max(design.widthMm, design.heightMm) / Math.min(design.widthMm, design.heightMm) > 2.8 ||
      !Number.isFinite(design.bleedMm) || design.bleedMm < 0 || design.bleedMm > 5) {
    timbreError("Revisá las dimensiones de impresión (50 a 300 mm) y la sangre (0 a 5 mm).");
  }
  for (const [value, max] of [[design.title, 80], [design.streetNumber, 16], [design.familyName, 80],
    [design.businessName, 80], [design.unit, 40], [design.legend, 140]] as const) {
    if (value.length > max || [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) timbreError("Revisá los textos del diseño.");
  }
  if (design.imageDataUrl) {
    if (design.imageDataUrl.length > 956_000 || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(design.imageDataUrl)) {
      timbreError("La imagen debe ser un PNG o JPEG de hasta 700 KB.");
    }
    let bytes: string;
    try { bytes = atob(design.imageDataUrl.slice(design.imageDataUrl.indexOf(",") + 1)); }
    catch { timbreError("La imagen no es válida."); }
    const png = design.imageDataUrl.startsWith("data:image/png;") && bytes.slice(0, 8) === "\x89PNG\r\n\x1a\n";
    const jpeg = design.imageDataUrl.startsWith("data:image/jpeg;") && bytes.charCodeAt(0) === 255 && bytes.charCodeAt(1) === 216 && bytes.charCodeAt(2) === 255;
    if (bytes.length > 700 * 1024 || (!png && !jpeg)) timbreError("La imagen no coincide con su formato o supera 700 KB.");
    const u16 = (at: number) => bytes.charCodeAt(at) * 256 + bytes.charCodeAt(at + 1);
    const u32 = (at: number) => u16(at) * 65536 + u16(at + 2);
    let width = 0, height = 0;
    if (png && bytes.length >= 24 && bytes.slice(12, 16) === "IHDR") { width = u32(16); height = u32(20); }
    if (jpeg) {
      // Inspect JPEG frame dimensions without decoding untrusted pixel data.
      for (let at = 2; at + 9 < bytes.length;) {
        if (bytes.charCodeAt(at) !== 255) break;
        let marker = bytes.charCodeAt(at + 1); at += 2;
        while (marker === 255 && at < bytes.length) marker = bytes.charCodeAt(at++);
        if (marker === 0xd9 || marker === 0xda) break;
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
        const length = u16(at); if (length < 2 || at + length > bytes.length) break;
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
          height = u16(at + 3); width = u16(at + 5); break;
        }
        at += length;
      }
    }
    if (!width || !height || width > 4096 || height > 4096) timbreError("La imagen debe ser válida y medir hasta 4096 × 4096 píxeles.");
  }
  return design;
}
