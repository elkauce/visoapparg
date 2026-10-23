import { toast } from "sonner";
import { useEffect, useState } from "react";

export function useTimbreNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export async function timbreTask(
  work: () => Promise<unknown>,
  success?: string,
) {
  try {
    await work();
    if (success) toast.success(success);
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : "No se pudo completar. Intentá de nuevo.",
    );
  }
}
export function timbrePrice(
  amount: number | null | undefined,
  currency: string,
) {
  return amount === null || amount === undefined
    ? "Precio pendiente de configuración"
    : new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(
        amount / 100,
      );
}
