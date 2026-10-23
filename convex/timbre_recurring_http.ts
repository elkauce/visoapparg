import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { hashPaymentState } from "./lib/marketplace_payment_provider";
import { recurringResourceId, recurringTopics, verifyRecurringSignature, type RecurringTopic } from "./lib/timbre_recurring_provider";

export const timbreRecurringWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook no configurado", { status: 503 });
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > 8192) return new Response("Solicitud demasiado grande", { status: 413 });
  let body: Record<string, unknown>;
  try {
    const reader = request.body?.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    if (reader) while (true) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.byteLength;
      if (size > 8192) { await reader.cancel(); return new Response("Solicitud demasiado grande", { status: 413 }); }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed;
  } catch { return new Response("Solicitud inválida", { status: 400 }); }
  if (typeof body.type !== "string" || !recurringTopics.includes(body.type as RecurringTopic)) return new Response("Ignorado", { status: 200 });
  const queryId = new URL(request.url).searchParams.get("data.id");
  const data = body.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data as Record<string, unknown> : null;
  const bodyId = data?.id === undefined ? null : String(data.id);
  if ((queryId && bodyId && queryId !== bodyId) || !recurringResourceId(queryId ?? bodyId)) return new Response("Identificador inválido", { status: 400 });
  const resourceId = (queryId ?? bodyId)!.toLowerCase();
  if (!await verifyRecurringSignature({ signature: request.headers.get("x-signature"), requestId: request.headers.get("x-request-id"), resourceId, secret })) {
    return new Response("Firma inválida", { status: 401 });
  }
  const signatureParts = new Map(request.headers.get("x-signature")!.split(",").map((part) => {
    const [key, value] = part.trim().split("="); return [key, value];
  }));
  const timestamp = signatureParts.get("ts")!;
  const receiptKey = await hashPaymentState(`${body.type}:${resourceId.toLowerCase()}:${request.headers.get("x-request-id")}:${timestamp}`);
  const receipt = await ctx.runMutation(internal.timbre_recurring.claimNotification, { key: receiptKey });
  if (!receipt.process) return new Response(receipt.pending ? "Verificación en curso" : "OK", { status: receipt.pending ? 503 : 200 });
  try {
    await ctx.runAction(internal.timbre_recurring.processNotification, { topic: body.type as RecurringTopic, resourceId });
    await ctx.runMutation(internal.timbre_recurring.finishNotification, { key: receiptKey, success: true });
    return new Response("OK", { status: 200 });
  } catch {
    await ctx.runMutation(internal.timbre_recurring.finishNotification, { key: receiptKey, success: false });
    return new Response("Reintentar verificación", { status: 503 });
  }
});
