import { Lightbulb } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import DeckKey from "./deck-key.tsx";
import {
  findVisoStatus,
  VISO_STATES,
  type VisoStateDefinition,
  type VisoStatusRecord,
} from "../_lib/viso-states.ts";

export type VisoStateScreenProps = {
  statuses: readonly VisoStatusRecord[];
  activeStatusId: Id<"statuses"> | null;
  pending: boolean;
  connected: boolean;
  onSelect: (
    definition: VisoStateDefinition,
    statusId: Id<"statuses"> | null,
  ) => void;
  onConfigureLights: () => void;
};

export default function VisoStateScreen({
  statuses,
  activeStatusId,
  pending,
  connected,
  onSelect,
  onConfigureLights,
}: VisoStateScreenProps) {
  const activeStatus = statuses.find((status) => status._id === activeStatusId);
  const activeDefinition = VISO_STATES.find(
    (definition) =>
      findVisoStatus(definition, statuses)?._id === activeStatusId,
  );
  const activeLabel = activeDefinition?.label ?? activeStatus?.name;

  return (
    <section
      aria-label="Estados VISO"
      className="flex h-full min-h-0 min-w-0 flex-col gap-3"
    >
      <p
        role="status"
        className="min-h-5 shrink-0 text-center text-xs text-muted-foreground"
      >
        {pending
          ? "Guardando estado…"
          : !connected
            ? activeLabel
              ? `Sin conexión · Último estado recibido: ${activeLabel}`
              : "Sin conexión · Esperando sincronización"
            : activeLabel
              ? `Estado sincronizado: ${activeLabel}`
              : "Seleccioná un estado"}
      </p>
      <div
        role="group"
        aria-label="Seleccionar estado VISO"
        className="grid min-h-0 flex-1 grid-cols-2 grid-rows-3 gap-3 landscape:grid-cols-3 landscape:grid-rows-2"
      >
        {VISO_STATES.map((definition) => {
          const status = findVisoStatus(definition, statuses);
          return (
            <div
              key={definition.key}
              className="contents"
              title={
                status
                  ? undefined
                  : `Al seleccionar ${definition.label} se creará este estado en tu cuenta`
              }
            >
              <DeckKey
                face={{
                  label: definition.label,
                  color: status?.color ?? definition.defaultColor,
                  icon: status?.icon ?? definition.icon,
                  active: status !== null && status._id === activeStatusId,
                }}
                editMode={false}
                pending={pending}
                disabled={pending || !connected}
                onPress={() => onSelect(definition, status?._id ?? null)}
              />
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onConfigureLights}
        className="flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <Lightbulb aria-hidden="true" className="size-4" />
        Luces Google Home
      </button>
    </section>
  );
}
