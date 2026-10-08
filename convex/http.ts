import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { auth } from "./auth.ts";

const http = httpRouter();
auth.addHttpRoutes(http);

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
