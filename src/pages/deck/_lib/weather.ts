import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";

export type WeatherNow = { temperature: number; code: number; isDay: boolean };

export type GeoResult = {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
};

// Códigos WMO de Open-Meteo agrupados por tipo de clima
export function weatherIcon(code: number, isDay: boolean): LucideIcon {
  if (code === 0) {
    return isDay ? Sun : Moon;
  }
  if (code <= 3) {
    return Cloud;
  }
  if (code === 45 || code === 48) {
    return CloudFog;
  }
  if (code >= 51 && code <= 57) {
    return CloudDrizzle;
  }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return CloudRain;
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return CloudSnow;
  }
  return code >= 95 ? CloudLightning : Cloud;
}

// Open-Meteo no pide clave y permite llamadas desde el navegador
export async function fetchWeather(latitude: number, longitude: number): Promise<WeatherNow> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,is_day&timezone=auto`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Clima no disponible");
  }
  const data = (await response.json()) as {
    current: { temperature_2m: number; weather_code: number; is_day: number };
  };
  return {
    temperature: data.current.temperature_2m,
    code: data.current.weather_code,
    isDay: data.current.is_day === 1,
  };
}

export async function searchCity(name: string): Promise<GeoResult[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=es`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Búsqueda no disponible");
  }
  const data = (await response.json()) as { results?: GeoResult[] };
  return data.results ?? [];
}
