import { ConvexError, v } from "convex/values";
import { z } from "zod";
import { action } from "./_generated/server";
const forecast = z.object({
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    relative_humidity_2m: z.number(),
    apparent_temperature: z.number(),
    is_day: z.number(),
    precipitation: z.number(),
    weather_code: z.number(),
    cloud_cover: z.number(),
    wind_speed_10m: z.number(),
    wind_direction_10m: z.number(),
    pressure_msl: z.number(),
  }),
  hourly: z.object({
    time: z.array(z.string()).min(24),
    temperature_2m: z.array(z.number()),
    precipitation_probability: z.array(z.number()),
    weather_code: z.array(z.number()),
    visibility: z.array(z.number()),
  }),
  daily: z.object({
    time: z.array(z.string()).min(1),
    weather_code: z.array(z.number()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    sunrise: z.array(z.string()),
    sunset: z.array(z.string()),
    uv_index_max: z.array(z.number()),
    precipitation_probability_max: z.array(z.number()),
  }),
  timezone: z.string(),
});
export const fullForecast = action({
  args: {
    latitude: v.number(),
    longitude: v.number(),
    units: v.union(v.literal("celsius"), v.literal("fahrenheit")),
  },
  handler: async (ctx, args) => {
    if (!(await ctx.auth.getUserIdentity()))
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Inicia sesión",
      });
    if (
      !Number.isFinite(args.latitude) ||
      !Number.isFinite(args.longitude) ||
      Math.abs(args.latitude) > 90 ||
      Math.abs(args.longitude) > 180
    )
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Ubicación inválida",
      });
    const params = new URLSearchParams({
      latitude: String(args.latitude),
      longitude: String(args.longitude),
      temperature_unit: args.units,
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
      { signal: AbortSignal.timeout(12000) },
    );
    if (!response.ok)
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: "No se pudo consultar el pronóstico",
      });
    return forecast.parse(await response.json());
  },
});
