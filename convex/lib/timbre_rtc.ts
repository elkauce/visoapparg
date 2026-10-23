/** Server-only RTC helpers. No TURN shared secret is ever sent to a browser. */
export const TIMBRE_RING_MS = 90_000;
export const TIMBRE_CALL_MS = 20 * 60_000;
export const TIMBRE_LEASE_MS = 90_000;
export const TIMBRE_TURN_TTL_SECONDS = 300;
export const TIMBRE_TURN_GRACE_MS = 60_000;
export const TIMBRE_CLOUDFLARE_TIMEOUT_MS = 5_000;

type CoturnConfiguration = {
  provider: "coturn";
  urls: string[];
  secret: string;
};
export type CloudflareTurnConfiguration = {
  provider: "cloudflare";
  keyId: string;
  apiToken: string;
};
type TurnEnvironment = {
  TIMBRE_TURN_PROVIDER?: string;
  TIMBRE_TURN_URLS?: string;
  TIMBRE_TURN_SECRET?: string;
  TIMBRE_CLOUDFLARE_TURN_KEY_ID?: string;
  TIMBRE_CLOUDFLARE_TURN_API_TOKEN?: string;
};

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

/** Explicit provider selection never falls back to a differently configured
 * service. Existing installations without the selector continue using coturn. */
export function timbreTurnProviderConfiguration(
  env: TurnEnvironment,
): CoturnConfiguration | CloudflareTurnConfiguration | null {
  const provider = env.TIMBRE_TURN_PROVIDER?.trim() ?? "coturn";
  if (provider === "coturn") {
    const config = turnConfiguration(env);
    return config ? { provider, ...config } : null;
  }
  if (provider !== "cloudflare") return null;
  const keyId = env.TIMBRE_CLOUDFLARE_TURN_KEY_ID?.trim();
  const apiToken = env.TIMBRE_CLOUDFLARE_TURN_API_TOKEN?.trim();
  if (
    !keyId ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(keyId) ||
    !apiToken ||
    apiToken.length < 16 ||
    apiToken.length > 4_096 ||
    !/^[a-zA-Z0-9._~+/-]+=*$/.test(apiToken)
  )
    return null;
  return { provider, keyId, apiToken };
}

function authorizedTurnExpiry(now: number, authorizedCallExpiresAt?: number) {
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
  return expiresAt;
}

export async function createTurnCredentials(
  config: { urls: string[]; secret: string },
  participant: string,
  now: number,
  authorizedCallExpiresAt?: number,
) {
  const expiresAt = authorizedTurnExpiry(now, authorizedCallExpiresAt);
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

function cloudflareRelayUrl(value: string) {
  if (/^stuns?:/i.test(value)) return null;
  const match =
    /^(turns?):turn\.cloudflare\.com:(\d+)(?:\?transport=(udp|tcp))?$/.exec(
      value.toLowerCase(),
    );
  if (!match) throw new Error("Invalid relay");
  const [, scheme, port] = match;
  // Cloudflare documents port 53 as unsuitable for browsers. Do not forward it.
  if (port === "53") return null;
  const transport = match[3] ?? (scheme === "turns" ? "tcp" : "udp");
  const normalized = `${scheme}:turn.cloudflare.com:${port}?transport=${transport}`;
  if (
    ![
      "turn:turn.cloudflare.com:3478?transport=udp",
      "turn:turn.cloudflare.com:443?transport=udp",
      "turn:turn.cloudflare.com:3478?transport=tcp",
      "turn:turn.cloudflare.com:80?transport=tcp",
      "turns:turn.cloudflare.com:5349?transport=tcp",
      "turns:turn.cloudflare.com:443?transport=tcp",
    ].includes(normalized)
  )
    throw new Error("Invalid relay");
  return normalized;
}

async function boundedCloudflareResponse(response: Response): Promise<unknown> {
  if (Number(response.headers.get("content-length")) > 65_536 || !response.body)
    throw new Error("Invalid provider response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > 65_536) {
        await reader.cancel();
        throw new Error("Invalid provider response");
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Cloudflare issues opaque, expiring relay credentials. Its API token is not a
 * coturn shared secret and must only be sent to this fixed server-side URL. */
export async function createCloudflareTurnCredentials(
  config: CloudflareTurnConfiguration,
  now: number,
  authorizedCallExpiresAt: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TIMBRE_CLOUDFLARE_TIMEOUT_MS,
  );
  try {
    // Reserving the bounded network timeout keeps the requested lifetime inside
    // the authorized call deadline plus grace, including request latency.
    const ttl = Math.floor(
      (authorizedTurnExpiry(now, authorizedCallExpiresAt) -
        now -
        TIMBRE_CLOUDFLARE_TIMEOUT_MS) /
        1000,
    );
    if (ttl < 1) throw new Error("Expired provider authorization");
    const response = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(config.keyId)}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ ttl }),
        redirect: "error",
        signal: controller.signal,
      },
    );
    if (response.status !== 201) throw new Error("Provider unavailable");
    const value = await boundedCloudflareResponse(response);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Invalid provider response");
    const servers = (value as Record<string, unknown>).iceServers;
    if (!Array.isArray(servers) || !servers.length || servers.length > 8)
      throw new Error("Invalid provider response");
    const iceServers: {
      urls: string[];
      username: string;
      credential: string;
    }[] = [];
    for (const item of servers) {
      if (!item || typeof item !== "object" || Array.isArray(item))
        throw new Error("Invalid provider response");
      const server = item as Record<string, unknown>;
      const sources =
        typeof server.urls === "string" ? [server.urls] : server.urls;
      if (!Array.isArray(sources) || !sources.length || sources.length > 8)
        throw new Error("Invalid provider response");
      const urls = sources.flatMap((url) => {
        if (typeof url !== "string" || url.length > 300)
          throw new Error("Invalid provider response");
        const relay = cloudflareRelayUrl(url);
        return relay ? [relay] : [];
      });
      if (!urls.length) continue;
      const { username, credential } = server;
      if (
        typeof username !== "string" ||
        !username ||
        username.length > 4_096 ||
        typeof credential !== "string" ||
        !credential ||
        credential.length > 4_096 ||
        !/^[!-~]+$/.test(username) ||
        !/^[!-~]+$/.test(credential) ||
        username.includes(config.apiToken) ||
        credential.includes(config.apiToken)
      )
        throw new Error("Invalid provider response");
      iceServers.push({ urls: [...new Set(urls)], username, credential });
    }
    if (!iceServers.length) throw new Error("Missing provider relays");
    return {
      iceServers,
      iceTransportPolicy: "relay" as const,
      expiresAt: Math.floor(now / 1000) * 1000 + ttl * 1000,
    };
  } catch {
    // Neither provider response bodies nor network errors can expose tokens,
    // account identifiers or credentials to visitors or application logs.
    throw new Error("TIMBRE_TURN_UNAVAILABLE");
  } finally {
    clearTimeout(timeout);
  }
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
