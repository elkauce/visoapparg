import { ConvexError, v } from "convex/values";
import { internalAction, mutation, query } from "./_generated/server";
import { OFF_COLOR, OFF_NAME, scheduleWebhook } from "./lib/activate_status.ts";
import { getCurrentUserOrNull, requireCurrentUser } from "./lib/current_user.ts";
import { validateLightHost, validateWebhookUrl } from "./lib/light_validation.ts";
import { buildWebhookPayload, usesGetRequest } from "./lib/webhook_payload.ts";

const WEBHOOK_TIMEOUT_MS = 8000;

// Ajustes de luces del usuario actual
export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrNull(ctx);
    if (!user) {
      return null;
    }
    return {
      keyLightIp: user.keyLightIp ?? null,
      homeWebhookUrl: user.homeWebhookUrl ?? null,
    };
  },
});

export const setKeyLightIp = mutation({
  args: { ip: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    await ctx.db.patch("users", user._id, {
      keyLightIp: validateLightHost(args.ip),
    });
    return null;
  },
});

// URL general que avisa en cada cambio de estado (IFTTT, Home Assistant, Voice Monkey...)
export const setHomeWebhook = mutation({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    await ctx.db.patch("users", user._id, {
      homeWebhookUrl: validateWebhookUrl(args.url),
    });
    return null;
  },
});

// Envía ahora el estado actual a la URL general para comprobar que la luz responde
export const testHomeWebhook = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    if (!user.homeWebhookUrl) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Guarda primero la dirección de tus luces",
      });
    }
    const status = user.activeStatusId
      ? await ctx.db.get("statuses", user.activeStatusId)
      : null;
    await scheduleWebhook(
      ctx,
      user.homeWebhookUrl,
      status?.name ?? OFF_NAME,
      status?.color ?? OFF_COLOR,
      status === null,
    );
    return null;
  },
});

// Avisa al webhook. No sigue redirecciones para no saltar a otras direcciones
export const fireWebhook = internalAction({
  args: {
    url: v.string(),
    statusName: v.string(),
    color: v.string(),
    off: v.optional(v.boolean()),
  },
  handler: async (_ctx, args): Promise<null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      const response = usesGetRequest(args.url)
        ? await fetch(args.url, {
            method: "GET",
            redirect: "manual",
            signal: controller.signal,
          })
        : await fetch(args.url, {
            method: "POST",
            redirect: "manual",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              buildWebhookPayload(args.statusName, args.color, args.off ?? false),
            ),
            signal: controller.signal,
          });
      if (response.status >= 400) {
        console.error(`Webhook respondió ${response.status}`);
      }
    } catch (error) {
      console.error("Webhook falló", error);
    } finally {
      clearTimeout(timer);
    }
    return null;
  },
});
