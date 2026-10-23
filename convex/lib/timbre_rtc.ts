/** Server-only RTC helpers. No TURN shared secret is ever sent to a browser. */
export const TIMBRE_RING_MS = 90_000;
export const TIMBRE_CALL_MS = 20 * 60_000;
export const TIMBRE_LEASE_MS = 90_000;
export const TIMBRE_TURN_TTL_SECONDS = 300;
export const TIMBRE_TURN_GRACE_MS = 60_000;

export function randomCapability() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}

export async function hashCapability(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}

export function turnConfiguration(env: {
  TIMBRE_TURN_URLS?: string;
  TIMBRE_TURN_SECRET?: string;
}) {
  const raw = env.TIMBRE_TURN_URLS?.trim();
  const secret = env.TIMBRE_TURN_SECRET?.trim();
  if (!raw || !secret || secret.length < 32) return null;
  let urls: unknown;
  try {
    urls = raw.startsWith("[")
      ? JSON.parse(raw)
      : raw.split(",").map((v) => v.trim());
  } catch {
    return null;
  }
  if (
    !Array.isArray(urls) ||
    urls.length === 0 ||
    urls.length > 8 ||
    !urls.every(
      (url) =>
        typeof url === "string" &&
        url.length < 300 &&
        /^turns?:[a-z0-9.[\]:-]+(?:\?transport=(?:udp|tcp))?$/i.test(url),
    )
  )
    return null;
  return { urls: urls as string[], secret };
}

export async function createTurnCredentials(
  config: { urls: string[]; secret: string },
  participant: string,
  now: number,
  authorizedCallExpiresAt?: number,
) {
  if (
    !Number.isFinite(now) ||
    (authorizedCallExpiresAt !== undefined &&
      !Number.isFinite(authorizedCallExpiresAt))
  )
    throw new Error("Vigencia TURN inválida");
  const validUntil =
    authorizedCallExpiresAt === undefined
      ? now + TIMBRE_TURN_TTL_SECONDS * 1000
      : Math.min(
          authorizedCallExpiresAt + TIMBRE_TURN_GRACE_MS,
          now + TIMBRE_CALL_MS + TIMBRE_TURN_GRACE_MS,
        );
  const expiresAt = Math.floor(validUntil / 1000) * 1000;
  if (expiresAt <= now) throw new Error("La autorización TURN venció");
  // TURN REST shared-secret authentication (coturn). Username is scoped to an
  // opaque call ID/role and the authorized call deadline, not a resident identity.
  // A bounded grace allows relay authentication throughout a 20-minute call
  // without introducing unsupported SDP renegotiation/ICE restart flows.
  const username = `${expiresAt / 1000}:${participant}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(config.secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(username)),
  );
  const credential = btoa(String.fromCharCode(...signature));
  return {
    iceServers: [{ urls: config.urls, username, credential }],
    iceTransportPolicy: "relay" as const,
    expiresAt,
  };
}

export function validateSignal(
  kind: "offer" | "answer" | "ice",
  payload: string,
) {
  if (!payload || payload.length > (kind === "ice" ? 4_096 : 65_536))
    throw new Error("Señal RTC inválida");
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    throw new Error("Señal RTC inválida");
  }
  if (kind === "ice") {
    if (value === null) return;
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Candidato ICE inválido");
    const candidate = value as Record<string, unknown>;
    if (
      Object.keys(candidate).some(
        (key) =>
          ![
            "candidate",
            "sdpMid",
            "sdpMLineIndex",
            "usernameFragment",
          ].includes(key),
      ) ||
      typeof candidate.candidate !== "string" ||
      candidate.candidate.length > 3_000 ||
      (candidate.candidate !== "" &&
        !candidate.candidate.startsWith("candidate:")) ||
      (candidate.sdpMid != null &&
        (typeof candidate.sdpMid !== "string" ||
          candidate.sdpMid.length > 256)) ||
      (candidate.sdpMLineIndex != null &&
        (!Number.isInteger(candidate.sdpMLineIndex) ||
          Number(candidate.sdpMLineIndex) < 0 ||
          Number(candidate.sdpMLineIndex) > 64)) ||
      (candidate.usernameFragment != null &&
        (typeof candidate.usernameFragment !== "string" ||
          candidate.usernameFragment.length > 256))
    )
      throw new Error("Candidato ICE inválido");
    return;
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Descripción RTC inválida");
  const description = value as Record<string, unknown>;
  if (
    Object.keys(description).some((key) => !["type", "sdp"].includes(key)) ||
    description.type !== kind ||
    typeof description.sdp !== "string" ||
    !description.sdp.startsWith("v=0") ||
    !/(?:^|\r?\n)m=(?:audio|video) /.test(description.sdp) ||
    /\0/.test(description.sdp)
  )
    throw new Error("Descripción RTC inválida");
}

/** Empty means unrestricted; otherwise local time must belong to a configured
 * interval. Overnight ranges continue into the following calendar day. */
export function withinTimbreSchedule(
  schedule: { day: number; start: string; end: string }[],
  timezone: string,
  now: number,
) {
  if (schedule.length === 0) return true;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    parts.find((v) => v.type === "weekday")!.value,
  );
  const minutes =
    Number(parts.find((v) => v.type === "hour")!.value) * 60 +
    Number(parts.find((v) => v.type === "minute")!.value);
  const parse = (time: string) =>
    Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  return schedule.some((entry) => {
    const start = parse(entry.start),
      end = parse(entry.end);
    return start < end
      ? entry.day === day && minutes >= start && minutes < end
      : (entry.day === day && minutes >= start) ||
          ((entry.day + 1) % 7 === day && minutes < end);
  });
}
