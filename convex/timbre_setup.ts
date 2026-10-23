import { query } from "./_generated/server";
import { requireCurrentUser } from "./lib/current_user";
import { marketplaceError } from "./lib/marketplace_validation";
import { timbreFcmConfiguration } from "./lib/timbre_push";
import {
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
