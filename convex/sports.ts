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
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Inicia sesión",
      });
    }
    if (!isSportsLeague(args.league)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Liga no disponible",
      });
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
          home: toTeamLine(
            competitors.find((c) => c.homeAway === "home") ?? competitors[0],
          ),
          away: toTeamLine(
            competitors.find((c) => c.homeAway === "away") ?? competitors[1],
          ),
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

// Full-page scoreboard keeps all competitors (also useful for race results).
export const screenScoreboard = action({
  args: { league: v.string(), date: v.string() },
  handler: async (ctx, args) => {
    if (!(await ctx.auth.getUserIdentity()))
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Inicia sesión",
      });
    if (
      !isSportsLeague(args.league) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(args.date) ||
      Number.isNaN(Date.parse(args.date)) ||
      new Date(args.date).toISOString().slice(0, 10) !== args.date
    )
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Competición o fecha inválida",
      });
    const response = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${SPORTS_LEAGUES[args.league].path}/scoreboard?dates=${args.date.replaceAll("-", "")}&limit=50`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok)
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: "La fuente deportiva no está disponible",
      });
    const parsed = z
      .object({
        events: z.array(
          z.object({
            id: z.string(),
            name: z.string().optional(),
            date: z.string(),
            status: z.object({
              type: z.object({
                state: z.string(),
                shortDetail: z.string().optional(),
              }),
            }),
            competitions: z.array(
              z.object({
                venue: z.object({ fullName: z.string().optional() }).optional(),
                competitors: z.array(
                  z.object({
                    homeAway: z.string().optional(),
                    score: z.string().optional(),
                    order: z.number().optional(),
                    team: z
                      .object({
                        displayName: z.string(),
                        abbreviation: z.string().optional(),
                        logo: z.string().optional(),
                      })
                      .optional(),
                    athlete: z
                      .object({
                        displayName: z.string(),
                        shortName: z.string().optional(),
                      })
                      .optional(),
                  }),
                ),
              }),
            ),
          }),
        ),
      })
      .parse(await response.json());
    return parsed.events.slice(0, 50).map((e) => ({
      id: e.id,
      name: e.name ?? "",
      date: e.date,
      state: toState(e.status.type.state),
      detail: e.status.type.shortDetail ?? "",
      venue: e.competitions[0]?.venue?.fullName ?? "",
      competitors: (e.competitions[0]?.competitors ?? []).map((c) => ({
        name: c.team?.displayName ?? c.athlete?.displayName ?? "Participante",
        score: c.score ?? "",
        logo: c.team?.logo?.startsWith("https://") ? c.team.logo : null,
        homeAway: c.homeAway ?? "",
        position: c.order ?? null,
      })),
    }));
  },
});

export const formulaOne = action({
  args: {
    view: v.union(
      v.literal("calendar"),
      v.literal("standings"),
      v.literal("results"),
    ),
  },
  handler: async (ctx, args) => {
    if (!(await ctx.auth.getUserIdentity()))
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Inicia sesión",
      });
    const endpoint =
      args.view === "standings"
        ? "current/driverStandings.json"
        : args.view === "results"
          ? "current/last/results.json"
          : "current.json";
    const response = await fetch(
      `https://api.jolpi.ca/ergast/f1/${endpoint}?limit=100`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!response.ok)
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: "La fuente de Fórmula 1 no está disponible",
      });
    const driver = z.object({ givenName: z.string(), familyName: z.string() });
    const row = z.object({
      position: z.string(),
      points: z.string(),
      wins: z.string().optional(),
      Driver: driver,
      Constructors: z.array(z.object({ name: z.string() })).optional(),
      Constructor: z.object({ name: z.string() }).optional(),
      status: z.string().optional(),
      Time: z.object({ time: z.string() }).optional(),
    });
    const parsed = z
      .object({
        MRData: z.object({
          RaceTable: z
            .object({
              season: z.string(),
              Races: z.array(
                z.object({
                  round: z.string(),
                  raceName: z.string(),
                  date: z.string(),
                  time: z.string().optional(),
                  Circuit: z.object({
                    circuitName: z.string(),
                    Location: z.object({
                      locality: z.string(),
                      country: z.string(),
                    }),
                  }),
                  Results: z.array(row).optional(),
                }),
              ),
            })
            .optional(),
          StandingsTable: z
            .object({
              season: z.string(),
              StandingsLists: z.array(
                z.object({ DriverStandings: z.array(row) }),
              ),
            })
            .optional(),
        }),
      })
      .parse(await response.json());
    return {
      season:
        parsed.MRData.RaceTable?.season ??
        parsed.MRData.StandingsTable?.season ??
        "",
      races: (parsed.MRData.RaceTable?.Races ?? []).map((r) => ({
        round: r.round,
        name: r.raceName,
        date: `${r.date}T${r.time ?? "00:00:00Z"}`,
        timeKnown: Boolean(r.time),
        circuit: r.Circuit.circuitName,
        location: `${r.Circuit.Location.locality}, ${r.Circuit.Location.country}`,
      })),
      drivers:
        (args.view === "standings"
          ? parsed.MRData.StandingsTable?.StandingsLists[0]?.DriverStandings
          : parsed.MRData.RaceTable?.Races[0]?.Results
        )?.map((r) => ({
          position: r.position,
          name: `${r.Driver.givenName} ${r.Driver.familyName}`,
          team:
            r.Constructor?.name ??
            r.Constructors?.map((c) => c.name).join(" / ") ??
            "",
          points: r.points,
          wins: r.wins ?? "",
          detail: r.Time?.time ?? r.status ?? "",
        })) ?? [],
    };
  },
});

export const leagueTable = action({
  args: { league: v.string() },
  handler: async (ctx, args) => {
    if (!(await ctx.auth.getUserIdentity()))
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Inicia sesión",
      });
    if (!isSportsLeague(args.league) || args.league === "f1")
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Competición inválida",
      });
    const response = await fetch(
      `https://site.api.espn.com/apis/v2/sports/${SPORTS_LEAGUES[args.league].path}/standings`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok)
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: "La tabla no está disponible",
      });
    const entry = z.object({
      team: z.object({
        displayName: z.string(),
        logos: z.array(z.object({ href: z.string() })).optional(),
      }),
      stats: z.array(
        z.object({
          name: z.string(),
          displayValue: z.string().optional(),
          value: z.number().optional(),
        }),
      ),
    });
    const group = z.object({
      name: z.string().optional(),
      standings: z.object({ entries: z.array(entry) }).optional(),
    });
    const parsed = z
      .object({
        children: z.array(group).optional(),
        standings: z.object({ entries: z.array(entry) }).optional(),
      })
      .parse(await response.json());
    const groups = parsed.children?.length
      ? parsed.children
      : [
          {
            name: SPORTS_LEAGUES[args.league].name,
            standings: parsed.standings,
          },
        ];
    return groups.slice(0, 12).map((g) => ({
      name: g.name ?? "Clasificación",
      entries: (g.standings?.entries ?? []).slice(0, 40).map((e, index) => {
        const stat = (...names: string[]) => {
          const v = e.stats.find((s) => names.includes(s.name));
          return (
            v?.displayValue ?? (v?.value === undefined ? "—" : String(v.value))
          );
        };
        return {
          name: e.team.displayName,
          rank: stat("rank"),
          played: stat("gamesPlayed"),
          wins: stat("wins"),
          draws: stat("ties", "draws"),
          losses: stat("losses"),
          points: stat("points"),
          difference: stat("pointDifferential", "goalDifference"),
          logo:
            e.team.logos?.find((l) => l.href.startsWith("https://"))?.href ??
            null,
        };
      }),
    }));
  },
});

export const matchStatistics = action({
  args: { league: v.string(), eventId: v.string() },
  handler: async (ctx, args) => {
    if (!(await ctx.auth.getUserIdentity()))
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Inicia sesión",
      });
    if (!isSportsLeague(args.league) || !/^\d{1,15}$/.test(args.eventId))
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Partido inválido",
      });
    const response = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${SPORTS_LEAGUES[args.league].path}/summary?event=${args.eventId}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok)
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: "Detalle no disponible",
      });
    const parsed = z
      .object({
        boxscore: z
          .object({
            teams: z
              .array(
                z.object({
                  team: z.object({ displayName: z.string() }),
                  statistics: z
                    .array(
                      z.object({
                        name: z.string().optional(),
                        label: z.string().optional(),
                        displayValue: z.string(),
                      }),
                    )
                    .optional(),
                }),
              )
              .optional(),
          })
          .optional(),
      })
      .parse(await response.json());
    return (parsed.boxscore?.teams ?? []).slice(0, 2).map((t) => ({
      name: t.team.displayName,
      statistics: (t.statistics ?? []).slice(0, 30).map((s) => ({
        label:
          (
            {
              possessionPct: "Posesión",
              shotsOnTarget: "Remates al arco",
              totalShots: "Remates",
              foulsCommitted: "Faltas",
              yellowCards: "Amarillas",
              redCards: "Rojas",
              offsides: "Fuera de juego",
              cornerKicks: "Córners",
              saves: "Atajadas",
              passes: "Pases",
              accuratePasses: "Pases acertados",
            } as Record<string, string>
          )[s.name ?? ""] ??
          s.label ??
          s.name ??
          "Estadística",
        value: s.displayValue,
      })),
    }));
  },
});

export const matchLineups = action({
  args: { league: v.string(), eventId: v.string() },
  handler: async (ctx, args) => {
    if (!(await ctx.auth.getUserIdentity()))
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Inicia sesión",
      });
    if (!isSportsLeague(args.league) || !/^\d{1,15}$/.test(args.eventId))
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Partido inválido",
      });
    const response = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${SPORTS_LEAGUES[args.league].path}/summary?event=${args.eventId}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok)
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: "Alineaciones no disponibles",
      });
    const parsed = z
      .object({
        rosters: z
          .array(
            z.object({
              team: z.object({ displayName: z.string() }),
              formation: z.string().optional(),
              roster: z
                .array(
                  z.object({
                    athlete: z.object({
                      displayName: z.string(),
                      position: z
                        .object({
                          displayName: z.string().optional(),
                          name: z.string().optional(),
                          abbreviation: z.string().optional(),
                        })
                        .optional(),
                    }),
                    jersey: z.union([z.string(), z.number()]).optional(),
                    starter: z.boolean().optional(),
                    position: z
                      .object({
                        displayName: z.string().optional(),
                        name: z.string().optional(),
                        abbreviation: z.string().optional(),
                      })
                      .optional(),
                  }),
                )
                .optional(),
            }),
          )
          .optional(),
      })
      .safeParse(await response.json());
    if (!parsed.success) return [];
    return (parsed.data.rosters ?? [])
      .slice(0, 2)
      .map((team) => ({
        name: team.team.displayName,
        formation: team.formation ?? null,
        players: (team.roster ?? [])
          .slice(0, 40)
          .map((p) => ({
            name: p.athlete.displayName,
            number: p.jersey === undefined ? null : String(p.jersey),
            starter: p.starter ?? null,
            position:
              p.position?.displayName ??
              p.position?.name ??
              p.position?.abbreviation ??
              p.athlete.position?.displayName ??
              p.athlete.position?.name ??
              p.athlete.position?.abbreviation ??
              null,
          })),
      }));
  },
});
