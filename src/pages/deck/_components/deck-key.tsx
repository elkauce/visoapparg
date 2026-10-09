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
  mediaUrl?: string | null;
  mediaType?: "image" | "video";
};

type DeckKeyProps = {
  // null = posición vacía
  face: KeyFace | null;
  editMode: boolean;
  onPress: () => void;
  disabled?: boolean;
  pending?: boolean;
  canvas?: boolean;
};

// Tecla del deck de pantalla completa: llena su celda y brilla cuando es el estado activo
export default function DeckKey({
  face,
  editMode,
  onPress,
  disabled = false,
  pending = false,
  canvas = false,
}: DeckKeyProps) {
  if (!face) {
    // Las posiciones vacías solo existen para editar
    return editMode ? (
      <button
        type="button"
        onClick={onPress}
        disabled={disabled}
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
      aria-label={face.label}
      aria-pressed={face.active}
      aria-busy={pending}
      disabled={disabled}
      whileTap={{ scale: 0.94 }}
      animate={{ scale: face.active ? 1.02 : 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "relative flex min-h-0 min-w-0 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl p-2 font-semibold",
        editMode &&
          "ring-2 ring-primary/60 ring-offset-2 ring-offset-background",
      )}
      style={
        face.active
          ? {
              backgroundColor: face.color,
              color: text,
              boxShadow: `0 0 48px -6px ${face.color}`,
            }
          : {
              backgroundColor: canvas ? "transparent" : "var(--card)",
              color: "var(--card-foreground)",
            }
      }
    >
      {face.mediaUrl &&
        (face.mediaType === "video" ? (
          <video
            src={face.mediaUrl}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            className="absolute inset-0 size-full object-cover"
            aria-hidden="true"
          />
        ) : (
          <img
            src={face.mediaUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
        ))}
      {face.mediaUrl && (
        <span className="absolute inset-0 bg-black/40" aria-hidden="true" />
      )}
      <StatusIcon
        name={face.icon}
        strokeWidth={1.5}
        className="relative size-9 shrink-0 sm:size-[min(3rem,var(--deck-icon-limit,3rem))] lg:size-[min(4rem,var(--deck-icon-limit,4rem))]"
        style={
          face.mediaUrl && face.active
            ? { color: "#ffffff" }
            : face.active
              ? undefined
              : { color: face.color }
        }
      />
      <span
        className="relative line-clamp-2 w-full text-balance px-1 text-center text-sm leading-tight sm:text-[min(1.125rem,var(--deck-text-limit,1.125rem))] lg:text-[min(1.5rem,var(--deck-text-limit,1.5rem))]"
        style={face.mediaUrl ? { color: "#ffffff" } : undefined}
      >
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
