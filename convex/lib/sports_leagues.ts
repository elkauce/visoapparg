// Ligas disponibles: clave interna -> nombre y ruta del marcador público de ESPN
export const SPORTS_LEAGUES = {
  "laliga": { name: "LaLiga", path: "soccer/esp.1" },
  "premier": { name: "Premier League", path: "soccer/eng.1" },
  "bundesliga": { name: "Bundesliga", path: "soccer/ger.1" },
  "seriea": { name: "Serie A", path: "soccer/ita.1" },
  "ligue1": { name: "Ligue 1", path: "soccer/fra.1" },
  "champions": { name: "Champions League", path: "soccer/uefa.champions" },
  "ligamx": { name: "Liga MX", path: "soccer/mex.1" },
  "ligaarg": { name: "Liga Argentina", path: "soccer/arg.1" },
  "mls": { name: "MLS", path: "soccer/usa.1" },
  "nba": { name: "NBA", path: "basketball/nba" },
  "nfl": { name: "NFL", path: "football/nfl" },
  "mlb": { name: "MLB", path: "baseball/mlb" },
  "nhl": { name: "NHL", path: "hockey/nhl" },
} as const;

export type SportsLeagueKey = keyof typeof SPORTS_LEAGUES;

export function isSportsLeague(key: string): key is SportsLeagueKey {
  return key in SPORTS_LEAGUES;
}
