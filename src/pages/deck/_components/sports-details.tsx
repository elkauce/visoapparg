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
        <p className="p-4 text-sm text-slate-500">Consultando la tabla…</p>
      )}
      {query.isError && (
        <p
          role="alert"
          className="rounded-2xl bg-white p-4 text-sm text-slate-500"
        >
          La fuente no ofrece la tabla en este momento.
        </p>
      )}
      {query.data?.map((g) => (
        <article
          key={g.name}
          className="overflow-x-auto rounded-2xl bg-white p-3"
        >
          <h3 className="mb-3 text-sm font-semibold">{g.name}</h3>
          <table className="w-full text-xs">
            <thead className="text-slate-400">
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
                <tr key={e.name} className="border-t border-slate-100">
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
            <p className="text-sm text-slate-500">
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
