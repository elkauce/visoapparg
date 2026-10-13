import { useId, useState } from "react";
type Match = {
  id: string;
  venue?: string;
  date: string;
  state: string;
  detail: string;
  competitors: {
    name: string;
    score: string;
    logo?: string | null;
    homeAway?: string;
  }[];
};
export default function SportsScoreCard({
  match,
  onOpen,
}: {
  match: Match;
  onOpen(): void;
}) {
  const id = useId().replace(/[^a-z0-9]/gi, "");
  const live = match.state === "in";
  const [failed, setFailed] = useState<string[]>([]);
  return (
    <button
      onClick={onOpen}
      aria-label="Abrir partido destacado"
      className="relative mb-5 block aspect-[2/1] w-full overflow-hidden rounded-[24px] border border-white/15 bg-[#252327] text-white shadow-[0_16px_35px_#0006]"
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 600 300"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#565357" />
            <stop offset=".55" stopColor={live ? "#3e5344" : "#454347"} />
            <stop offset="1" stopColor={live ? "#335c35" : "#4b474b"} />
          </linearGradient>
        </defs>
        <path
          d="M0 75 H165 C195 75 205 108 250 108 H350 C395 108 405 75 435 75 H600 V276 Q600 300 576 300 H390 C365 300 368 226 338 226 H262 C232 226 235 300 210 300 H24 Q0 300 0 276Z"
          fill={`url(#${id})`}
          stroke="#ffffff25"
          strokeWidth="1.5"
        />
        <path
          d="M24 18 Q24 10 36 10 H110 Q125 10 137 4 H460 Q474 10 490 10 H564 Q576 10 576 22"
          fill="none"
          stroke="#ffffff10"
        />
      </svg>
      <div className="absolute inset-x-[18%] top-[9%] text-center">
        <p className="truncate text-[clamp(12px,3.2vw,17px)] font-semibold">
          {match.venue || "Partido"}
        </p>
        <p className="mt-1 text-[10px] text-white/45">
          {new Date(match.date).toLocaleDateString("es-AR", {
            day: "numeric",
            month: "short",
          })}
        </p>
      </div>
      <span className="absolute left-4 top-[15%] text-[9px] text-white/25">
        Partido
      </span>
      <span className="absolute right-4 top-[15%] text-[9px] text-white/25">
        {live ? "En vivo" : match.state === "post" ? "Finalizado" : "Próximo"}
      </span>
      {match.competitors.slice(0, 2).map((team, i) => (
        <span
          key={team.name}
          className={`absolute top-[42%] flex w-[33%] flex-col items-center ${i === 0 ? "left-[2%]" : "right-[2%]"}`}
        >
          {team.logo && !failed.includes(team.name) ? (
            <img
              src={team.logo}
              alt=""
              className="h-[clamp(40px,12vw,64px)] w-[clamp(40px,12vw,64px)] object-contain"
              onError={(e) => {
                setFailed((previous) => [...previous, team.name]);
              }}
            />
          ) : (
            <span className="grid size-11 place-items-center rounded-full bg-black/15 text-lg font-bold">
              {team.name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")}
            </span>
          )}
          <span className="mt-1 max-w-full truncate px-1 text-[clamp(10px,2.8vw,14px)] font-semibold">
            {team.name}
          </span>
          <span className="text-[9px] text-white/50">
            {team.homeAway === "home"
              ? "⌂ Local"
              : team.homeAway === "away"
                ? "Visitante"
                : ""}
          </span>
        </span>
      ))}
      <strong className="absolute inset-x-[34%] top-[44%] text-center text-[clamp(30px,8vw,44px)] font-semibold tabular-nums">
        {match.state === "pre"
          ? "— : —"
          : `${match.competitors[0]?.score || "—"} : ${match.competitors[1]?.score || "—"}`}
      </strong>
      <span
        className={`absolute bottom-[8%] left-[36%] w-[28%] truncate text-center text-[10px] font-semibold ${live ? "text-[#44ea48]" : "text-white/60"}`}
      >
        {match.detail ||
          (match.state === "pre"
            ? new Date(match.date).toLocaleTimeString("es-AR", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Finalizado")}
      </span>
    </button>
  );
}
