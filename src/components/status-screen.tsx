import { AnimatePresence, motion } from "motion/react";
import StatusIcon from "@/components/status-icon.tsx";
import { readableTextColor } from "@/lib/color.ts";
import { cn } from "@/lib/utils.ts";

type StatusScreenProps = {
  // null = nada marcado: pantalla apagada
  face: { name: string; color: string; icon: string } | null;
  // Texto pequeño sobre la pantalla (por ejemplo la dirección del link público)
  caption?: string;
  className?: string;
};

// Pantalla del dispositivo: se llena con el color del estado. Usa unidades del contenedor para escalar
export default function StatusScreen({ face, caption, className }: StatusScreenProps) {
  const color = face?.color ?? "#121317";
  const text = face ? readableTextColor(face.color) : "#ffffff";

  return (
    <div
      className={cn(
        "@container relative aspect-[16/10] w-full overflow-hidden rounded-3xl border-[1.5px] border-white/15 shadow-2xl",
        className,
      )}
    >
      <motion.div
        initial={false}
        animate={{ backgroundColor: color }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="absolute inset-0 flex items-center justify-center"
        style={{ color: text }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={face?.name ?? "off"}
            initial={{ opacity: 0, scale: 0.85, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex flex-col items-center gap-[3cqw] drop-shadow-md"
          >
            {face ? (
              <>
                <StatusIcon name={face.icon} strokeWidth={1.5} className="size-[18cqw]" />
                <span className="text-[11cqw] font-extrabold leading-none tracking-tight">
                  {face.name}
                </span>
              </>
            ) : (
              <span className="text-[6cqw] font-semibold tracking-widest text-white/50 uppercase">
                Sin estado
              </span>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
      {caption && (
        <span className="absolute top-[3cqw] left-1/2 -translate-x-1/2 rounded-full bg-black/30 px-[3cqw] py-[1cqw] font-mono text-[2.6cqw] text-white/80 backdrop-blur">
          {caption}
        </span>
      )}
    </div>
  );
}
