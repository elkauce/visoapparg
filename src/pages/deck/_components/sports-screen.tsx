import { useState } from "react";
import { useAction } from "convex/react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/convex/_generated/api";
import {
  SPORTS_LEAGUES,
  type SportsLeagueKey,
} from "@/convex/lib/sports_leagues";
import type { ScreenSettings } from "@/convex/lib/screen_settings";
import { RefreshCw, Trophy } from "lucide-react";
import FormulaOnePanel from "./formula-one-panel";
const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
export default function SportsScreen({
  settings,
  active,
}: {
  settings: ScreenSettings;
  active: boolean;
}) {
  const [selected, setSelected] = useState(settings.leagues[0] ?? "ligaarg");
  const league = settings.leagues.includes(selected)
    ? selected
    : (settings.leagues[0] ?? "ligaarg");
  const [date, setDate] = useState(localDate);
  const [filter, setFilter] = useState("all");
  const action = useAction(api.sports.screenScoreboard);
  const query = useQuery({
    queryKey: ["sports-full", league, date],
    enabled: active && settings.leagues.length > 0 && league !== "f1",
    staleTime: 30000,
    refetchInterval: 60000,
    queryFn: () => action({ league, date }),
  });
  const title = SPORTS_LEAGUES[league as SportsLeagueKey]?.name ?? "Deportes";
  const shown = query.data?.filter((e) => {
    if (filter === "favorite")
      return (
        Boolean(settings.favorite) &&
        [e.name, ...e.competitors.map((c) => c.name)].some((name) =>
          name
            .toLocaleLowerCase()
            .includes(settings.favorite.toLocaleLowerCase()),
        )
      );
    return filter === "all" || e.state === filter;
  });
  return (
    <section className="h-full overflow-y-auto rounded-3xl bg-gradient-to-br from-slate-900 to-black p-4 sm:p-6 text-white">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <Trophy className="text-amber-300" />
            {title}
          </h2>
          <p className="text-xs text-white/50">
            Agenda, resultados y marcadores · Hora de tu dispositivo
          </p>
        </div>
        {league !== "f1" && (
          <div className="flex items-center gap-2">
            <input
              aria-label="Fecha deportiva"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-white/15 bg-black p-2 text-sm"
            />
            <button
              aria-label="Actualizar deportes"
              onClick={() => void query.refetch()}
            >
              <RefreshCw
                className={query.isFetching ? "size-5 animate-spin" : "size-5"}
              />
            </button>
          </div>
        )}
      </header>
      <nav className="my-4 flex flex-wrap gap-2" aria-label="Competiciones">
        {settings.leagues.map((key) => (
          <button
            key={key}
            className={`rounded-full px-3 py-2 text-sm ${league === key ? "bg-amber-300 text-black" : "bg-white/5 text-white/70"}`}
            onClick={() => setSelected(key)}
          >
            {SPORTS_LEAGUES[key as SportsLeagueKey].name}
          </button>
        ))}
      </nav>
      {league === "f1" ? (
        <FormulaOnePanel active={active} favorite={settings.favorite} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {[
              ["all", "Todos"],
              ["in", "En juego"],
              ["pre", "Próximos"],
              ["post", "Finalizados"],
              ["favorite", "Mi favorito"],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={filter === value}
                className={`rounded-lg px-3 py-2 text-xs ${filter === value ? "bg-white/20" : "bg-white/5"}`}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {!settings.leagues.length ? (
            <p>Elegí competiciones en los ajustes de esta página.</p>
          ) : query.isPending ? (
            <p>Cargando eventos…</p>
          ) : null}
          {query.isError && (
            <p
              role="alert"
              className="mb-3 rounded-xl border border-amber-500/20 p-3 text-sm text-amber-300"
            >
              La fuente deportiva no respondió. Probá actualizar; no se muestran
              resultados simulados.
              {query.data
                ? " Los datos anteriores pueden estar desactualizados."
                : ""}
            </p>
          )}
          {filter === "favorite" && !settings.favorite && (
            <p>
              Guardá el nombre de un equipo o piloto en los ajustes para filtrar
              sus eventos.
            </p>
          )}
          {shown?.length === 0 && (
            <p className="py-10 text-center text-white/50">
              No hay eventos para esta fecha y filtro.
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shown?.map((event) => (
              <article
                key={event.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="mb-3 flex justify-between gap-3 text-xs">
                  <span
                    className={
                      event.state === "in" ? "text-green-400" : "text-white/50"
                    }
                  >
                    {event.state === "in"
                      ? "● En juego"
                      : event.state === "post"
                        ? "Finalizado"
                        : new Date(event.date).toLocaleString("es", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                  </span>
                  <span className="text-white/50">{event.detail}</span>
                </div>
                {league === "f1" && (
                  <h3 className="mb-3 font-semibold">{event.name}</h3>
                )}
                <div className="space-y-2">
                  {event.competitors
                    .slice(0, league === "f1" ? 20 : 2)
                    .map((c, i) => (
                      <div
                        key={`${c.name}-${i}`}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-sm">
                          {league === "f1" && c.position
                            ? `${c.position}. `
                            : ""}
                          {c.name}
                        </span>
                        <strong className="text-xl tabular-nums">
                          {c.score || (event.state === "pre" ? "—" : "")}
                        </strong>
                      </div>
                    ))}
                </div>
                {event.venue && (
                  <p className="mt-3 text-xs text-white/40">{event.venue}</p>
                )}
              </article>
            ))}
          </div>
          <p className="mt-5 text-xs text-white/40">
            Datos ESPN · Actualización cada minuto mientras esta página está
            visible.
            {query.dataUpdatedAt
              ? ` Última consulta: ${new Date(query.dataUpdatedAt).toLocaleTimeString("es")}.`
              : ""}{" "}
            La cobertura y las demoras dependen de la competición y de la
            fuente.
          </p>
        </>
      )}
    </section>
  );
}
