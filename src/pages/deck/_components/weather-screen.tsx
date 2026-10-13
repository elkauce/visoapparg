import { createPortal } from "react-dom";
import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import {
  MapPin,
  RefreshCw,
  Droplets,
  Wind,
  Eye,
  Sunrise,
  Sunset,
  Gauge,
  Sun,
  ChevronRight,
} from "lucide-react";
import { weatherIcon } from "../_lib/weather";
import {
  weatherDescription,
  temperatureCurve,
} from "../_lib/weather-presentation";
import type { ScreenSettings } from "@/convex/lib/screen_settings";
import WeatherScene from "./weather-scene";
const glass =
  "rounded-[30px] border border-white/5 bg-[#39666a]/20 p-5 backdrop-blur-md sm:p-6";
export default function WeatherScreen({
  settings,
  active,
  controlHost,
}: {
  settings: ScreenSettings;
  active: boolean;
  controlHost?: HTMLElement | null;
}) {
  const [hours, setHours] = useState(24);
  const fullForecast = useAction(api.weather.fullForecast);
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
    queryFn: () =>
      fullForecast({
        latitude: settings.latitude,
        longitude: settings.longitude,
        units: settings.units,
      }),
  });
  const d = query.data;
  if (!d)
    return (
      <section className="grid h-full place-content-center gap-4 bg-gradient-to-b from-[#85a9bf] to-[#80c1bd] p-6 text-center text-white">
        <p>
          {query.isPending
            ? "Consultando el clima…"
            : "No se pudo consultar el clima."}
        </p>
        <button
          onClick={() => void query.refetch()}
          className="rounded-full bg-white/20 p-3"
        >
          Reintentar
        </button>
      </section>
    );
  const condition = weatherDescription(
    d.current.weather_code,
    d.current.is_day === 1,
  );
  const unit = settings.units === "fahrenheit" ? "°F" : "°C";
  const start = Math.max(
    0,
    d.hourly.time.findIndex((t) => t >= d.current.time),
  );
  const times = d.hourly.time.slice(start, start + hours);
  const values = d.hourly.temperature_2m.slice(start, start + hours);
  const width = times.length * 76;
  const points = temperatureCurve(values, width, 62);
  const clock = (t: string) => t.split("T")[1]?.slice(0, 5) ?? "—";
  const metrics = [
    {
      icon: Wind,
      label: "Viento",
      value: `${Math.round(d.current.wind_speed_10m)} km/h`,
      detail: `Dirección ${d.current.wind_direction_10m}°`,
    },
    {
      icon: Droplets,
      label: "Humedad",
      value: `${d.current.relative_humidity_2m}%`,
      detail: "Humedad relativa",
    },
    {
      icon: Eye,
      label: "Visibilidad",
      value: `${((d.hourly.visibility[start] ?? 0) / 1000).toFixed(1)} km`,
      detail: "Pronóstico horario",
    },
    {
      icon: Gauge,
      label: "Presión",
      value: `${Math.round(d.current.pressure_msl)} hPa`,
      detail: "Nivel del mar",
    },
    {
      icon: Sunrise,
      label: "Amanecer",
      value: clock(d.daily.sunrise[0]),
      detail: "Hora local",
    },
    {
      icon: Sunset,
      label: "Atardecer",
      value: clock(d.daily.sunset[0]),
      detail: "Hora local",
    },
    {
      icon: Sun,
      label: "Índice UV",
      value: String(d.daily.uv_index_max[0]),
      detail: "Máximo previsto hoy",
    },
  ];
  return (
    <section
      className="relative h-full overflow-hidden text-white"
      aria-label="Clima a pantalla completa"
    >
      <WeatherScene
        code={d.current.weather_code}
        isDay={d.current.is_day === 1}
        active={active}
      />
      <div className="relative z-10 h-full overflow-y-auto px-4 pb-24 pt-12 sm:px-7">
        <div className="mx-auto grid max-w-[1500px] gap-4 landscape:grid-cols-[minmax(230px,0.4fr)_minmax(0,1fr)]">
          <header className="relative min-h-[310px] px-3 pb-6 landscape:min-h-[260px] landscape:pt-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-[clamp(24px,3vw,36px)] font-semibold tracking-tight">
                <MapPin className="size-6 shrink-0" />
                {settings.city}
              </h2>
              <button
                style={{ display: "none" }}
                aria-label="Actualizar clima"
                className="shrink-0 rounded-full bg-white/10 p-2"
                onClick={() => void query.refetch()}
              >
                <RefreshCw
                  className={
                    query.isFetching ? "size-4 animate-spin" : "size-4"
                  }
                />
              </button>
            </div>
            <p className="mt-4 text-[clamp(80px,14vw,120px)] font-light leading-none tracking-[-.06em]">
              {Math.round(d.current.temperature_2m)}°
              <span className="sr-only">{unit}</span>
            </p>
            <p className="mt-5 text-2xl font-semibold">{condition}</p>
            <div className="mt-12 text-base landscape:mt-6">
              <p>
                ↑ {Math.round(d.daily.temperature_2m_max[0])}° / ↓{" "}
                {Math.round(d.daily.temperature_2m_min[0])}°
              </p>
              <p>
                Sensación térmica {Math.round(d.current.apparent_temperature)}°
              </p>
            </div>
            {query.isError && (
              <p role="alert" className="mt-3 text-sm">
                No se pudo actualizar. Se conservan los últimos datos recibidos.
              </p>
            )}
          </header>
          <div className="min-w-0 space-y-4">
            <article className={glass}>
              <h3 className="text-base font-semibold leading-relaxed">
                {condition}. Máxima de{" "}
                {Math.round(d.daily.temperature_2m_max[0])}
                {unit} y mínima de {Math.round(d.daily.temperature_2m_min[0])}
                {unit}.
              </h3>
              <div className="my-5 h-px bg-white/15" />
              <h3 className="sr-only">Próximas horas</h3>
              <div
                className="overflow-x-auto pb-2"
                aria-label={`Pronóstico de ${hours} horas`}
              >
                <div style={{ width }}>
                  <div className="flex">
                    {times.map((time, i) => {
                      const k = start + i;
                      const day = d.daily.time.indexOf(time.split("T")[0]);
                      const Icon = weatherIcon(
                        d.hourly.weather_code[k],
                        day >= 0 &&
                          time >= d.daily.sunrise[day] &&
                          time < d.daily.sunset[day],
                      );
                      return (
                        <div
                          key={time}
                          className="flex w-[76px] shrink-0 flex-col items-center gap-4"
                        >
                          <span className="text-sm text-white/65">
                            {clock(time)}
                          </span>
                          <Icon
                            className="size-7 fill-white/20"
                            strokeWidth={1.75}
                          />
                          <span className="text-[23px] font-semibold">
                            {Math.round(values[i])}°
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <svg
                    viewBox={`0 0 ${width} 62`}
                    width={width}
                    height="62"
                    className="my-3"
                    role="img"
                    aria-label="Curva de temperatura por hora"
                  >
                    <polyline
                      points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill="none"
                      stroke="#f6da6b"
                      strokeWidth="2"
                    />
                    {points.map((p, i) => (
                      <circle
                        key={times[i]}
                        cx={p.x}
                        cy={p.y}
                        r="4"
                        fill="white"
                      />
                    ))}
                  </svg>
                  <div className="flex">
                    {times.map((time, i) => (
                      <span
                        key={time}
                        className="flex w-[76px] shrink-0 items-center justify-center gap-1 text-xs text-white/60"
                      >
                        <Droplets className="size-3 fill-white/40" />
                        {d.hourly.precipitation_probability[start + i]}%
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </article>
            <article
              className={`${glass} flex items-center justify-between gap-4`}
            >
              <div>
                <p className="mb-3 flex items-center gap-2 text-sm text-white/70">
                  <Droplets className="size-5" />
                  Precipitación actual
                </p>
                <p className="text-lg font-semibold">
                  Probabilidad de lluvia hoy:{" "}
                  {d.daily.precipitation_probability_max[0]}%
                </p>
              </div>
              <strong className="shrink-0 text-3xl">
                {d.current.precipitation}
                <span className="ml-1 text-lg">mm</span>
              </strong>
            </article>
            <article className={glass}>
              <h3 className="mb-4 text-base font-semibold">Próximos 7 días</h3>
              <div className="space-y-3">
                {d.daily.time.map((date, i) => {
                  const Icon = weatherIcon(d.daily.weather_code[i], true);
                  return (
                    <div
                      key={date}
                      className="grid grid-cols-[minmax(75px,1fr)_30px_54px_90px] items-center gap-2 text-sm"
                    >
                      <span>
                        {i === 0
                          ? "Hoy"
                          : new Date(`${date}T12:00:00`).toLocaleDateString(
                              "es",
                              { weekday: "short", day: "numeric" },
                            )}
                      </span>
                      <Icon className="size-5" />
                      <span className="flex items-center gap-1 text-white/60">
                        <Droplets className="size-3" />
                        {d.daily.precipitation_probability_max[i]}%
                      </span>
                      <span className="text-right font-semibold">
                        {Math.round(d.daily.temperature_2m_max[i])}°{" "}
                        <span className="ml-2 text-white/60">
                          {Math.round(d.daily.temperature_2m_min[i])}°
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </article>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {metrics.map((m) => (
                <article key={m.label} className={glass}>
                  <p className="mb-3 flex items-center gap-2 text-sm text-white/70">
                    <m.icon className="size-4" />
                    {m.label}
                  </p>
                  <p className="text-2xl font-semibold">{m.value}</p>
                  <p className="mt-2 text-xs text-white/55">{m.detail}</p>
                </article>
              ))}
            </div>
            <p className="px-2 text-xs text-white/50">
              Open-Meteo · Actualizado {clock(d.current.time)} · {d.timezone} ·{" "}
              {unit}
            </p>
          </div>
        </div>
      </div>
      {controlHost &&
        createPortal(
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-lg border p-2"
              onClick={() => void query.refetch()}
            >
              Actualizar clima
            </button>
            <button
              className="rounded-lg border p-2"
              onClick={() => setHours(hours === 24 ? 48 : 24)}
            >
              Pronóstico de {hours === 24 ? 48 : 24} horas
            </button>
          </div>,
          controlHost,
        )}
    </section>
  );
}
