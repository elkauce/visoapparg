import { useState } from "react";
import { useAction } from "convex/react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/convex/_generated/api";
export default function FormulaOnePanel({
  active,
  favorite,
}: {
  active: boolean;
  favorite: string;
}) {
  const [view, setView] = useState<"calendar" | "standings" | "results">(
    "calendar",
  );
  const action = useAction(api.sports.formulaOne);
  const query = useQuery({
    queryKey: ["formula-one", view],
    enabled: active,
    staleTime: 300000,
    refetchInterval: 300000,
    queryFn: () => action({ view }),
  });
  const d = query.data;
  return (
    <div>
      <nav
        className="mb-4 flex flex-wrap gap-2"
        aria-label="Vistas de Fórmula 1"
      >
        {[
          ["calendar", "Calendario"],
          ["standings", "Campeonato"],
          ["results", "Último Gran Premio"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={view === key}
            className={`rounded-lg px-3 py-2 text-sm ${view === key ? "bg-white/20" : "bg-white/5"}`}
            onClick={() => setView(key as typeof view)}
          >
            {label}
          </button>
        ))}
        <button
          className="rounded-lg bg-white/5 px-3 py-2 text-sm"
          onClick={() => void query.refetch()}
        >
          Actualizar F1
        </button>
      </nav>
      {query.isPending && <p>Consultando Fórmula 1…</p>}
      {query.isError && (
        <p role="alert" className="text-amber-300">
          No se pudo actualizar Fórmula 1. Probá de nuevo.
          {d ? " Se muestran los últimos datos recibidos." : ""}
        </p>
      )}
      {d && (
        <>
          <p className="mb-3 text-sm text-white/50">
            Temporada {d.season}
            {view === "results" && d.races[0] ? ` · ${d.races[0].name}` : ""}
          </p>
          {view === "calendar" ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {d.races.map((r) => {
                const passed = Date.parse(r.date) < Date.now();
                return (
                  <article
                    key={r.round}
                    className={`rounded-2xl border border-white/10 p-4 ${passed ? "bg-white/5 text-white/60" : "bg-amber-300/5"}`}
                  >
                    <p className="text-xs text-white/40">
                      Fecha {r.round} · {passed ? "Disputado" : "Próximo"}
                    </p>
                    <h3 className="my-2 font-semibold">{r.name}</h3>
                    <p className="text-sm">{r.circuit}</p>
                    <p className="text-xs text-white/40">{r.location}</p>
                    <p className="mt-3 text-sm">
                      {new Date(r.date).toLocaleDateString("es", {
                        day: "numeric",
                        month: "long",
                      })}
                      {r.timeKnown
                        ? ` · ${new Date(r.date).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`
                        : " · Horario sin confirmar"}
                    </p>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-white/50">
                  <tr>
                    {[
                      "Pos.",
                      "Piloto",
                      "Equipo",
                      "Puntos",
                      view === "standings" ? "Victorias" : "Resultado",
                    ].map((h) => (
                      <th className="p-3" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.drivers.map((r) => (
                    <tr
                      key={r.position}
                      className={
                        favorite &&
                        `${r.name} ${r.team}`
                          .toLocaleLowerCase()
                          .includes(favorite.toLocaleLowerCase())
                          ? "bg-amber-300/10"
                          : "border-t border-white/5"
                      }
                    >
                      <td className="p-3 font-bold">{r.position}</td>
                      <td className="p-3 font-semibold">{r.name}</td>
                      <td className="p-3 text-white/60">{r.team}</td>
                      <td className="p-3">{r.points}</td>
                      <td className="p-3">
                        {view === "standings" ? r.wins : r.detail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!d.drivers.length && <p>No hay resultados disponibles.</p>}
            </div>
          )}
        </>
      )}
      <p className="mt-5 text-xs text-white/40">
        Fuente Jolpica-F1 · Horarios de tu dispositivo. Actualización cada 5
        minutos mientras la página está visible. No es telemetría en directo.
      </p>
    </div>
  );
}
