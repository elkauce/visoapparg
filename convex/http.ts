import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { auth } from "./auth.ts";
import { MAX_DECK_MEDIA_BYTES, deckMediaType } from "./deck_media.ts";
import { oauthCallback, paymentWebhook } from "./marketplace_payment_http";
import { timbreRecurringWebhook } from "./timbre_recurring_http";
import {
  MAX_MARKETPLACE_BYTES,
  marketplaceType,
  matchesMarketplaceBytes,
} from "./lib/marketplace_validation";

const http = httpRouter();
auth.addHttpRoutes(http);

http.route({
  path: "/marketplace/payments/oauth/callback",
  method: "GET",
  handler: oauthCallback,
});
http.route({
  path: "/marketplace/payments/webhook",
  method: "POST",
  handler: paymentWebhook,
});
http.route({
  path: "/timbre/payments/webhook",
  method: "POST",
  handler: timbreRecurringWebhook,
});

// Texto plano mínimo, fácil de leer desde un microcontrolador
function text(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
};

http.route({
  path: "/marketplace/media",
  method: "OPTIONS",
  handler: httpAction(
    async () =>
      new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Max-Age": "600",
          "Cache-Control": "no-store",
        },
      }),
  ),
});

http.route({
  path: "/marketplace/media",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const access = await ctx.runQuery(
      internal.marketplace_files.uploadAccess,
      {},
    );
    if (!access) return json({ ok: false, error: "Debes iniciar sesión" }, 401);
    if (!access.allowed)
      return json(
        { ok: false, error: "Completá tu perfil de creador primero" },
        403,
      );
    const contentType =
      request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() ??
      "";
    const mediaType = marketplaceType(contentType);
    if (!mediaType)
      return json(
        { ok: false, error: "Formato de archivo no compatible" },
        400,
      );
    const maxBytes = Math.min(
      access.remainingBytes,
      mediaType === "profile" ? 512 * 1024 : MAX_MARKETPLACE_BYTES,
    );
    if (maxBytes === 0)
      return json(
        {
          ok: false,
          error: "Tu espacio de archivos del marketplace está completo",
        },
        413,
      );
    const length = Number(request.headers.get("Content-Length"));
    if (Number.isFinite(length) && length > maxBytes)
      return json(
        { ok: false, error: "El archivo supera el tamaño permitido" },
        413,
      );
    const reader = request.body?.getReader();
    if (!reader) return json({ ok: false, error: "Falta el archivo" }, 400);
    const chunks: ArrayBuffer[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return json(
          { ok: false, error: "El archivo supera el tamaño permitido" },
          413,
        );
      }
      chunks.push(new Uint8Array(chunk.value).buffer);
    }
    if (size === 0)
      return json({ ok: false, error: "El archivo está vacío" }, 400);
    const blob = new Blob(chunks, { type: contentType });
    // JSON profiles are bounded above; other formats need only their header.
    const probe = await (
      mediaType === "profile" ? blob : blob.slice(0, 64)
    ).arrayBuffer();
    if (!matchesMarketplaceBytes(new Uint8Array(probe), contentType))
      return json(
        {
          ok: false,
          error: "El contenido no corresponde al formato del archivo",
        },
        400,
      );
    const storageId = await ctx.storage.store(blob);
    try {
      await ctx.runMutation(internal.marketplace_files.recordUpload, {
        userId: access.userId,
        storageId,
        mediaType,
        contentType,
      });
    } catch (error) {
      await ctx.storage.delete(storageId);
      throw error;
    }
    return json({ ok: true, storageId, mediaType }, 200);
  }),
});

// Subida autenticada: la propiedad deriva de la sesión, nunca de un id de cliente.
http.route({
  path: "/deck/media",
  method: "OPTIONS",
  handler: httpAction(
    async () =>
      new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Max-Age": "600",
          "Cache-Control": "no-store",
        },
      }),
  ),
});

http.route({
  path: "/deck/media",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const user = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!user) return json({ ok: false, error: "Debes iniciar sesión" }, 401);
    const mediaType = deckMediaType(request.headers.get("Content-Type"));
    if (!mediaType)
      return json(
        { ok: false, error: "Formato multimedia no compatible" },
        400,
      );
    const length = Number(request.headers.get("Content-Length"));
    if (Number.isFinite(length) && length > MAX_DECK_MEDIA_BYTES) {
      return json({ ok: false, error: "El archivo supera los 60 MB" }, 413);
    }
    // El límite se aplica también a cuerpos sin Content-Length.
    const chunks: ArrayBuffer[] = [];
    const reader = request.body?.getReader();
    if (!reader) return json({ ok: false, error: "Falta el archivo" }, 400);
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_DECK_MEDIA_BYTES) {
        await reader.cancel();
        return json({ ok: false, error: "El archivo supera los 60 MB" }, 413);
      }
      chunks.push(new Uint8Array(chunk.value).buffer);
    }
    if (size === 0)
      return json({ ok: false, error: "El archivo está vacío" }, 400);
    const blob = new Blob(chunks, {
      type: request.headers.get("Content-Type")!,
    });
    const storageId = await ctx.storage.store(blob);
    try {
      await ctx.runMutation(internal.deck_media.recordUpload, {
        userId: user._id,
        storageId,
        mediaType,
      });
    } catch (error) {
      await ctx.storage.delete(storageId);
      throw error;
    }
    return json({ ok: true, storageId, mediaType }, 200);
  }),
});

function json(
  body: Record<string, string | number | boolean | null>,
  status: number,
) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// GET /deck/set?token=...&status=<id|nombre|off>
// Pensado para la acción "Sitio web" del software de Elgato Stream Deck (solo permite GET)
http.route({
  path: "/deck/set",
  method: "GET",
  handler: httpAction(async (ctx, request): Promise<Response> => {
    const params = new URL(request.url).searchParams;
    const token = params.get("token");
    const status = params.get("status");
    if (!token || !status) {
      return json(
        { ok: false, error: "Faltan los parámetros token y status" },
        400,
      );
    }

    const result = await ctx.runMutation(internal.deck_api.activateByToken, {
      token,
      status,
    });
    if (result.ok) {
      return json({ ok: true, status: result.statusName }, 200);
    }
    if (result.code === "UNAUTHORIZED") {
      return json({ ok: false, error: "Token inválido" }, 401);
    }
    return json({ ok: false, error: "Estado no encontrado" }, 404);
  }),
});

// GET /public/status?slug=...&format=json|rgb|hex|name
// Libre y sin contraseña: pensado para ESP32, Arduino, Home Assistant o cualquier luz RGB que consulte el estado
http.route({
  path: "/public/status",
  method: "GET",
  handler: httpAction(async (ctx, request): Promise<Response> => {
    const params = new URL(request.url).searchParams;
    const slug = params.get("slug");
    const format = params.get("format") ?? "json";
    if (!slug) {
      return json({ ok: false, error: "Falta el parámetro slug" }, 400);
    }

    const data = await ctx.runQuery(api.public_status.getPublicStatus, {
      slug,
    });
    if (!data.found) {
      return json({ ok: false, error: "Link no encontrado" }, 404);
    }

    // Sin estado activo = luz apagada (negro)
    const hex = data.status?.color ?? "#000000";
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    if (format === "rgb") {
      return text(`${r},${g},${b}`);
    }
    if (format === "hex") {
      return text(hex);
    }
    if (format === "name") {
      return text(data.status?.name ?? "");
    }
    return json(
      {
        ok: true,
        active: data.status !== null,
        status: data.status?.name ?? null,
        hex,
        r,
        g,
        b,
        owner: data.ownerName,
      },
      200,
    );
  }),
});

export default http;
