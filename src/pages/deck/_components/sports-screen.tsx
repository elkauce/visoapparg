import { createPortal } from "react-dom";
import { SportsTable, MatchStatistics, MatchLineups } from "./sports-details";
import { useState } from "react";
import { useAction } from "convex/react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/convex/_generated/api";
import {
  SPORTS_LEAGUES,
  type SportsLeagueKey,
} from "@/convex/lib/sports_leagues";
import type { ScreenSettings } from "@/convex/lib/screen_settings";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Star,
  Search,
  List,
  Trophy,
  CalendarDays,
} from "lucide-react";
import FormulaOnePanel from "./formula-one-panel";
const dateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function Crest({
  name,
  logo,
  large = false,
}: {
  name: string;
  logo?: string | null;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={`${large ? "size-12" : "size-8"} grid shrink-0 place-items-center rounded-full bg-[#363238] text-xs font-bold text-[#d5d0d2]`}
    >
      {logo && !failed ? (
        <img
          src={logo}
          alt=""
          className={`${large ? "size-10" : "size-7"} object-contain`}
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
  onSelectionChange,
}: {
  settings: ScreenSettings;
  active: boolean;
  controlHost?: HTMLElement | null;
  editing?: boolean;
  onSelectionChange?(patch: Partial<ScreenSettings>): Promise<void>;
}) {
  const selected = settings.sportsLeague || settings.leagues[0] || "ligaarg";
  const persist = (patch: Partial<ScreenSettings>) => {
    void onSelectionChange?.(patch);
  };
  const setSelected = (sportsLeague: string) => persist({ sportsLeague });
  const league = settings.leagues.includes(selected)
    ? selected
    : (settings.leagues[0] ?? "ligaarg");
  const date = settings.sportsDate || dateString(new Date());
  const filter = settings.sportsFilter;
  const view = settings.sportsView;
  const setDate = (sportsDate: string) => persist({ sportsDate });
  const setFilter = (sportsFilter: string) => persist({ sportsFilter });
  const [search, setSearch] = useState("");
  const [detailView, setDetailView] = useState<"stats" | "lineups">("stats");
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
  const chooseView = (next: string) => {
    const patch: Partial<ScreenSettings> = {
      sportsView: next,
      sportsFilter:
        next === "favorite" ? "favorite" : next === "history" ? "post" : "all",
    };
    if (next === "history" && date >= dateString(new Date())) {
      const previous = new Date();
      previous.setDate(previous.getDate() - 1);
      patch.sportsDate = dateString(previous);
    }
    persist(patch);
  };
  const previousDate = (days: number) => {
    const previous = new Date();
    previous.setDate(previous.getDate() - days);
    persist({
      sportsDate: dateString(previous),
      sportsView: "history",
      sportsFilter: "post",
    });
  };
  const favorite = (e: NonNullable<typeof query.data>[number]) =>
    e.competitors.some(
      (c) =>
        settings.sportsTeams.includes(c.name) ||
        (Boolean(settings.favorite) &&
          c.name
            .toLocaleLowerCase()
            .includes(settings.favorite.toLocaleLowerCase())),
    );
  const toggleFavorite = (name: string) =>
    persist({
      sportsTeams: settings.sportsTeams.includes(name)
        ? settings.sportsTeams.filter((n) => n !== name)
        : [...settings.sportsTeams, name].slice(0, 50),
    });
  const shown = query.data?.filter(
    (e) =>
      (filter === "favorite"
        ? favorite(e)
        : filter === "all" || e.state === filter) &&
      (!search ||
        [e.name, ...e.competitors.map((c) => c.name)].some((n) =>
          n.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
        )),
  );
  const hero = shown?.find((e) => e.state === "in") ?? shown?.[0];
  return (
    <section
      className="h-full flex flex-col overflow-hidden bg-[#141316] px-4 pb-3 pt-0 text-[#f5f4f4] sm:px-7"
      data-passive={!editing}
      aria-label="Deportes a pantalla completa"
    >
      <style>{`[data-passive=true] .sports-toolbar {display:none!important}`}</style>
      <header className="mx-auto flex w-full shrink-0 max-w-[520px] items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-br from-[#151417] via-[#21191c] to-[#321d23] px-3 py-3 text-white">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#f34054]">
            VISO
          </p>
          <h2 className="mt-1 text-[clamp(22px,4vw,32px)] font-bold leading-tight tracking-tight">
            {view === "history"
              ? "Resultados anteriores"
              : filter === "favorite"
                ? "Mis equipos"
                : "VISO Deportes"}
          </h2>
          <p className="mt-1 text-xs text-white/50">
            Argentina y Latinoamérica
          </p>
        </div>
        <button
          aria-label="Actualizar deportes"
          className="grid size-10 place-items-center rounded-full border border-white/10 bg-[#302c2e] text-white"
          onClick={() => void query.refetch()}
        >
          <RefreshCw
            className={query.isFetching ? "size-4 animate-spin" : "size-4"}
          />
        </button>
      </header>
      <div className="mx-auto w-full max-w-[520px] min-h-0 flex-1 overflow-y-auto pb-4">
        <div className="my-4 flex items-center justify-between rounded-2xl border border-white/10 bg-[#262327] px-2 py-2">
          <span className="rounded bg-[#21b647] px-2 py-1 text-[10px] font-bold text-white">
            {shown?.some((e) => e.state === "in") ? "EN VIVO" : "PARTIDOS"}
          </span>
          <button
            aria-label="Día anterior"
            className="p-2"
            onClick={() => shift(-1)}
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="border-b-2 border-[#f13c52] px-3 py-1 text-center text-sm font-semibold">
            {new Date(`${date}T12:00:00`).toLocaleDateString("es-AR", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </div>
          <button
            aria-label="Día siguiente"
            className="p-2"
            onClick={() => shift(1)}
          >
            <ChevronRight className="size-4" />
          </button>
          <CalendarDays className="size-4 text-white/60" />
        </div>
        <label className="mb-4 flex items-center gap-2 rounded-xl border border-white/10 bg-[#232125] px-3 py-2 text-white/50">
          <Search className="size-4" />
          <input
            aria-label="Buscar equipo o partido"
            placeholder="Buscar equipo o partido"
            className="w-full bg-transparent text-sm text-white outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {hero && view !== "table" && (
          <button
            onClick={() => setExpanded(hero.id)}
            aria-label="Abrir partido destacado"
            className="mb-5 w-full overflow-hidden rounded-[24px] border border-white/15 bg-gradient-to-b from-[#454145] to-[#292a27] px-4 py-5 text-center shadow-lg"
          >
            <p className="text-xs text-white/50">
              {hero.venue || SPORTS_LEAGUES[league as SportsLeagueKey]?.name}
            </p>
            <div className="my-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              {hero.competitors.slice(0, 2).map((c, i) => (
                <div key={c.name} className="contents">
                  {i === 1 && (
                    <strong className="text-4xl font-semibold tabular-nums">
                      {hero.state === "pre"
                        ? "— : —"
                        : `${hero.competitors[0].score || "—"} : ${c.score || "—"}`}
                    </strong>
                  )}
                  <span className="flex flex-col items-center gap-2">
                    <Crest
                      large
                      name={c.name}
                      logo={"logo" in c ? (c.logo as string | null) : undefined}
                    />
                    <span className="text-xs font-semibold">{c.name}</span>
                  </span>
                </div>
              ))}
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs ${hero.state === "in" ? "bg-green-500/15 text-green-400" : "bg-white/5 text-white/60"}`}
            >
              {hero.detail ||
                (hero.state === "pre" ? "Próximo partido" : "Finalizado")}
            </span>
          </button>
        )}

        <div className="sports-toolbar my-4 flex gap-2">
          {[
            ["matches", "Partidos"],
            ["history", "Resultados anteriores"],
            ["table", "Tabla"],
            ["favorite", "Mis equipos"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${view === key ? "bg-[#d82e43] text-white" : "bg-[#29272b] text-slate-500"}`}
              onClick={() => chooseView(key)}
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
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${league === key ? "bg-[#252529] text-white" : "bg-[#29272b] text-[#73737b]"}`}
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
              <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-[#242226] p-1">
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
                    className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold ${filter === v ? "bg-[#29272b] text-white shadow-sm" : "text-[#777780]"}`}
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
                  className="text-xs font-semibold text-[#f3485d]"
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
                className="mb-3 rounded-2xl bg-[#29272b] p-4 text-sm text-[#90622b]"
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
                    className="h-44 animate-pulse rounded-3xl bg-[#29272b]"
                  />
                ))}
                <p className="sr-only">Cargando eventos…</p>
              </div>
            )}
            {!settings.leagues.length && (
              <p className="rounded-3xl bg-[#29272b] p-6">
                Elegí las competiciones que querés seguir en los ajustes.
              </p>
            )}
            {filter === "favorite" &&
              !settings.favorite &&
              !settings.sportsTeams.length && (
                <p className="mb-3 rounded-3xl bg-[#29272b] p-6">
                  Guardá tu equipo o piloto favorito en los ajustes de Deportes.
                </p>
              )}
            {shown?.length === 0 && (
              <div className="rounded-3xl bg-[#29272b] p-10 text-center">
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
                  className="relative overflow-hidden rounded-[22px] border border-white/10 bg-gradient-to-br from-[#302d30] to-[#242226] shadow-[0_8px_24px_#0004]"
                >
                  <button
                    className="block w-full p-3 pr-10 text-left"
                    aria-expanded={expanded === e.id}
                    aria-label={`Ver partido ${e.name || e.competitors.map((c) => c.name).join(" contra ")}`}
                    onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                  >
                    <div className="mb-2 flex justify-between gap-2 text-[10px] font-medium">
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
                          <Star className="size-3 fill-[#ffd34d] text-[#ffd34d]" />
                        )}
                      </span>
                    </div>
                    <div className="space-y-2">
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
                          <span className="min-w-0 flex-1 text-[14px] font-semibold tracking-tight">
                            {c.name}
                          </span>
                          <strong className="text-[20px] font-bold tabular-nums tracking-tight">
                            {e.state === "pre" ? "—" : c.score || "—"}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </button>
                  <div className="absolute right-3 top-12 flex flex-col gap-3">
                    {e.competitors.slice(0, 2).map((c) => (
                      <button
                        key={c.name}
                        aria-label={`Favorito ${c.name}`}
                        aria-pressed={settings.sportsTeams.includes(c.name)}
                        onClick={() => toggleFavorite(c.name)}
                        className="rounded-full p-1"
                      >
                        <Star
                          className={`size-4 ${settings.sportsTeams.includes(c.name) ? "fill-[#ffd34d] text-[#ffd34d]" : "text-white/35"}`}
                        />
                        <span className="sr-only">{c.name}</span>
                      </button>
                    ))}
                  </div>
                  {expanded === e.id && (
                    <div className="border-t border-white/10 px-5 py-4 text-sm text-[#8a8a95]">
                      <p>
                        {new Date(e.date).toLocaleString("es", {
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {e.venue && <p className="mt-1">{e.venue}</p>}
                      <div className="my-3 flex gap-2 border-b border-white/10">
                        <button
                          className={`px-3 py-2 ${detailView === "stats" ? "border-b-2 border-[#f13c52] text-white" : "text-white/50"}`}
                          onClick={() => setDetailView("stats")}
                        >
                          Estadísticas
                        </button>
                        <button
                          className={`px-3 py-2 ${detailView === "lineups" ? "border-b-2 border-[#f13c52] text-white" : "text-white/50"}`}
                          onClick={() => setDetailView("lineups")}
                        >
                          Alineaciones
                        </button>
                      </div>
                      {detailView === "lineups" ? (
                        <MatchLineups league={league} eventId={e.id} />
                      ) : (
                        <MatchStatistics league={league} eventId={e.id} />
                      )}
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
      <nav
        aria-label="Vistas deportivas"
        className="mx-auto mt-3 flex w-full shrink-0 max-w-[520px] items-center justify-around rounded-[24px] border border-white/10 bg-[#1d1b1f] p-2 shadow-xl"
      >
        {[
          ["matches", "Marcadores", List],
          ["favorite", "Favoritos", Star],
          ["table", "Tabla", Trophy],
          ["history", "Historial", CalendarDays],
        ].map(([key, label, Icon]) => {
          const Symbol = Icon as typeof Star;
          return (
            <button
              key={key as string}
              onClick={() => chooseView(key as string)}
              className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-[10px] ${view === key ? "border-b-2 border-[#f13c52] text-white" : "text-white/50"}`}
            >
              <Symbol
                className={`size-4 ${key === "favorite" ? "text-[#ffd34d]" : ""}`}
              />
              {label as string}
            </button>
          );
        })}
      </nav>
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
                onChange={(e) => chooseView(e.target.value)}
              >
                <option value="matches">Partidos</option>
                <option value="history">Resultados anteriores</option>
                <option value="table">Tabla</option>
                <option value="favorite">Mis equipos</option>
              </select>
            </label>
            <p className="text-sm text-muted-foreground">
              Elegí una fecha para consultar los resultados que ofrece la
              competición.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded border p-2"
                onClick={() => previousDate(1)}
              >
                Ayer
              </button>
              <button
                className="rounded border p-2"
                onClick={() => previousDate(7)}
              >
                Hace una semana
              </button>
              <button
                className="rounded border p-2"
                aria-label="Día anterior"
                onClick={() => shift(-1)}
              >
                Día anterior
              </button>
              <button
                className="rounded border p-2"
                aria-label="Día siguiente"
                onClick={() => shift(1)}
              >
                Día siguiente
              </button>
              <button
                className="rounded border p-2"
                onClick={() => {
                  persist({
                    sportsDate: "",
                    sportsView: "matches",
                    sportsFilter: "all",
                  });
                }}
              >
                Hoy
              </button>
            </div>
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
