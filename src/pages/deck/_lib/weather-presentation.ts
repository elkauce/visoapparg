export function weatherDescription(code: number, isDay = true): string {
  if (code === 0) return isDay ? "Despejado" : "Noche despejada";
  if (code === 1) return "Mayormente despejado";
  if (code === 2) return "Parcialmente nublado";
  if (code === 3) return "Nublado";
  if (code === 45 || code === 48) return "Niebla";
  if (code === 51) return "Llovizna débil";
  if (code === 53) return "Llovizna moderada";
  if (code === 55) return "Llovizna intensa";
  if (code === 56 || code === 57) return "Llovizna helada";
  if (code === 61 || code === 80) return "Lluvia débil";
  if (code === 63 || code === 81) return "Lluvia moderada";
  if (code === 65 || code === 82) return "Lluvia intensa";
  if (code === 66 || code === 67) return "Lluvia helada";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Nieve";
  if (code >= 95) return "Tormenta";
  return "Condiciones meteorológicas";
}
export function rainyWeather(code: number) {
  return [
    51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99,
  ].includes(code);
}
export function temperatureCurve(
  values: number[],
  width: number,
  height: number,
) {
  const finite = values.filter(Number.isFinite);
  const min = Math.min(...finite),
    max = Math.max(...finite);
  const span = Math.max(2, max - min);
  return values.map((v, i) => ({
    x: ((i + 0.5) * width) / values.length,
    y: height * 0.8 - ((v - min) / span) * height * 0.6,
  }));
}
