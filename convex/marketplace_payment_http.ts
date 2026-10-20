import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { verifyPaymentSignature } from "./lib/marketplace_payment_provider";

const headers = { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" };

export const oauthCallback = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || url.searchParams.has("error")) {
    return new Response("No se completó la vinculación. Volvé a VISO para intentarlo nuevamente.", { status: 400, headers });
  }
  try {
    const result = await ctx.runAction(internal.marketplace_payments.completeConnection, { code, state });
    return new Response(null, { status: 303, headers: { Location: result.returnUrl, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch {
    return new Response("No pudimos comprobar la vinculación. Volvé a VISO e iniciá otra autorización.", { status: 400, headers });
  }
});

export const paymentWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return new Response("Cobros no configurados", { status: 503, headers });
  const url = new URL(request.url);
  const orderId = url.searchParams.get("order_id");
  if (!orderId || orderId.length > 100) return new Response("Solicitud inválida", { status: 400, headers });
  const reader = request.body?.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  if (reader) {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        return new Response("Solicitud demasiado grande", { status: 413, headers });
      }
      chunks.push(next.value);
    }
  }
  let body: { type?: unknown; data?: { id?: unknown } };
  try {
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== "object") throw new Error();
  } catch { return new Response("Solicitud inválida", { status: 400, headers }); }
  if (body.type !== "payment") return new Response("Evento no aplicable", { status: 200, headers });
  const paymentId = url.searchParams.get("data.id") ?? String(body.data?.id ?? "");
  if (body.data?.id !== undefined && String(body.data.id) !== paymentId) {
    return new Response("Solicitud inválida", { status: 400, headers });
  }
  const valid = await verifyPaymentSignature({
    signature: request.headers.get("x-signature"), requestId: request.headers.get("x-request-id"),
    paymentId, secret,
  });
  if (!valid) return new Response("Firma inválida", { status: 401, headers });
  try {
    await ctx.runAction(internal.marketplace_payments.processNotification, { orderId: orderId as Id<"marketplaceOrders">, paymentId });
    return new Response("OK", { status: 200, headers });
  } catch {
    // Let the provider retry transient errors. No token, code or financial
    // payload is written to logs or returned to the caller.
    return new Response("No se pudo comprobar el pago", { status: 503, headers });
  }
});
