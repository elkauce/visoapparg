export const convexUrl =
  import.meta.env.VITE_CONVEX_URL ||
  "https://vivid-nightingale-785.convex.cloud";
export const publicOrigin = () => {
  const url = new URL(
    import.meta.env.VITE_TEAVISO_PUBLIC_URL || window.location.origin,
  );
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  )
    throw new Error("Configurá la dirección pública de Te a Viso.");
  return url.origin;
};
export const qrUrl = (token: string) => `${publicOrigin()}/w/${token}`;
export function errorText(error: unknown) {
  if (error && typeof error === "object" && "data" in error) {
    const data = error.data;
    if (typeof data === "string") return data;
    if (
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof data.message === "string"
    )
      return data.message;
  }
  return "No pudimos completar la operación. Revisá tu conexión e intentá de nuevo.";
}
export const money = (amount: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(
    amount / 100,
  );
