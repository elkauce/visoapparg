import { useAction } from "convex/react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/convex/_generated/api";
export function SportsTable({
  league,
  active,
}: {
  league: string;
  active: boolean;
}) {
  const action = useAction(api.sports.leagueTable);
  const query = useQuery({
    queryKey: ["league-table", league],
    enabled: active,
    staleTime: 300000,
    queryFn: () => action({ league }),
  });
  return (
    <div className="space-y-4">
      {query.isPending && (
        <p className="p-4 text-sm text-white/60">Consultando la tabla…</p>
      )}
      {query.isError && (
        <p
          role="alert"
          className="rounded-2xl bg-[#29272b] p-4 text-sm text-white/60"
        >
          La fuente no ofrece la tabla en este momento.
        </p>
      )}
      {query.data?.map((g) => (
        <article
          key={g.name}
          className="overflow-x-auto rounded-2xl bg-[#29272b] p-3"
        >
          <h3 className="mb-3 text-sm font-semibold">{g.name}</h3>
          <table className="w-full text-xs">
            <thead className="text-white/45">
              <tr>
                {["Equipo", "PJ", "G", "E", "P", "DG", "Pts"].map((h) => (
                  <th key={h} className="p-2 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {g.entries.map((e) => (
                <tr key={e.name} className="border-t border-white/10">
                  <td className="min-w-32 p-2 font-medium">
                    {e.rank !== "—" ? e.rank + ". " : ""}
                    {e.name}
                  </td>
                  {[
                    e.played,
                    e.wins,
                    e.draws,
                    e.losses,
                    e.difference,
                    e.points,
                  ].map((v, i) => (
                    <td key={i} className="p-2 tabular-nums">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!g.entries.length && (
            <p className="text-sm text-white/60">
              No hay posiciones disponibles.
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
export function MatchStatistics({
  league,
  eventId,
}: {
  league: string;
  eventId: string;
}) {
  const action = useAction(api.sports.matchStatistics);
  const query = useQuery({
    queryKey: ["match-statistics", league, eventId],
    staleTime: 60000,
    queryFn: () => action({ league, eventId }),
  });
  return (
    <div className="mt-3">
      {query.isPending && <p className="text-xs">Consultando estadísticas…</p>}
      {query.isError && (
        <p className="text-xs">
          Estadísticas no disponibles para este partido.
        </p>
      )}
      {query.data?.map((t) => (
        <div key={t.name} className="mt-3">
          <h4 className="mb-2 font-semibold">{t.name}</h4>
          {t.statistics.map((s) => (
            <p key={s.label} className="flex justify-between py-1 text-xs">
              <span>{s.label}</span>
              <strong>{s.value}</strong>
            </p>
          ))}
        </div>
      ))}
      {query.data?.length === 0 && (
        <p className="text-xs">Todavía no hay estadísticas disponibles.</p>
      )}
    </div>
  );
}

export function MatchLineups({
  league,
  eventId,
}: {
  league: string;
  eventId: string;
}) {
  const action = useAction(api.sports.matchLineups);
  const query = useQuery({
    queryKey: ["match-lineups", league, eventId],
    queryFn: () => action({ league, eventId }),
    staleTime: 60000,
  });
  return (
    <div className="space-y-4">
      {query.isPending && <p className="text-xs">Consultando alineaciones…</p>}
      {(query.isError || query.data?.length === 0) && (
        <p className="text-xs text-white/60">
          La fuente todavía no ofrece alineaciones para este partido.
        </p>
      )}
      {query.data?.map((team) => (
        <article
          key={team.name}
          className="rounded-2xl border border-white/10 bg-[#242226] p-3"
        >
          <h4 className="mb-3 font-semibold text-white">
            {team.name}{" "}
            {team.formation && (
              <span className="ml-2 text-xs text-white/50">
                {team.formation}
              </span>
            )}
          </h4>
          <PublishedPitch players={team.players} />
          <div className="divide-y divide-white/10">
            {team.players.map((player, i) => (
              <div
                key={`${player.name}-${i}`}
                className="flex items-center gap-3 py-2 text-xs"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded bg-[#343136] text-white">
                  {player.number ?? "—"}
                </span>
                <span className="flex-1 text-white">
                  {player.name}
                  <small className="block text-white/45">
                    {player.position ?? ""}
                  </small>
                </span>
                {player.starter !== null && (
                  <span
                    className={
                      player.starter ? "text-green-400" : "text-white/40"
                    }
                  >
                    {player.starter ? "Titular" : "Suplente"}
                  </span>
                )}
              </div>
            ))}
          </div>
          {!team.players.length && (
            <p className="text-xs text-white/50">Sin jugadores publicados.</p>
          )}
        </article>
      ))}
    </div>
  );
}

function PublishedPitch({
  players,
}: {
  players: {
    name: string;
    number: string | null;
    position: string | null;
    starter: boolean | null;
  }[];
}) {
  const groups = [[], [], [], []] as (typeof players)[];
  for (const p of players.filter((p) => p.starter === true)) {
    const position = (p.position ?? "").toLowerCase();
    const row = /goalkeeper|arquero|portero|^g$/.test(position)
      ? 0
      : /defend|defensor|defensa|back|^d$/.test(position)
        ? 1
        : /midfield|mediocamp|centrocamp|^m$/.test(position)
          ? 2
          : /forward|striker|delantero|atacante|^f$/.test(position)
            ? 3
            : -1;
    if (row < 0) return null;
    groups[row].push(p);
  }
  if (!groups[0].length || groups.reduce((n, row) => n + row.length, 0) !== 11)
    return null;
  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl border border-white/20 bg-[#242b29] p-4">
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full opacity-30"
        viewBox="0 0 100 150"
        preserveAspectRatio="none"
      >
        <rect
          x="4"
          y="4"
          width="92"
          height="142"
          fill="none"
          stroke="white"
          strokeWidth=".5"
        />
        <path
          d="M4 75H96 M30 4V24H70V4 M40 4V12H60V4 M30 146V126H70V146 M40 146V138H60V146"
          fill="none"
          stroke="white"
          strokeWidth=".5"
        />
        <circle
          cx="50"
          cy="75"
          r="12"
          fill="none"
          stroke="white"
          strokeWidth=".5"
        />
      </svg>
      <p className="relative mb-3 text-[10px] text-white/50">
        Titulares publicados · agrupados por posición
      </p>
      <div className="relative space-y-5">
        {groups.map((row, i) => (
          <div key={i} className="flex justify-around gap-2">
            {row.map((p) => (
              <div
                key={p.name}
                className="flex min-w-0 flex-1 flex-col items-center text-center"
              >
                <span className="grid size-7 place-items-center rounded-t-xl rounded-b-md bg-white text-[11px] font-bold text-[#242226]">
                  {p.number ?? "—"}
                </span>
                <span className="mt-1 w-full truncate text-[9px] text-white">
                  {p.name}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MatchLeaguePosition({
  league,
  teams,
}: {
  league: string;
  teams: string[];
}) {
  const action = useAction(api.sports.leagueTable);
  const query = useQuery({
    queryKey: ["league-table", league],
    queryFn: () => action({ league }),
    staleTime: 300000,
  });
  const entries = query.data?.flatMap((group) => group.entries) ?? [];
  return (
    <div className="relative mb-4 overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-[#363237] to-[#242226] px-5 py-6">
      <p className="mb-5 text-center text-xs text-white/60">
        Posición actual en la liga
      </p>
      {query.isPending ? (
        <p className="text-center text-xs text-white/40">Consultando tabla…</p>
      ) : (
        <div className="grid grid-cols-2 gap-7">
          {teams.slice(0, 2).map((name) => {
            const row = entries.find((entry) => entry.name === name);
            const played = Number(row?.played),
              wins = Number(row?.wins);
            const rate =
              row &&
              Number.isFinite(played) &&
              played > 0 &&
              Number.isFinite(wins)
                ? Math.round((wins / played) * 100)
                : null;
            return (
              <div key={name}>
                <p className="mb-3 truncate text-center text-xs text-white/70">
                  {name}
                </p>
                <div className="flex items-center justify-center gap-4">
                  <div className="relative h-24 w-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="absolute inset-x-0 bottom-0 rounded-full bg-white/70"
                      style={{
                        height:
                          rate === null
                            ? "0%"
                            : `${Math.max(0, Math.min(100, rate))}%`,
                      }}
                    />
                  </div>
                  <div>
                    <strong className="block text-xl text-white">
                      {rate === null ? "—" : `${rate}%`}
                    </strong>
                    <span className="block text-[10px] text-white/40">
                      Victorias
                    </span>
                    <span className="mt-2 block text-xs text-white/70">
                      Posición {row?.rank ?? "—"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {query.isError && (
        <p className="mt-3 text-xs text-white/45">
          La fuente no ofrece la tabla en este momento.
        </p>
      )}
    </div>
  );
}
