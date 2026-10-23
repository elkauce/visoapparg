import { v } from "convex/values";
import { internalAction, query } from "./_generated/server";
import { requireCurrentUser } from "./lib/current_user";
import { marketplaceError } from "./lib/marketplace_validation";
import {
  timbreFcmAccessToken,
  timbreFcmConfiguration,
} from "./lib/timbre_push";
import {
  createCloudflareTurnCredentials,
  timbreTurnProviderConfiguration,
  turnConfiguration,
} from "./lib/timbre_rtc";
import { isMarketplaceAdmin } from "./marketplace";

/** Installation status is private to VISO administrators. Configuration values,
 * even masked credentials or provider errors, never leave the server. */
export const configuration = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    if (!isMarketplaceAdmin(user._id))
      marketplaceError("No tenés permiso para configurar Timbre.");

    const env = process.env;
    const config = timbreTurnProviderConfiguration(env);
    const selected = env.TIMBRE_TURN_PROVIDER?.trim();
    const provider =
      selected === "cloudflare" || selected === "coturn"
        ? selected
        : selected
          ? "unsupported"
          : (config?.provider ?? "unconfigured");
    const checks =
      provider === "coturn"
        ? [
            {
              name: "TIMBRE_TURN_URLS",
              configured:
                turnConfiguration({
                  TIMBRE_TURN_URLS: env.TIMBRE_TURN_URLS,
                  TIMBRE_TURN_SECRET: "x".repeat(32),
                }) !== null,
            },
            {
              name: "TIMBRE_TURN_SECRET",
              configured: (env.TIMBRE_TURN_SECRET?.trim().length ?? 0) >= 32,
            },
          ]
        : [
            {
              name: "TIMBRE_TURN_PROVIDER",
              configured: selected === "cloudflare",
            },
            {
              name: "TIMBRE_CLOUDFLARE_TURN_KEY_ID",
              configured:
                timbreTurnProviderConfiguration({
                  TIMBRE_TURN_PROVIDER: "cloudflare",
                  TIMBRE_CLOUDFLARE_TURN_KEY_ID:
                    env.TIMBRE_CLOUDFLARE_TURN_KEY_ID,
                  // A local shape check only; never used to issue credentials.
                  TIMBRE_CLOUDFLARE_TURN_API_TOKEN: "x".repeat(32),
                }) !== null,
            },
            {
              name: "TIMBRE_CLOUDFLARE_TURN_API_TOKEN",
              configured:
                timbreTurnProviderConfiguration({
                  TIMBRE_TURN_PROVIDER: "cloudflare",
                  TIMBRE_CLOUDFLARE_TURN_KEY_ID: "shape-check",
                  TIMBRE_CLOUDFLARE_TURN_API_TOKEN:
                    env.TIMBRE_CLOUDFLARE_TURN_API_TOKEN,
                }) !== null,
            },
          ];

    return {
      turn: { provider, configured: config !== null, checks },
      push: { configured: timbreFcmConfiguration(env) !== null },
      // Readiness cannot attest a real call or a physical Android notification.
      callTested: false as const,
    };
  },
});

/** Deployment-operator diagnostic, never a public credential endpoint. It
 * validates the provider API without creating a call, license or media relay. */
export const verifyCloudflare = internalAction({
  args: {},
  handler: async () => {
    const config = timbreTurnProviderConfiguration(process.env);
    const result = {
      configured: config?.provider === "cloudflare",
      credentialsAccepted: false,
      relayUrlCount: 0,
      revokeConfirmed: false,
      connectivityTested: false as const,
    };
    if (config?.provider !== "cloudflare") return result;

    let issued;
    try {
      const now = Date.now();
      // Diagnostic authorization: 30s plus the helper's bounded grace. Any
      // credential orphaned by a network error expires in less than 90 seconds.
      issued = await createCloudflareTurnCredentials(config, now, now + 30_000);
    } catch {
      return result;
    }

    result.credentialsAccepted = true;
    result.relayUrlCount = issued.iceServers.reduce(
      (count, server) => count + server.urls.length,
      0,
    );
    result.revokeConfirmed = true;
    const usernames = new Set(
      issued.iceServers.map((server) => server.username),
    );
    // No credential leaves this action. Attempt cleanup for every distinct
    // credential even if an earlier revocation failed.
    for (const username of usernames) {
      try {
        const response = await fetch(
          `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(config.keyId)}/credentials/${encodeURIComponent(username)}/revoke`,
          {
            method: "POST",
            headers: { authorization: `Bearer ${config.apiToken}` },
            redirect: "error",
            signal: AbortSignal.timeout(5_000),
          },
        );
        if (response.status !== 204) result.revokeConfirmed = false;
        await response.body?.cancel();
      } catch {
        result.revokeConfirmed = false;
      }
    }
    return result;
  },
});

/** Operator-only verification of the server credentials against the Android
 * project's identity. FCM dry-run validation never delivers a notification. */
export const verifyFirebase = internalAction({
  args: { expectedProjectId: v.string() },
  handler: async (_ctx, { expectedProjectId }) => {
    const credentials = timbreFcmConfiguration(process.env);
    const sameProject =
      expectedProjectId.trim() === expectedProjectId &&
      /^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(expectedProjectId) &&
      credentials?.projectId === expectedProjectId;
    const result = {
      configured: credentials !== null,
      sameProject,
      credentialsAccepted: false,
      validationAccepted: false,
      notificationSent: false as const,
    };
    // Never contact a project that differs from the supplied Android config.
    if (!credentials || !sameProject) return result;

    let accessToken: string;
    try {
      accessToken = await timbreFcmAccessToken(credentials);
      result.credentialsAccepted = true;
    } catch {
      return result;
    }

    try {
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${credentials.projectId}/messages:send`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            validate_only: true,
            message: {
              topic: "viso-setup-validation",
              data: { type: "viso_setup_validation" },
            },
          }),
          redirect: "error",
          signal: AbortSignal.timeout(5_000),
        },
      );
      result.validationAccepted = response.status === 200;
      // Do not read or reflect Google's response, including its error details.
      await response.body?.cancel();
    } catch {
      // The result intentionally contains no provider body, exception or token.
    }
    return result;
  },
});
