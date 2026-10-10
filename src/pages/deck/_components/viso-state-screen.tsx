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
};

export default function VisoStateScreen({
  statuses,
  activeStatusId,
  pending,
  connected,
  onSelect,
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
      className="flex h-full min-h-0 min-w-0 flex-col gap-1.5"
    >
      <p
        role="status"
        className={
          pending || !connected
            ? "shrink-0 text-center text-xs text-muted-foreground"
            : "sr-only"
        }
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
        className="grid min-h-0 flex-1 grid-cols-2 grid-rows-3 gap-2 p-[max(4px,1vmin)] landscape:grid-cols-3 landscape:grid-rows-2"
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
    </section>
  );
}
