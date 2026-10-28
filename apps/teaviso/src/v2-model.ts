import { servicePlans } from "./service-plans";
export const solutions = servicePlans.map((plan) => ({
  id: plan.id,
  title: plan.title,
  label: "Servicio pago",
  icon: plan.icon,
  color: "orange",
  description: plan.description,
  features: plan.features,
  action: "Conocer la propuesta",
}));

export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function visitorNonce(token: string) {
  const key = `teaviso:visitor:${token}`;
  try {
    const saved = sessionStorage.getItem(key);
    if (saved && /^[a-f0-9]{64}$/.test(saved)) return saved;
    const next = randomToken();
    sessionStorage.setItem(key, next);
    return next;
  } catch {
    return randomToken();
  }
}
