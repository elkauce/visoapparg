import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  recordTimbreAudit,
  requireActiveTimbreLicense,
  requireSiteMember,
  resolvePublicQr,
  timbreError,
} from "./lib/timbre_access";
import {
  normalizeTimbreTelegramUsername,
  timbreTelegramUrl,
} from "./lib/timbre_telegram";

/** Explicit manager-controlled public contact. Saving an alias does not create
 * a call, grant service, verify a Telegram identity or enable Telegram privacy. */
export const saveContact = mutation({
  args: {
    siteId: v.id("timbreSites"),
    unitId: v.optional(v.id("timbreUnits")),
    username: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const { site, user } = await requireSiteMember(ctx, args.siteId, [
      "owner",
      "manager",
    ]);
    const unit = args.unitId
      ? await ctx.db.get("timbreUnits", args.unitId)
      : null;
    if (args.unitId && (!unit || unit.siteId !== site._id))
      timbreError("La unidad no pertenece a este Timbre.");

    const username =
      args.username === null
        ? null
        : normalizeTimbreTelegramUsername(args.username);
    if (args.username !== null && !username)
      timbreError(
        "Ingresá un usuario de Telegram válido de 5 a 32 caracteres, sin teléfono ni enlaces especiales.",
      );
    if (username) {
      const { features } = await requireActiveTimbreLicense(ctx, site);
      if (!features.audio && !features.video)
        timbreError(
          "Tu licencia debe incluir llamadas para habilitar Telegram.",
        );
      if (unit && !unit.enabled)
        timbreError("Habilitá la unidad antes de configurar Telegram.");
      if (
        !unit &&
        (site.kind === "building" ||
          (site.kind === "office" &&
            (await ctx.db
              .query("timbreUnits")
              .withIndex("by_site_enabled", (q) =>
                q.eq("siteId", site._id).eq("enabled", true),
              )
              .first())))
      ) {
        timbreError(
          "Configurá Telegram en la unidad correspondiente de este Timbre.",
        );
      }
    }

    const previous = unit ? unit.telegramUsername : site.telegramUsername;
    if ((previous ?? null) !== username) {
      const patch = {
        telegramUsername: username ?? undefined,
        updatedAt: Date.now(),
      };
      if (unit) await ctx.db.patch("timbreUnits", unit._id, patch);
      else await ctx.db.patch("timbreSites", site._id, patch);
      await recordTimbreAudit(
        ctx,
        site._id,
        user._id,
        username ? "telegram.contact_updated" : "telegram.contact_removed",
        unit?._id ?? site._id,
      );
    }
    return { username, url: username ? timbreTelegramUrl(username) : null };
  },
});

/** QR capability, schedule and license boundaries also apply to external
 * contact discovery. Unit contacts never fall back to a different recipient. */
export const publicContact = query({
  args: { qrToken: v.string(), unitId: v.optional(v.id("timbreUnits")) },
  handler: async (ctx, args) => {
    try {
      const { site, unit, features, availability } = await resolvePublicQr(
        ctx,
        args.qrToken,
        args.unitId,
      );
      if (!availability.available || (!features.audio && !features.video))
        return null;
      if (
        !unit &&
        (site.kind === "building" ||
          (site.kind === "office" &&
            (await ctx.db
              .query("timbreUnits")
              .withIndex("by_site_enabled", (q) =>
                q.eq("siteId", site._id).eq("enabled", true),
              )
              .first())))
      )
        return null;

      const stored = unit ? unit.telegramUsername : site.telegramUsername;
      const username = stored ? normalizeTimbreTelegramUsername(stored) : null;
      return username ? { username, url: timbreTelegramUrl(username)! } : null;
    } catch (error) {
      if (error instanceof ConvexError) return null;
      throw error;
    }
  },
});
