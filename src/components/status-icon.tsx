import { createElement } from "react";
import type { LucideProps } from "lucide-react";
import { getStatusIcon } from "@/lib/status-icons.ts";

// Renderiza el icono de un estado por su clave (los iconos son componentes estáticos)
export default function StatusIcon({
  name,
  ...props
}: LucideProps & { name: string }) {
  return createElement(getStatusIcon(name), props);
}
