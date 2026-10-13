import { vi, expect, it, afterEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { modules } from "./test.setup";
import { api } from "./_generated/api";
afterEach(() => vi.unstubAllGlobals());
it("rejects unauthenticated sports requests and prevents arbitrary dates or providers", async () => {
  const t = convexTest(schema, modules);
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(
    t.action(api.sports.screenScoreboard, {
      league: "nba",
      date: "2026-10-13",
    }),
  ).rejects.toThrow(/UNAUTHENTICATED/);
  const id = await t.run((ctx) => ctx.db.insert("users", { name: "Viewer" }));
  const signed = t.withIdentity({ subject: `${id}|s` });
  await expect(
    signed.action(api.sports.screenScoreboard, {
      league: "https://example.test",
      date: "2026-10-13",
    }),
  ).rejects.toThrow(/BAD_REQUEST/);
  await expect(
    signed.action(api.sports.screenScoreboard, {
      league: "nba",
      date: "today&url=x",
    }),
  ).rejects.toThrow(/BAD_REQUEST/);
  expect(fetch).not.toHaveBeenCalled();
});
it("parses real provider contracts for full scoreboards and F1 standings without creating mock events in the product", async () => {
  const t = convexTest(schema, modules);
  const id = await t.run((ctx) => ctx.db.insert("users", { name: "Viewer" }));
  const signed = t.withIdentity({ subject: `${id}|s` });
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          events: [
            {
              id: "game",
              name: "Test game",
              date: "2026-10-13T20:00:00Z",
              status: { type: { state: "in", shortDetail: "2nd quarter" } },
              competitions: [
                {
                  venue: { fullName: "Arena" },
                  competitors: [
                    { team: { displayName: "Team A" }, score: "42" },
                    { team: { displayName: "Team B" }, score: "39" },
                  ],
                },
              ],
            },
          ],
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          MRData: {
            StandingsTable: {
              season: "2026",
              StandingsLists: [
                {
                  DriverStandings: [
                    {
                      position: "1",
                      points: "100",
                      wins: "2",
                      Driver: { givenName: "Test", familyName: "Driver" },
                      Constructors: [{ name: "Test Team" }],
                    },
                  ],
                },
              ],
            },
          },
        }),
      ),
    );
  vi.stubGlobal("fetch", fetch);
  const events = await signed.action(api.sports.screenScoreboard, {
    league: "nba",
    date: "2026-10-13",
  });
  expect(events[0]).toMatchObject({
    state: "in",
    venue: "Arena",
    competitors: [
      { name: "Team A", score: "42" },
      { name: "Team B", score: "39" },
    ],
  });
  const f1 = await signed.action(api.sports.formulaOne, { view: "standings" });
  expect(f1).toMatchObject({
    season: "2026",
    drivers: [
      { position: "1", name: "Test Driver", team: "Test Team", points: "100" },
    ],
  });
  expect(fetch.mock.calls[0][0]).toBe(
    "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=20261013&limit=50",
  );
  expect(fetch.mock.calls[1][0]).toBe(
    "https://api.jolpi.ca/ergast/f1/current/driverStandings.json?limit=100",
  );
});

it("keeps Latin American tables and match detail authenticated and bounded to supported providers", async () => {
  const t = convexTest(schema, modules);
  const id = await t.run((ctx) => ctx.db.insert("users", { name: "Viewer" }));
  const signed = t.withIdentity({ subject: `${id}|s` });
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          children: [
            {
              name: "Argentina",
              standings: {
                entries: [
                  {
                    team: { displayName: "Equipo" },
                    stats: [
                      { name: "points", displayValue: "30" },
                      { name: "gamesPlayed", displayValue: "14" },
                    ],
                  },
                ],
              },
            },
          ],
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          boxscore: {
            teams: [
              {
                team: { displayName: "Equipo" },
                statistics: [
                  {
                    name: "possessionPct",
                    label: "Possession",
                    displayValue: "61%",
                  },
                ],
              },
            ],
          },
        }),
      ),
    );
  vi.stubGlobal("fetch", fetch);
  await expect(
    t.action(api.sports.leagueTable, { league: "ligaarg" }),
  ).rejects.toThrow(/UNAUTHENTICATED/);
  await expect(
    signed.action(api.sports.matchStatistics, {
      league: "ligaarg",
      eventId: "1&url=https://example.test",
    }),
  ).rejects.toThrow(/BAD_REQUEST/);
  expect(fetch).not.toHaveBeenCalled();
  const table = await signed.action(api.sports.leagueTable, {
    league: "ligaarg",
  });
  expect(table[0].entries[0]).toMatchObject({
    name: "Equipo",
    points: "30",
    played: "14",
    draws: "—",
  });
  const stats = await signed.action(api.sports.matchStatistics, {
    league: "ligaarg",
    eventId: "12345",
  });
  expect(stats[0].statistics[0]).toEqual({ label: "Posesión", value: "61%" });
  expect(fetch.mock.calls[0][0]).toBe(
    "https://site.api.espn.com/apis/v2/sports/soccer/arg.1/standings",
  );
});

it("returns only provider lineups and rejects unsafe event identifiers", async () => {
  const t = convexTest(schema, modules);
  const id = await t.run((ctx) => ctx.db.insert("users", { name: "Fan" }));
  const signed = t.withIdentity({ subject: `${id}|s` });
  const request = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          rosters: [
            {
              team: { displayName: "River Plate" },
              formation: "4-3-3",
              roster: [
                {
                  athlete: { displayName: "Provider Player" },
                  jersey: "9",
                  starter: true,
                  position: { name: "Forward" },
                },
              ],
            },
          ],
        }),
      ),
    );
  vi.stubGlobal("fetch", request);
  await expect(
    t.action(api.sports.matchLineups, { league: "ligaarg", eventId: "123" }),
  ).rejects.toThrow(/UNAUTHENTICATED/);
  await expect(
    signed.action(api.sports.matchLineups, {
      league: "ligaarg",
      eventId: "123&other=1",
    }),
  ).rejects.toThrow(/BAD_REQUEST/);
  expect(request).not.toHaveBeenCalled();
  const lineups = await signed.action(api.sports.matchLineups, {
    league: "ligaarg",
    eventId: "123",
  });
  expect(lineups).toEqual([
    {
      name: "River Plate",
      formation: "4-3-3",
      players: [
        {
          name: "Provider Player",
          number: "9",
          starter: true,
          position: "Forward",
        },
      ],
    },
  ]);
  request.mockResolvedValueOnce(new Response(JSON.stringify({})));
  expect(
    await signed.action(api.sports.matchLineups, {
      league: "ligaarg",
      eventId: "123",
    }),
  ).toEqual([]);
});
