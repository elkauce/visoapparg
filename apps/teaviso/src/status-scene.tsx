import type { ReactNode } from "react";
import { VISO_STATES } from "@/convex/lib/viso_preset_states";

// Share the real VISO palette. This animation is a visual demo, never an account action.
const colorFrames = VISO_STATES.map((state, index) => {
  const start = (index * 100) / VISO_STATES.length;
  const hold = start + (100 / VISO_STATES.length) * 0.6;
  return `${start}%,${hold}%{--tea-state-color:${state.defaultColor}}`;
}).join("");
const cycle = `@keyframes tea-state-cycle{${colorFrames}100%{--tea-state-color:${VISO_STATES[0].defaultColor}}}`;

export default function StatusScene({ children }: { children: ReactNode }) {
  return (
    <div
      className="scene tea-status-scene"
      role="img"
      aria-label="Demostración de Te a Viso con latidos y los colores de los estados VISO"
    >
      <style>{cycle}</style>
      {children}
    </div>
  );
}
