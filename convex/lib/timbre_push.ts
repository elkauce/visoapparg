export type TimbreFcmCredentials = { projectId: string; clientEmail: string; privateKey: string };
export type TimbrePushPayload = { type: "timbre_call"; kind: "incoming" | "cancel"; callId: string; ownerId: string; expiresAt: string };
const OAUTH_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
let cached: { identity: string; token: string; expiresAt: number } | undefined;

export function timbreFcmConfiguration(env: Record<string, string | undefined>): TimbreFcmCredentials | null {
  const source = env.TIMBRE_FCM_SERVICE_ACCOUNT;
  if (!source || source.length > 20_000) return null;
  try {
    const parsed = JSON.parse(source);
    if (parsed.type !== "service_account" || typeof parsed.project_id !== "string" || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(parsed.project_id) ||
      typeof parsed.client_email !== "string" || !/^[a-zA-Z0-9._-]+@[a-z0-9.-]+\.iam\.gserviceaccount\.com$/.test(parsed.client_email) ||
      typeof parsed.private_key !== "string" || !/^-----BEGIN PRIVATE KEY-----\n[\s\S]+\n-----END PRIVATE KEY-----\n?$/.test(parsed.private_key) ||
      parsed.private_key.length > 8000) return null;
    return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: parsed.private_key };
  } catch { return null; }
}
function base64url(bytes: Uint8Array) {
  let result = ""; for (const byte of bytes) result += String.fromCharCode(byte);
  return btoa(result).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function jsonBase64(value: unknown) { return base64url(new TextEncoder().encode(JSON.stringify(value))); }
export async function timbreFcmAssertion(credentials: TimbreFcmCredentials, now = Date.now()) {
  const seconds = Math.floor(now / 1000);
  const assertion = `${jsonBase64({ alg: "RS256", typ: "JWT" })}.${jsonBase64({ iss: credentials.clientEmail, scope: SCOPE, aud: OAUTH_URL, iat: seconds, exp: seconds + 300 })}`;
  const pem = credentials.privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const bytes = Uint8Array.from(atob(pem), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", bytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(assertion));
  return `${assertion}.${base64url(new Uint8Array(signature))}`;
}
async function timedFetch(url: string, init: RequestInit) {
  return fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(5000) });
}
export async function timbreFcmAccessToken(credentials: TimbreFcmCredentials, now = Date.now()) {
  const identity = `${credentials.projectId}:${credentials.clientEmail}`;
  if (cached?.identity === identity && cached.expiresAt > now + 60_000) return cached.token;
  const assertion = await timbreFcmAssertion(credentials, now);
  const response = await timedFetch(OAUTH_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString() });
  if (!response.ok) throw new Error("TIMBRE_PUSH_AUTH_UNAVAILABLE");
  const data = await response.json();
  if (typeof data.access_token !== "string" || data.access_token.length > 8192 || data.token_type !== "Bearer" || !Number.isFinite(data.expires_in) || data.expires_in < 60)
    throw new Error("TIMBRE_PUSH_AUTH_UNAVAILABLE");
  cached = { identity, token: data.access_token, expiresAt: now + Math.min(3600, data.expires_in) * 1000 };
  return cached.token;
}
export function timbreFcmMessage(token: string, data: TimbrePushPayload, now = Date.now()) {
  const remaining = Math.min(90, Math.max(1, Math.ceil((Number(data.expiresAt) - now) / 1000)));
  // A cancel replaces a still-pending incoming message for this call.
  return { message: { token, data, android: { priority: "HIGH", ttl: `${remaining}s`, collapse_key: data.callId } } };
}
export async function sendTimbreFcm(credentials: TimbreFcmCredentials, accessToken: string, token: string, data: TimbrePushPayload) {
  try {
    const response = await timedFetch(`https://fcm.googleapis.com/v1/projects/${credentials.projectId}/messages:send`, {
      method: "POST", headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(timbreFcmMessage(token, data)),
    });
    if (response.ok) return "sent" as const;
    // Only the explicit FCM token status revokes a device. Generic 400s may
    // concern the payload and must never delete an otherwise valid token.
    const body = await response.json().catch(() => null);
    if (body?.error?.details?.some((detail: { errorCode?: string }) => detail.errorCode === "UNREGISTERED")) return "invalid" as const;
    if (response.status === 401) cached = undefined;
    return response.status === 429 || response.status >= 500 || response.status === 401 ? "retry" as const : "failed" as const;
  } catch { return "retry" as const; }
}
