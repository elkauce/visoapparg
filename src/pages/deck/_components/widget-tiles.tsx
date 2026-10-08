import { createElement, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchWeather, weatherIcon } from "../_lib/weather.ts";

const CLOCK_TICK_MS = 1000;
const WEATHER_REFRESH_MS = 15 * 60 * 1000;

type TileShellProps = {
  editMode: boolean;
  onPress: () => void;
  children: React.ReactNode;
};

// Base visual de los widgets: solo responde al toque cuando se está editando
function TileShell({ editMode, onPress, children }: TileShellProps) {
  return (
    <button
      type="button"
      onClick={editMode ? onPress : undefined}
      className={
        "flex min-h-0 min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl bg-card p-2 text-card-foreground " +
        (editMode ? "cursor-pointer ring-2 ring-primary/60 ring-offset-2 ring-offset-background" : "cursor-default")
      }
    >
      {children}
    </button>
  );
}

// Reloj en la hora local del dispositivo que muestra el deck
export function ClockTile({ editMode, onPress }: Omit<TileShellProps, "children">) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <TileShell editMode={editMode} onPress={onPress}>
      <span className="text-2xl font-bold tabular-nums sm:text-4xl lg:text-5xl">
        {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
      <span className="text-xs capitalize text-muted-foreground sm:text-sm lg:text-base">
        {now.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}
      </span>
    </TileShell>
  );
}

type WeatherTileProps = Omit<TileShellProps, "children"> & {
  label: string;
  latitude: number;
  longitude: number;
};

export function WeatherTile({ label, latitude, longitude, editMode, onPress }: WeatherTileProps) {
  const { data, isError } = useQuery({
    queryKey: ["weather", latitude, longitude],
    queryFn: () => fetchWeather(latitude, longitude),
    refetchInterval: WEATHER_REFRESH_MS,
    staleTime: WEATHER_REFRESH_MS,
  });

  return (
    <TileShell editMode={editMode} onPress={onPress}>
      {data &&
        createElement(weatherIcon(data.code, data.isDay), {
          className: "size-8 text-primary sm:size-10 lg:size-14",
          strokeWidth: 1.5,
        })}
      <span className="text-2xl font-bold tabular-nums sm:text-3xl lg:text-4xl">
        {data ? `${Math.round(data.temperature)}°` : isError ? "--" : "..."}
      </span>
      <span className="line-clamp-1 w-full px-1 text-xs text-muted-foreground sm:text-sm lg:text-base">
        {label}
      </span>
    </TileShell>
  );
}
