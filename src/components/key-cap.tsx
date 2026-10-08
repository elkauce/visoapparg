import { motion } from "motion/react";
import StatusIcon from "@/components/status-icon.tsx";
import { cn } from "@/lib/utils.ts";

const RAISED_SHADOW = "0 6px 0 #0b0b0e, 0 10px 20px rgba(0,0,0,0.35)";

type KeyCapProps = {
  label: string;
  icon: string;
  color: string;
  active: boolean;
  onClick: () => void;
  className?: string;
};

// Tecla 3D estilo Stream Deck: sobresale y se hunde al pulsarla; el estado activo queda hundido con su luz encendida
export default function KeyCap({ label, icon, color, active, onClick, className }: KeyCapProps) {
  return (
    <motion.button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      initial={false}
      animate={{
        y: active ? 5 : 0,
        boxShadow: active
          ? `0 1px 0 #0b0b0e, 0 0 38px -6px ${color}`
          : RAISED_SHADOW,
      }}
      whileTap={{ y: 5, boxShadow: "0 1px 0 #0b0b0e, 0 2px 6px rgba(0,0,0,0.4)" }}
      transition={{ type: "spring", stiffness: 600, damping: 32 }}
      className={cn(
        "group relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-white/10 p-2 text-center",
        active ? "bg-[#1a1b20]" : "bg-[#26272c] hover:bg-[#2a2b31]",
        className,
      )}
    >
      <StatusIcon
        name={icon}
        strokeWidth={1.75}
        className="size-8 sm:size-10"
        style={{ color, filter: active ? `drop-shadow(0 0 8px ${color})` : undefined }}
      />
      <span className="line-clamp-2 text-xs leading-tight font-semibold text-white/90 sm:text-sm">
        {label}
      </span>
      <span
        className="absolute inset-x-5 bottom-0 h-1 rounded-t-full transition-opacity"
        style={{
          backgroundColor: color,
          opacity: active ? 1 : 0.35,
          boxShadow: active ? `0 0 12px ${color}` : undefined,
        }}
      />
    </motion.button>
  );
}
