import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Check, Pencil, Plus, Power } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import StatusScreen from "@/components/status-screen.tsx";
import StatusDialog from "./status-dialog.tsx";
import StatusKey, { type DeckStatus } from "./status-key.tsx";

const GRID = "grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4";

function errorMessage(error: unknown): string {
  return error instanceof ConvexError
    ? (error.data as { message: string }).message
    : "Algo salió mal, inténtalo de nuevo";
}

export default function Deck() {
  const data = useQuery(api.statuses.list, {});
  const setActive = useMutation(api.statuses.setActive);
  const remove = useMutation(api.statuses.remove);
  const move = useMutation(api.statuses.move);
  const createDefaults = useMutation(api.statuses.createDefaults);

  const [editMode, setEditMode] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DeckStatus | null>(null);
  const [toDelete, setToDelete] = useState<DeckStatus | null>(null);

  // Mientras la sesión se sincroniza (o carga) mostramos esqueletos
  if (!data) {
    return (
      <div className={GRID}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  const { statuses, activeStatusId } = data;
  const active = statuses.find((s) => s._id === activeStatusId);
  // Versión en vivo del estado que se edita: así la vista previa del archivo se actualiza al subirlo
  const editingLive = editing
    ? (statuses.find((s) => s._id === editing._id) ?? editing)
    : null;

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const openEditor = (status: DeckStatus | null) => {
    setEditing(status);
    setDialogOpen(true);
  };

  if (statuses.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed p-10 text-center">
        <p className="text-lg font-semibold">Tu deck está vacío</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Empieza con los estados más comunes o crea el tuyo desde cero.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => run(() => createDefaults({}))}>
            Cargar estados básicos
          </Button>
          <Button variant="secondary" onClick={() => openEditor(null)}>
            <Plus /> Crear el mío
          </Button>
        </div>
        <StatusDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          status={editingLive}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StatusScreen face={active ?? null} className="mx-auto max-w-2xl" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="size-3 rounded-full"
            style={{
              backgroundColor: active?.color ?? "var(--muted-foreground)",
              boxShadow: active ? `0 0 14px ${active.color}` : undefined,
            }}
          />
          <p className="text-sm text-muted-foreground">
            Estado actual:{" "}
            <span className="font-semibold text-foreground">
              {active?.name ?? "Ninguno"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {active && !editMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => run(() => setActive({ statusId: null }))}
            >
              <Power /> Apagar
            </Button>
          )}
          <Button
            variant={editMode ? "default" : "secondary"}
            size="sm"
            onClick={() => setEditMode((value) => !value)}
          >
            {editMode ? <Check /> : <Pencil />}
            {editMode ? "Listo" : "Editar deck"}
          </Button>
        </div>
      </div>

      <div className={GRID}>
        {statuses.map((status, index) => (
          <StatusKey
            key={status._id}
            status={status}
            active={status._id === activeStatusId}
            editMode={editMode}
            isFirst={index === 0}
            isLast={index === statuses.length - 1}
            onPress={() => run(() => setActive({ statusId: status._id }))}
            onEdit={() => openEditor(status)}
            onDelete={() => setToDelete(status)}
            onMove={(direction) =>
              run(() => move({ statusId: status._id, direction }))
            }
          />
        ))}
        <button
          type="button"
          onClick={() => openEditor(null)}
          className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Plus className="size-8" />
          <span className="text-sm font-medium">Añadir estado</span>
        </button>
      </div>

      <StatusDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        status={editingLive}
      />

      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar "{toDelete?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta tecla desaparecerá de tu deck.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) {
                  void run(() =>
                    remove({ statusId: toDelete._id as Id<"statuses"> }),
                  );
                }
                setToDelete(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
