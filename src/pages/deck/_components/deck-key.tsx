import { motion } from "motion/react";
import { Plus } from "lucide-react";
import StatusIcon from "@/components/status-icon.tsx";
import { readableTextColor } from "@/lib/color.ts";
import { cn } from "@/lib/utils.ts";

export type KeyFace = {
  label: string;
  icon: string;
  color: string;
  active: boolean;
};

type DeckKeyProps = {
  // null = posición vacía
  face: KeyFace | null;
  editMode: boolean;
  onPress: () => void;
};

// Tecla del deck de pantalla completa: llena su celda y brilla cuando es el estado activo
export default function DeckKey({ face, editMode, onPress }: DeckKeyProps) {
  if (!face) {
    // Las posiciones vacías solo existen para editar
    return editMode ? (
      <button
        type="button"
        onClick={onPress}
        aria-label="Agregar tecla"
        className="flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <Plus className="size-8" />
      </button>
    ) : (
      <div />
    );
  }

  const text = readableTextColor(face.color);
  return (
    <motion.button
      type="button"
      onClick={onPress}
      whileTap={{ scale: 0.94 }}
      animate={{ scale: face.active ? 1.02 : 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "relative flex min-h-0 min-w-0 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl p-2 font-semibold",
        editMode && "ring-2 ring-primary/60 ring-offset-2 ring-offset-background",
      )}
      style={
        face.active
          ? {
              backgroundColor: face.color,
              color: text,
              boxShadow: `0 0 48px -6px ${face.color}`,
            }
          : { backgroundColor: "var(--card)", color: "var(--card-foreground)" }
      }
    >
      <StatusIcon
        name={face.icon}
        strokeWidth={1.5}
        className="size-9 shrink-0 sm:size-12 lg:size-16"
        style={face.active ? undefined : { color: face.color }}
      />
      <span className="line-clamp-2 w-full text-balance px-1 text-center text-sm leading-tight sm:text-lg lg:text-2xl">
        {face.label}
      </span>
      {!face.active && (
        <span
          className="absolute inset-x-6 bottom-0 h-1 rounded-t-full"
          style={{ backgroundColor: face.color }}
        />
      )}
    </motion.button>
  );
}
