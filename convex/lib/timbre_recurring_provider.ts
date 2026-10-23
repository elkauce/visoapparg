import { providerAmountToMinor } from "./marketplace_payment_provider";

// Contract sources: official mercadopago/sdk-nodejs preApproval and invoice
// clients (see docs/timbre-recurring.md). No provider traffic is made here.
export const recurringTopics = ["subscription_preapproval", "subscription_authorized_payment", "payment"] as const;
export type RecurringTopic = typeof recurringTopics[number];
export function recurringResourceId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value);
}
export function recurringRedirect(value: unknown, providerId: string) {
  if (typeof value !== "string") throw new Error("Mercado Pago no devolvió un enlace de suscripción.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hostname !== "www.mercadopago.com.ar" ||
    url.searchParams.get("preapproval_id") !== providerId) throw new Error("El enlace de suscripción no coincide.");
  return url.href;
}
export function recurringFrequency(period: "monthly" | "yearly" | "one_time") {
  if (period === "one_time") throw new Error("Elegí un plan mensual o anual.");
  return period === "monthly" ? 1 : 12;
}
export function parseProviderDate(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT/.test(value)) throw new Error("Falta la fecha de facturación del proveedor.");
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error("La fecha del proveedor no es válida.");
  return timestamp;
}
// Calendar months, preserving UTC time and clamping the day to the last day of
// the destination month. Never use a made-up fixed 30/365-day billing period.
export function addBillingMonths(startsAt: number, months: number, anchorDay?: number) {
  if (!Number.isFinite(startsAt) || ![1, 12].includes(months)) throw new Error("Período de facturación inválido.");
  const start = new Date(startsAt), result = new Date(startsAt);
  const day = anchorDay ?? start.getUTCDate();
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error("El día de facturación no es válido.");
  result.setUTCDate(1); result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay)); return result.getTime();
}
export function billingPeriodBounds(startsAt: number, frequency: number, anchorDay?: number, nextBillingAt?: number) {
  const start = new Date(startsAt), calendarEnd = addBillingMonths(startsAt, frequency, anchorDay);
  const next = nextBillingAt === undefined ? null : new Date(nextBillingAt), calculated = new Date(calendarEnd);
  const nextBelongsToPeriod = !!next && next.getUTCFullYear() === calculated.getUTCFullYear() && next.getUTCMonth() === calculated.getUTCMonth();
  if (anchorDay === undefined && !nextBelongsToPeriod) throw new Error("Falta la próxima fecha de cobro para confirmar el primer período y su día de facturación.");
  // A provider date from a later cycle must never extend an old invoice across
  // unpaid months. Within this cycle, use the provider's actual next debit;
  // allow month-end clamping/DST differences, not an extra billing period.
  if (nextBelongsToPeriod && Math.abs(nextBillingAt! - calendarEnd) > 4 * 86_400_000) throw new Error("La próxima fecha de cobro no coincide con el ciclo contratado.");
  return { endsAt: nextBelongsToPeriod ? nextBillingAt! : calendarEnd,
    anchorDay: Math.max(anchorDay ?? start.getUTCDate(), start.getUTCDate(), nextBelongsToPeriod ? next!.getUTCDate() : 1) };
}
export function objectField(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("La respuesta de facturación está incompleta.");
  return value as Record<string, unknown>;
}
export type RecurringIdentity = { providerId: string; externalReference: string; collectorId: string; applicationId: string;
  payerEmail: string; payerId?: string; amount: number; currency: string; frequency: number; billingAnchorDay?: number; nextBillingAt?: number };
export function verifiedPreapproval(data: Record<string, unknown>, expected: RecurringIdentity) {
  const recurring = objectField(data.auto_recurring);
  const payerId = data.payer_id === undefined || data.payer_id === null ? undefined : String(data.payer_id);
  if (String(data.id) !== expected.providerId || data.external_reference !== expected.externalReference ||
    String(data.collector_id) !== expected.collectorId || String(data.application_id) !== expected.applicationId ||
    typeof data.payer_email !== "string" || data.payer_email.toLowerCase() !== expected.payerEmail.toLowerCase() ||
    (expected.payerId && payerId !== expected.payerId) || recurring.frequency !== expected.frequency || recurring.frequency_type !== "months" ||
    providerAmountToMinor(recurring.transaction_amount) !== expected.amount || recurring.currency_id !== expected.currency ||
    recurring.free_trial) throw new Error("La suscripción de Mercado Pago no coincide con la contratación.");
  if (!["pending", "authorized", "paused", "cancelled"].includes(String(data.status))) throw new Error("El estado de la suscripción no es válido.");
  if (data.status === "authorized" && !payerId) throw new Error("Falta identificar al titular de la suscripción.");
  return { status: data.status as "pending" | "authorized" | "paused" | "cancelled", payerId };
}
export function verifiedInvoicePayment(invoice: Record<string, unknown>, payment: Record<string, unknown>, expected: RecurringIdentity,
  invoiceId: string, now = Date.now()) {
  const embedded = objectField(invoice.payment), payer = objectField(payment.payer);
  const paymentId = String(embedded.id);
  if (!/^\d{1,30}$/.test(paymentId) || String(payment.id) !== paymentId || String(invoice.id) !== invoiceId ||
    invoice.preapproval_id !== expected.providerId || invoice.external_reference !== expected.externalReference ||
    payment.external_reference !== expected.externalReference || String(payment.collector_id) !== expected.collectorId ||
    !expected.payerId || String(invoice.payer_id) !== expected.payerId || String(payer.id) !== expected.payerId ||
    providerAmountToMinor(invoice.transaction_amount) !== expected.amount || providerAmountToMinor(payment.transaction_amount) !== expected.amount ||
    invoice.currency_id !== expected.currency || payment.currency_id !== expected.currency || payment.live_mode !== true) {
    throw new Error("El pago recurrente no coincide con la factura, el titular o la contratación.");
  }
  const startsAt = parseProviderDate(invoice.debit_date);
  const { endsAt } = billingPeriodBounds(startsAt, expected.frequency, expected.billingAnchorDay, expected.nextBillingAt);
  const paidAt = payment.status === "approved" ? parseProviderDate(payment.date_approved) : undefined;
  if (paidAt !== undefined && paidAt > now + 60_000) throw new Error("La fecha del pago todavía no es válida.");
  if (!["approved", "pending", "in_process", "authorized", "rejected", "cancelled", "refunded", "charged_back"].includes(String(payment.status))) throw new Error("El estado del pago recurrente no es válido.");
  const refunded = confirmedRefundedAmount(payment);
  const status = refunded > 0 ? "refunded" as const : ["in_process", "authorized"].includes(String(payment.status)) ? "pending" as const : payment.status as "approved" | "pending" | "rejected" | "cancelled" | "refunded" | "charged_back";
  return { invoiceId, paymentId, startsAt, endsAt, amount: expected.amount, currency: expected.currency, status, paidAt, nextBillingAt: expected.nextBillingAt };
}

// Policy: any confirmed refund (including a partial refund whose payment still
// says approved) suspends the service benefit for that invoice until reviewed.
// Fees/net_received_amount are never treated as refunds.
export function confirmedRefundedAmount(payment: Record<string, unknown>) {
  let amount = 0;
  if (payment.transaction_amount_refunded !== undefined && payment.transaction_amount_refunded !== null) {
    const value = providerAmountToMinor(payment.transaction_amount_refunded);
    if (value === null) throw new Error("El importe reintegrado no es válido."); amount = value;
  }
  if (Array.isArray(payment.refunds)) for (const refund of payment.refunds) {
    if (!refund || typeof refund !== "object" || refund.status !== "approved") continue;
    const value = providerAmountToMinor(refund.amount);
    if (value === null) throw new Error("El reintegro confirmado no es válido."); amount = Math.max(amount, value);
  }
  return amount;
}

export function paidCoverage(periods: Array<{ startsAt: number; endsAt: number; status: string }>, now = Date.now()) {
  const ranges = periods.filter((x) => x.status === "approved").sort((a, b) => a.startsAt - b.startsAt);
  const merged: Array<{ startsAt: number; endsAt: number }> = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (previous && range.startsAt <= previous.endsAt) previous.endsAt = Math.max(previous.endsAt, range.endsAt);
    else merged.push({ startsAt: range.startsAt, endsAt: range.endsAt });
  }
  return merged.find((x) => x.startsAt <= now && x.endsAt > now) ?? merged.find((x) => x.startsAt > now) ?? merged[merged.length - 1] ?? null;
}

export async function verifyRecurringSignature(input: { signature: string | null; requestId: string | null;
  resourceId: string; secret: string; now?: number }) {
  if (!recurringResourceId(input.resourceId) || !input.signature || !input.requestId || !/^[A-Za-z0-9-]{1,150}$/.test(input.requestId) || !input.secret) return false;
  const parts = new Map(input.signature.split(",").map((part) => { const [key, value] = part.trim().split("="); return [key, value]; }));
  const ts = parts.get("ts"), supplied = parts.get("v1");
  if (!ts || !/^\d{10,13}$/.test(ts) || !supplied || !/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const time = Number(ts) * (ts.length === 10 ? 1000 : 1), age = (input.now ?? Date.now()) - time;
  if (age > 5 * 60_000 || age < -60_000) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(input.secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  // Mercado Pago's signature manifest normalizes alphanumeric data.id to lowercase.
  const manifest = `id:${input.resourceId.toLowerCase()};request-id:${input.requestId};ts:${ts};`;
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const expected = Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, "0")).join("");
  let difference = 0; for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ supplied.toLowerCase().charCodeAt(i);
  return difference === 0;
}
