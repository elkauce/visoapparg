import { useQuery } from "@tanstack/react-query";
import {
  RefreshCw,
  Droplets,
  Wind,
  Eye,
  Sunrise,
  Sunset,
  Thermometer,
  Gauge,
} from "lucide-react";
import { weatherIcon } from "../_lib/weather";
import type { ScreenSettings } from "@/convex/lib/screen_settings";
export default function WeatherScreen({
  settings,
  active,
}: {
  settings: ScreenSettings;
  active: boolean;
}) {
  const query = useQuery({
    queryKey: [
      "full-weather",
      settings.latitude,
      settings.longitude,
      settings.units,
    ],
    enabled: active,
    refetchInterval: 600000,
    staleTime: 300000,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        latitude: String(settings.latitude),
        longitude: String(settings.longitude),
        temperature_unit: settings.units,
        timezone: "auto",
        forecast_days: "7",
        current:
          "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,pressure_msl",
        hourly:
          "temperature_2m,precipitation_probability,weather_code,visibility",
        daily:
          "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max",
      });
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?${params}`,
        { signal },
      );
      if (!response.ok) throw new Error("No se pudo actualizar el clima");
      const d = await response.json();
      if (
        !d.current ||
        !d.hourly ||
        !d.daily ||
        !Number.isFinite(d.current.temperature_2m)
      )
        throw new Error("Datos meteorológicos incompletos");
      return d as {
        current: {
          time: string;
          temperature_2m: number;
          relative_humidity_2m: number;
          apparent_temperature: number;
          is_day: number;
          precipitation: number;
          weather_code: number;
          cloud_cover: number;
          wind_speed_10m: number;
          wind_direction_10m: number;
          pressure_msl: number;
        };
        hourly: {
          time: string[];
          temperature_2m: number[];
          precipitation_probability: number[];
          weather_code: number[];
          visibility: number[];
        };
        daily: {
          time: string[];
          weather_code: number[];
          temperature_2m_max: number[];
          temperature_2m_min: number[];
          sunrise: string[];
          sunset: string[];
          uv_index_max: number[];
          precipitation_probability_max: number[];
        };
        timezone: string;
      };
    },
  });
  const d = query.data;
  const unit = settings.units === "fahrenheit" ? "°F" : "°C";
  if (!d)
    return (
      <div className="grid h-full place-content-center gap-4 text-center">
        <p>
          {query.isPending
            ? "Consultando el clima…"
            : "No se pudo consultar el clima."}
        </p>
        <button onClick={() => void query.refetch()}>Reintentar</button>
      </div>
    );
  const Icon = weatherIcon(d.current.weather_code, d.current.is_day === 1);
  const index = Math.max(
    0,
    d.hourly.time.findIndex((t) => t >= d.current.time),
  );
  const conditions =
    d.current.weather_code === 0
      ? "Despejado"
      : d.current.weather_code <= 3
        ? "Nublado"
        : d.current.weather_code <= 48
          ? "Niebla"
          : d.current.weather_code <= 67
            ? "Lluvia"
            : d.current.weather_code <= 77
              ? "Nieve"
              : d.current.weather_code < 95
                ? "Chubascos"
                : "Tormenta";
  const clock = (t: string) => t.split("T")[1]?.slice(0, 5) ?? "—";
  const metrics = [
    {
      icon: Thermometer,
      label: "Sensación",
      value: `${Math.round(d.current.apparent_temperature)}${unit}`,
    },
    {
      icon: Droplets,
      label: "Humedad",
      value: `${d.current.relative_humidity_2m}%`,
    },
    {
      icon: Wind,
      label: "Viento",
      value: `${Math.round(d.current.wind_speed_10m)} km/h · ${d.current.wind_direction_10m}°`,
    },
    {
      icon: Gauge,
      label: "Presión",
      value: `${Math.round(d.current.pressure_msl)} hPa`,
    },
    {
      icon: Eye,
      label: "Visibilidad",
      value: `${((d.hourly.visibility[index] ?? 0) / 1000).toFixed(1)} km`,
    },
    { icon: Sunrise, label: "Amanecer", value: clock(d.daily.sunrise[0]) },
    { icon: Sunset, label: "Atardecer", value: clock(d.daily.sunset[0]) },
    {
      icon: Thermometer,
      label: "Índice UV",
      value: String(d.daily.uv_index_max[0]),
    },
  ];
  return (
    <section className="h-full overflow-y-auto rounded-3xl bg-gradient-to-br from-sky-950 via-slate-950 to-black p-4 sm:p-6 text-white">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{settings.city}</h2>
          <p className="text-sm text-white/50">
            {conditions} · {d.timezone}
          </p>
        </div>
        <button
          aria-label="Actualizar clima"
          onClick={() => void query.refetch()}
        >
          <RefreshCw
            className={query.isFetching ? "size-5 animate-spin" : "size-5"}
          />
        </button>
      </header>
      {query.isError && (
        <p role="alert" className="mt-2 text-amber-300">
          No se pudo actualizar. Se muestran los últimos datos recibidos.
        </p>
      )}
      <div className="my-5 grid gap-5 md:grid-cols-[1fr_2fr]">
        <div className="flex items-center gap-4">
          <Icon className="size-20 text-sky-300" />
          <div>
            <p className="text-6xl font-bold tabular-nums">
              {Math.round(d.current.temperature_2m)}
              <span className="text-2xl">{unit}</span>
            </p>
            <p className="mt-2 text-white/60">
              Máx. {Math.round(d.daily.temperature_2m_max[0])}° · Mín.{" "}
              {Math.round(d.daily.temperature_2m_min[0])}°
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-2xl bg-white/5 p-3">
              <m.icon className="mb-1 size-4 text-sky-300" />
              <p className="text-xs text-white/50">{m.label}</p>
              <p className="text-sm font-semibold">{m.value}</p>
            </div>
          ))}
        </div>
      </div>
      <h3 className="mb-2 text-sm text-white/60">Próximas horas</h3>
      <div className="flex gap-2 overflow-x-auto pb-3">
        {d.hourly.time.slice(index, index + 24).map((time, i) => {
          const k = index + i;
          const I = weatherIcon(d.hourly.weather_code[k], true);
          return (
            <div
              key={time}
              className="flex min-w-20 flex-col items-center gap-2 rounded-2xl bg-white/5 p-3"
            >
              <span className="text-xs text-white/60">{clock(time)}</span>
              <I className="size-6 text-sky-200" />
              <strong>{Math.round(d.hourly.temperature_2m[k])}°</strong>
              <span className="text-xs text-sky-300">
                {d.hourly.precipitation_probability[k]}%
              </span>
            </div>
          );
        })}
      </div>
      <h3 className="my-2 text-sm text-white/60">Pronóstico de 7 días</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {d.daily.time.map((date, i) => {
          const I = weatherIcon(d.daily.weather_code[i], true);
          return (
            <div
              key={date}
              className="flex items-center justify-between gap-2 rounded-2xl bg-white/5 p-3 lg:flex-col"
            >
              <span className="text-sm">
                {new Date(`${date}T12:00:00`).toLocaleDateString("es", {
                  weekday: "short",
                  day: "numeric",
                })}
              </span>
              <I className="size-6 text-sky-200" />
              <span>
                {Math.round(d.daily.temperature_2m_min[i])}° /{" "}
                {Math.round(d.daily.temperature_2m_max[i])}°
              </span>
              <span className="text-xs text-sky-300">
                {d.daily.precipitation_probability_max[i]}%
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-white/40">
        Open-Meteo · Actualizado {clock(d.current.time)} (hora local de la
        ciudad). Probabilidad de lluvia en %.
      </p>
    </section>
  );
}
