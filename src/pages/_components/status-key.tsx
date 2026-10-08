import { ArrowLeft, ArrowRight, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import KeyCap from "@/components/key-cap.tsx";
import { cn } from "@/lib/utils.ts";

export type DeckStatus = {
  _id: string;
  name: string;
  color: string;
  icon: string;
  light?: { on: boolean; brightness: number; temperature: number };
  webhookUrl?: string;
  mediaUrl?: string | null;
  mediaType?: "image" | "video";
};

type StatusKeyProps = {
  status: DeckStatus;
  active: boolean;
  editMode: boolean;
  isFirst: boolean;
  isLast: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
};

// Tecla estilo Stream Deck: al activarse brilla con el color del estado
export default function StatusKey({
  status,
  active,
  editMode,
  isFirst,
  isLast,
  onPress,
  onEdit,
  onDelete,
  onMove,
}: StatusKeyProps) {
  return (
    <div className="relative">
      <KeyCap
        label={status.name}
        icon={status.icon}
        color={status.color}
        active={active}
        onClick={editMode ? onEdit : onPress}
        className={cn(editMode && "ring-2 ring-primary/60 ring-offset-2 ring-offset-background")}
      />

      {editMode && (
        <div className="absolute inset-x-1 -bottom-3 flex items-center justify-center gap-1 rounded-full border bg-popover p-0.5 shadow-lg">
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            disabled={isFirst}
            onClick={() => onMove(-1)}
            aria-label="Mover a la izquierda"
          >
            <ArrowLeft className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={onEdit}
            aria-label="Editar"
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-destructive hover:text-destructive"
            onClick={onDelete}
            aria-label="Eliminar"
          >
            <Trash2 className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            disabled={isLast}
            onClick={() => onMove(1)}
            aria-label="Mover a la derecha"
          >
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
