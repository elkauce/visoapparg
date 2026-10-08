import { useAction } from "convex/react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { api } from "@/convex/_generated/api.js";
import { SPORTS_LEAGUES, isSportsLeague } from "@/convex/lib/sports_leagues.ts";
import { cn } from "@/lib/utils.ts";

const REFRESH_MS = 60 * 1000;

type SportsDialogProps = {
  // null = cerrado
  league: string | null;
  onClose: () => void;
};

// Marcadores de la liga elegida: en vivo, recientes y próximos
export default function SportsDialog({ league, onClose }: SportsDialogProps) {
  const scoreboard = useAction(api.sports.scoreboard);
  const { data, isPending, isError } = useQuery({
    queryKey: ["sports", league],
    queryFn: () => scoreboard({ league: league ?? "" }),
    enabled: league !== null,
    refetchInterval: REFRESH_MS,
  });
  const title = league && isSportsLeague(league) ? SPORTS_LEAGUES[league].name : "Deportes";

  return (
    <Dialog open={league !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {isPending && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        )}
        {isError && (
          <p className="text-sm text-muted-foreground">
            No se pudo cargar el marcador. Inténtalo de nuevo en un momento.
          </p>
        )}
        {data && data.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay partidos para mostrar hoy.</p>
        )}
        {data && data.length > 0 && (
          <ul className="space-y-2">
            {data.map((match) => (
              <li
                key={match.id}
                className="flex items-center gap-3 rounded-xl bg-muted/60 p-3 text-sm"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex justify-between gap-2">
                    <span className="truncate">{match.home.name}</span>
                    <span className="font-bold tabular-nums">{match.home.score}</span>
                  </p>
                  <p className="flex justify-between gap-2">
                    <span className="truncate">{match.away.name}</span>
                    <span className="font-bold tabular-nums">{match.away.score}</span>
                  </p>
                </div>
                <span
                  className={cn(
                    "w-24 shrink-0 text-right text-xs",
                    match.state === "in" ? "font-semibold text-primary" : "text-muted-foreground",
                  )}
                >
                  {match.state === "pre"
                    ? format(new Date(match.date), "d MMM HH:mm")
                    : match.detail}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
