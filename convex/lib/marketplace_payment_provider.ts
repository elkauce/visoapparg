// Provider requests are isolated here so that payment transitions can be tested
// without making a charge. Amounts inside VISO are always integer minor units.
export const MP_API = "https://api.mercadopago.com";

export function commissionFor(amount: number, bps: number): number {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1_000_000_000_000 ||
      !Number.isSafeInteger(bps) || bps < 0 || bps > 10_000) {
    throw new Error("Importe o comisión inválidos.");
  }
  return Number((BigInt(amount) * BigInt(bps) + 5_000n) / 10_000n);
}

export function providerAmountToMinor(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  if (value > 10_000_000_000) return null;
  const fixed = value.toFixed(2);
  if (Number(fixed) !== value) return null;
  const minor = Number(fixed.replace(".", ""));
  return Number.isSafeInteger(minor) ? minor : null;
}

export function providerPaymentStatus(value: unknown) {
  if (value === "approved") return "approved" as const;
  if (value === "refunded") return "refunded" as const;
  if (value === "charged_back") return "charged_back" as const;
  if (value === "rejected") return "rejected" as const;
  if (value === "cancelled") return "cancelled" as const;
  return "pending" as const;
}

export async function providerRequest(path: string, options: RequestInit) {
  const response = await fetch(`${MP_API}${path}`, {
    ...options,
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  if (!response.ok) throw new Error("Mercado Pago no pudo completar la operación.");
  const data = await response.json();
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Respuesta de Mercado Pago inválida.");
  }
  return data as Record<string, unknown>;
}

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}
function base64ToBytes(value: string) {
  try { return Uint8Array.from(atob(value), (value) => value.charCodeAt(0)); }
  catch { throw new Error("Falta configurar el cifrado de las cuentas de cobro."); }
}
function encryptionKey() {
  const value = process.env.MP_TOKEN_ENCRYPTION_KEY;
  if (!value) throw new Error("Falta configurar el cifrado de las cuentas de cobro.");
  const bytes = base64ToBytes(value);
  if (bytes.byteLength !== 32) throw new Error("La clave de cifrado debe tener 32 bytes.");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptPaymentToken(token: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey();
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, new TextEncoder().encode(token),
  );
  return `v1.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(cipher))}`;
}
export async function decryptPaymentToken(value: string): Promise<string> {
  const [version, ivValue, cipherValue, extra] = value.split(".");
  if (version !== "v1" || !ivValue || !cipherValue || extra) {
    throw new Error("Volvé a conectar la cuenta de cobro.");
  }
  const key = await encryptionKey();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivValue) }, key, base64ToBytes(cipherValue),
  );
  return new TextDecoder().decode(plain);
}
export async function hashPaymentState(state: string) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state)))]
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function verifyPaymentSignature(input: {
  signature: string | null; requestId: string | null; paymentId: string;
  secret: string; now?: number;
}): Promise<boolean> {
  const { signature, requestId, paymentId, secret } = input;
  if (!signature || !requestId || !secret || !/^\d{1,30}$/.test(paymentId) ||
      !/^[A-Za-z0-9-]{1,150}$/.test(requestId)) return false;
  const parts = new Map(signature.split(",").map((part) => {
    const [name, value] = part.trim().split("="); return [name, value];
  }));
  const ts = parts.get("ts");
  const v1 = parts.get("v1");
  if (!ts || !/^\d{10,13}$/.test(ts) || !v1 || !/^[a-f0-9]{64}$/i.test(v1)) return false;
  const timestamp = Number(ts) * (ts.length === 10 ? 1000 : 1);
  const age = (input.now ?? Date.now()) - timestamp;
  if (age > 5 * 60_000 || age < -60_000) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key,
    new TextEncoder().encode(manifest)));
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected[i] ^ parseInt(v1.slice(i * 2, i * 2 + 2), 16);
  return mismatch === 0;
}
