import { createPortal } from "react-dom";
import { SportsTable, MatchStatistics } from "./sports-details";
import { useState } from "react";
import { useAction } from "convex/react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/convex/_generated/api";
import {
  SPORTS_LEAGUES,
  type SportsLeagueKey,
} from "@/convex/lib/sports_leagues";
import type { ScreenSettings } from "@/convex/lib/screen_settings";
import { ChevronLeft, ChevronRight, RefreshCw, Star } from "lucide-react";
import FormulaOnePanel from "./formula-one-panel";
const dateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function Crest({ name, logo }: { name: string; logo?: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#f4f4f6] text-sm font-bold text-[#777]">
      {logo && !failed ? (
        <img
          src={logo}
          alt=""
          className="size-9 object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        name
          .split(" ")
          .map((w) => w[0])
          .slice(0, 2)
          .join("")
      )}
    </span>
  );
}
export default function SportsScreen({
  settings,
  active,
  controlHost,
  editing = false,
}: {
  settings: ScreenSettings;
  active: boolean;
  controlHost?: HTMLElement | null;
  editing?: boolean;
}) {
  const [selected, setSelected] = useState(settings.leagues[0] ?? "ligaarg");
  const league = settings.leagues.includes(selected)
    ? selected
    : (settings.leagues[0] ?? "ligaarg");
  const [date, setDate] = useState(() => dateString(new Date()));
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("matches");
  const [expanded, setExpanded] = useState<string | null>(null);
  const action = useAction(api.sports.screenScoreboard);
  const query = useQuery({
    queryKey: ["sports-full", league, date],
    enabled: active && settings.leagues.length > 0 && league !== "f1",
    staleTime: 30000,
    refetchInterval: 60000,
    queryFn: () => action({ league, date }),
  });
  const shift = (delta: number) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + delta);
    setDate(dateString(d));
  };
  const favorite = (e: NonNullable<typeof query.data>[number]) =>
    Boolean(settings.favorite) &&
    [e.name, ...e.competitors.map((c) => c.name)].some((n) =>
      n.toLocaleLowerCase().includes(settings.favorite.toLocaleLowerCase()),
    );
  const shown = query.data?.filter((e) =>
    filter === "favorite"
      ? favorite(e)
      : filter === "all" || e.state === filter,
  );
  return (
    <section
      className="h-full overflow-y-auto bg-[#f2f2f7] px-4 pb-6 pt-0 text-[#171719] sm:px-7"
      data-passive={!editing}
      aria-label="Deportes a pantalla completa"
    >
      <style>{`[data-passive=true] .sports-toolbar {display:none!important}`}</style>
      <header className="mx-auto flex max-w-[520px] items-center justify-between gap-3 rounded-b-3xl bg-gradient-to-br from-[#5535ef] via-[#9c42cf] to-[#eea547] px-5 py-8 text-white">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/65">
            VISO
          </p>
          <h2 className="mt-1 text-[clamp(28px,4vw,42px)] font-bold leading-tight tracking-tight">
            {filter === "favorite" ? "Mis equipos" : "VISO Deportes"}
          </h2>
          <p className="mt-2 text-sm text-white/75">
            Argentina y Latinoamérica
          </p>
        </div>
        <button
          aria-label="Actualizar deportes"
          className="sports-toolbar grid size-10 place-items-center rounded-full bg-white text-[#7352d6]"
          onClick={() => void query.refetch()}
        >
          <RefreshCw
            className={query.isFetching ? "size-4 animate-spin" : "size-4"}
          />
        </button>
      </header>
      <div className="mx-auto max-w-[520px]">
        <div className="sports-toolbar my-4 flex gap-2">
          {[
            ["matches", "Partidos"],
            ["table", "Tabla"],
            ["favorite", "Mis equipos"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${view === key ? "bg-[#6a3ce4] text-white" : "bg-white text-slate-500"}`}
              onClick={() => {
                setView(key);
                setFilter(key === "favorite" ? "favorite" : "all");
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <nav
          className="sports-toolbar my-5 flex gap-2 overflow-x-auto pb-1"
          aria-label="Competiciones"
        >
          {settings.leagues.map((key) => (
            <button
              key={key}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${league === key ? "bg-[#252529] text-white" : "bg-white text-[#73737b]"}`}
              aria-pressed={league === key}
              onClick={() => {
                setSelected(key);
                setExpanded(null);
              }}
            >
              {SPORTS_LEAGUES[key as SportsLeagueKey].name}
            </button>
          ))}
        </nav>
        {view === "table" && league !== "f1" ? (
          <SportsTable league={league} active={active} />
        ) : league === "f1" ? (
          <div className="rounded-3xl bg-[#171719] p-5 text-white">
            <FormulaOnePanel
              active={active}
              favorite={settings.favorite}
              controlHost={controlHost}
              editing={editing}
            />
          </div>
        ) : (
          <>
            <div className="sports-toolbar mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-[#e5e5eb] p-1">
                {[
                  ["all", "Todos"],
                  ["in", "En vivo"],
                  ["pre", "Próximos"],
                  ["post", "Finalizados"],
                  ["favorite", "Favoritos"],
                ].map(([v, n]) => (
                  <button
                    key={v}
                    aria-pressed={filter === v}
                    className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold ${filter === v ? "bg-white text-black shadow-sm" : "text-[#777780]"}`}
                    onClick={() => setFilter(v)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  aria-label="Día anterior"
                  className="p-2"
                  onClick={() => shift(-1)}
                >
                  <ChevronLeft className="size-4" />
                </button>
                <label className="text-sm font-semibold">
                  <input
                    aria-label="Fecha deportiva"
                    type="date"
                    value={date}
                    onChange={(e) => {
                      if (e.target.value) setDate(e.target.value);
                    }}
                    className="max-w-36 bg-transparent text-sm"
                  />
                </label>
                <button
                  aria-label="Día siguiente"
                  className="p-2"
                  onClick={() => shift(1)}
                >
                  <ChevronRight className="size-4" />
                </button>
                <button
                  className="text-xs font-semibold text-[#7352d6]"
                  onClick={() => setDate(dateString(new Date()))}
                >
                  Hoy
                </button>
              </div>
            </div>
            <div className="mb-3 flex justify-between text-xs font-semibold uppercase tracking-wider text-[#8c8c95]">
              <span>{SPORTS_LEAGUES[league as SportsLeagueKey]?.name}</span>
              <span>
                {new Date(`${date}T12:00:00`).toLocaleDateString("es", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>
            {query.isError && (
              <p
                role="alert"
                className="mb-3 rounded-2xl bg-white p-4 text-sm text-[#90622b]"
              >
                No se pudo actualizar el marcador.
                {query.data
                  ? " Se conservan los últimos resultados recibidos."
                  : " Probá actualizar."}
              </p>
            )}
            {query.isPending && settings.leagues.length > 0 && (
              <div className="grid gap-4 grid-cols-1">
                {[0, 1].map((n) => (
                  <div
                    key={n}
                    className="h-44 animate-pulse rounded-3xl bg-white"
                  />
                ))}
                <p className="sr-only">Cargando eventos…</p>
              </div>
            )}
            {!settings.leagues.length && (
              <p className="rounded-3xl bg-white p-6">
                Elegí las competiciones que querés seguir en los ajustes.
              </p>
            )}
            {filter === "favorite" && !settings.favorite && (
              <p className="mb-3 rounded-3xl bg-white p-6">
                Guardá tu equipo o piloto favorito en los ajustes de Deportes.
              </p>
            )}
            {shown?.length === 0 && (
              <div className="rounded-3xl bg-white p-10 text-center">
                <p className="font-semibold">Sin eventos para mostrar</p>
                <p className="mt-2 text-sm text-[#8c8c95]">
                  Elegí otra fecha, competición o filtro.
                </p>
              </div>
            )}
            <div className="grid items-start gap-4 grid-cols-1">
              {shown?.map((e) => (
                <article
                  key={e.id}
                  className="overflow-hidden rounded-[26px] bg-white shadow-[0_2px_12px_#00000003]"
                >
                  <button
                    className="block w-full p-5 text-left"
                    aria-expanded={expanded === e.id}
                    aria-label={`Ver partido ${e.name || e.competitors.map((c) => c.name).join(" contra ")}`}
                    onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                  >
                    <div className="mb-4 flex justify-between gap-2 text-xs font-medium">
                      <span
                        className={
                          e.state === "in"
                            ? "flex items-center gap-1 text-[#32a060]"
                            : "text-[#909099]"
                        }
                      >
                        {e.state === "in"
                          ? "● En vivo"
                          : e.state === "post"
                            ? "Finalizado"
                            : new Date(e.date).toLocaleTimeString("es", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                      </span>
                      <span className="flex items-center gap-2 text-[#909099]">
                        {e.detail}
                        {favorite(e) && (
                          <Star className="size-3 fill-[#7653d8] text-[#7653d8]" />
                        )}
                      </span>
                    </div>
                    <div className="space-y-4">
                      {e.competitors.slice(0, 2).map((c, i) => (
                        <div
                          key={`${c.name}-${i}`}
                          className="flex items-center gap-3"
                        >
                          <Crest
                            name={c.name}
                            logo={
                              "logo" in c
                                ? (c.logo as string | null)
                                : undefined
                            }
                          />
                          <span className="min-w-0 flex-1 text-[17px] font-semibold tracking-tight">
                            {c.name}
                          </span>
                          <strong className="text-[32px] font-bold tabular-nums tracking-tight">
                            {e.state === "pre" ? "—" : c.score || "—"}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </button>
                  {expanded === e.id && (
                    <div className="border-t border-[#f0f0f5] px-5 py-4 text-sm text-[#8a8a95]">
                      <p>
                        {new Date(e.date).toLocaleString("es", {
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {e.venue && <p className="mt-1">{e.venue}</p>}
                      <MatchStatistics league={league} eventId={e.id} />
                    </div>
                  )}
                </article>
              ))}
            </div>
            <p className="mt-5 text-[11px] text-[#9d9da6]">
              ESPN ·{" "}
              {query.dataUpdatedAt
                ? `Actualizado ${new Date(query.dataUpdatedAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`
                : "Marcadores reales"}{" "}
              · Horarios locales
            </p>
          </>
        )}
      </div>
      {controlHost &&
        createPortal(
          <div className="space-y-3">
            <label className="block">
              Competición
              <select
                aria-label="Competición deportiva"
                className="ml-2 rounded border bg-background p-2"
                value={league}
                onChange={(e) => setSelected(e.target.value)}
              >
                {settings.leagues.map((k) => (
                  <option key={k} value={k}>
                    {SPORTS_LEAGUES[k as SportsLeagueKey].name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              Vista
              <select
                aria-label="Vista deportiva"
                className="ml-2 rounded border bg-background p-2"
                value={view}
                onChange={(e) => {
                  setView(e.target.value);
                  setFilter(e.target.value === "favorite" ? "favorite" : "all");
                }}
              >
                <option value="matches">Partidos</option>
                <option value="table">Tabla</option>
                <option value="favorite">Mis equipos</option>
              </select>
            </label>
            <input
              aria-label="Fecha deportiva"
              className="rounded border bg-background p-2"
              type="date"
              value={date}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
            />
            <button
              className="ml-2 rounded border p-2"
              onClick={() => void query.refetch()}
            >
              Actualizar
            </button>
          </div>,
          controlHost,
        )}
    </section>
  );
}
