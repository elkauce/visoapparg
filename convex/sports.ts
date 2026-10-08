import { ConvexError, v } from "convex/values";
import { z } from "zod";
import { action } from "./_generated/server";
import { isSportsLeague, SPORTS_LEAGUES } from "./lib/sports_leagues.ts";

const MAX_MATCHES = 12;
const FETCH_TIMEOUT_MS = 8000;

const competitorSchema = z.object({
  homeAway: z.string().optional(),
  score: z.string().optional(),
  team: z.object({
    displayName: z.string(),
    abbreviation: z.string().optional(),
  }),
});

const eventSchema = z.object({
  id: z.string(),
  date: z.string(),
  status: z.object({
    type: z.object({ state: z.string(), shortDetail: z.string().optional() }),
  }),
  competitions: z
    .array(z.object({ competitors: z.array(competitorSchema) }))
    .min(1),
});

const scoreboardSchema = z.object({ events: z.array(eventSchema) });

type Match = {
  id: string;
  date: string;
  state: "pre" | "in" | "post";
  detail: string;
  home: { name: string; short: string; score: string };
  away: { name: string; short: string; score: string };
};

type TeamLine = Match["home"];

function toTeamLine(
  competitor: z.infer<typeof competitorSchema> | undefined,
): TeamLine {
  return {
    name: competitor?.team.displayName ?? "?",
    short: competitor?.team.abbreviation ?? competitor?.team.displayName ?? "?",
    score: competitor?.score ?? "",
  };
}

function toState(raw: string): Match["state"] {
  return raw === "in" || raw === "post" ? raw : "pre";
}

// Marcador de una liga (en vivo, recientes y próximos). Se pide desde el servidor para evitar bloqueos del navegador
export const scoreboard = action({
  args: { league: v.string() },
  handler: async (ctx, args): Promise<Match[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Inicia sesión" });
    }
    if (!isSportsLeague(args.league)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Liga no disponible" });
    }

    const url = `https://site.api.espn.com/apis/site/v2/sports/${SPORTS_LEAGUES[args.league].path}/scoreboard`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Respuesta ${response.status}`);
      }
      const parsed = scoreboardSchema.parse(await response.json());
      return parsed.events.slice(0, MAX_MATCHES).map((event) => {
        const competitors = event.competitions[0]?.competitors ?? [];
        return {
          id: event.id,
          date: event.date,
          state: toState(event.status.type.state),
          detail: event.status.type.shortDetail ?? "",
          home: toTeamLine(competitors.find((c) => c.homeAway === "home") ?? competitors[0]),
          away: toTeamLine(competitors.find((c) => c.homeAway === "away") ?? competitors[1]),
        };
      });
    } catch (error) {
      console.error("Deportes: no se pudo leer el marcador", error);
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: "No se pudo cargar el marcador",
      });
    } finally {
      clearTimeout(timer);
    }
  },
});
