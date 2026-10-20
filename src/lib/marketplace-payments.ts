export function percentToBps(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const cleaned = value.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(cleaned)) throw new Error("Usá un porcentaje entre 0 y 100, con hasta dos decimales.");
  const number = Number(cleaned);
  if (number > 100) throw new Error("La comisión no puede superar el 100%.");
  return Math.round(number * 100);
}
