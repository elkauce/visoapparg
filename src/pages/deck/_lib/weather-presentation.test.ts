import { it, expect } from "vitest";
import {
  weatherDescription,
  rainyWeather,
  temperatureCurve,
} from "./weather-presentation";
it("distinguishes drizzle, rain, snow and night using actual WMO codes", () => {
  expect(weatherDescription(51)).toBe("Llovizna débil");
  expect(weatherDescription(61)).toBe("Lluvia débil");
  expect(weatherDescription(71)).toBe("Nieve");
  expect(weatherDescription(0, false)).toBe("Noche despejada");
  expect(rainyWeather(51)).toBe(true);
  expect(rainyWeather(3)).toBe(false);
  expect(rainyWeather(71)).toBe(false);
});
it("plots a flat forecast without division by zero and places warmer hours higher", () => {
  const flat = temperatureCurve([13, 13, 13], 228, 62);
  expect(flat.every((p) => Number.isFinite(p.y) && p.y === flat[0].y)).toBe(
    true,
  );
  const varied = temperatureCurve([-3, 0, 5], 228, 62);
  expect(varied[0].y).toBeGreaterThan(varied[2].y);
  expect(varied[0].x).toBeLessThan(varied[2].x);
});
