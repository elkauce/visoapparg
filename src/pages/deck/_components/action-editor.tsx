import { useEffect, useId, useState } from "react";
import { Check, Smartphone } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import type { DeckAction, SimpleDeckAction } from "../_lib/action-runner.ts";
import type { DeckStatusInfo } from "../_lib/resolve-key.ts";
import {
  isAndroidNative,
  nativeDeck,
  type InstalledAndroidApp,
} from "@/lib/android-native.ts";
import { cn } from "@/lib/utils.ts";

type PageInfo = { _id: string; name: string };
export type ActionEditorProps = {
  value: DeckAction;
  onChange: (value: DeckAction) => void;
  statuses: DeckStatusInfo[];
  pages: PageInfo[];
  disabled?: boolean;
  onAppSelected?: (app: InstalledAndroidApp) => void;
};

const ACTION_LABELS: Record<DeckAction["type"], string> = {
  status: "Cambiar estado",
  off: "Apagar estado",
  display: "Abrir Display",
  page: "Cambiar página",
  url: "Abrir enlace web",
  "android-app": "Abrir aplicación",
  media: "Control multimedia Android",
  rgb: "Control de luz RGB",
  automation: "Automatización",
};
const MEDIA_LABELS = {
  "play-pause": "Reproducir / pausar",
  next: "Siguiente pista",
  previous: "Pista anterior",
  "volume-up": "Subir volumen",
  "volume-down": "Bajar volumen",
  mute: "Silenciar",
} as const;
const RGB_LABELS = {
  color: "Color",
  brightness: "Brillo",
  power: "Encender / apagar",
  scene: "Escena",
} as const;
const MAX_STEPS = 16;

function choices<T extends string>(labels: Record<T, string>) {
  return (Object.keys(labels) as T[]).map((value) => ({
    value,
    label: labels[value],
  }));
}

// Shared with the parent form so its initial action matches this editor.
// eslint-disable-next-line react-refresh/only-export-components
export function createSimpleAction(
  type: SimpleDeckAction["type"],
  statuses: DeckStatusInfo[],
  pages: PageInfo[],
): SimpleDeckAction {
  switch (type) {
    case "status":
      return statuses[0]
        ? { type, statusId: statuses[0]._id as Id<"statuses"> }
        : { type: "off" };
    case "off":
    case "display":
      return { type };
    case "page":
      return { type, pageId: (pages[0]?._id ?? "") as Id<"deckPages"> };
    case "url":
      return { type, url: "" };
    case "android-app":
      return { type, packageName: "" };
    case "media":
      return { type, command: "play-pause" };
    case "rgb":
      return { type, command: "color", deviceId: "", color: "#ffffff" };
  }
}

/** Completeness only: permissions and device availability are checked on use. */
// eslint-disable-next-line react-refresh/only-export-components
export function getActionValidationMessage(action: DeckAction): string | null {
  switch (action.type) {
    case "status":
      return action.statusId ? null : "Elige un estado.";
    case "page":
      return action.pageId ? null : "Elige una página.";
    case "url": {
      try {
        const url = new URL(action.url.trim());
        if (
          (url.protocol === "https:" || url.protocol === "http:") &&
          action.url.trim().length <= 500
        )
          return null;
      } catch {
        // Keep partially edited addresses in the controlled value.
      }
      return "Escribe una dirección http:// o https:// válida.";
    }
    case "android-app":
      return action.packageName.length <= 200 &&
        /^[a-zA-Z][\w]*(?:\.[a-zA-Z][\w]*)+$/.test(action.packageName)
        ? null
        : "Elige una aplicación permitida.";
    case "rgb":
      if (!action.deviceId.trim() || action.deviceId.trim().length > 200) {
        return "Escribe el ID real de una luz descubierta y autorizada.";
      }
      if (
        action.command === "color" &&
        !/^#[0-9a-fA-F]{6}$/.test(action.color ?? "")
      ) {
        return "Elige un color RGB válido (#RRGGBB).";
      }
      if (
        action.command === "brightness" &&
        (action.brightness === undefined ||
          !Number.isFinite(action.brightness) ||
          action.brightness < 0 ||
          action.brightness > 100)
      )
        return "Indica un brillo entre 0 y 100 %.";
      if (action.command === "power" && typeof action.on !== "boolean") {
        return "Elige encender o apagar la luz.";
      }
      if (
        action.command === "scene" &&
        (!action.scene?.trim() || action.scene.trim().length > 100)
      )
        return "Escribe el ID de una escena compatible y autorizada.";
      return null;
    case "automation":
      if (action.steps.length < 1 || action.steps.length > MAX_STEPS) {
        return `Añade entre 1 y ${MAX_STEPS} pasos.`;
      }
      for (let index = 0; index < action.steps.length; index++) {
        const message = getActionValidationMessage(action.steps[index]);
        if (message) return `Paso ${index + 1}: ${message}`;
      }
      return null;
    case "off":
    case "display":
    case "media":
      return null;
  }
}

function ActionSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value}
        onValueChange={(next) => onChange(next as T)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Elige una opción" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AllowedAppSelector({
  packageName,
  onSelect,
  disabled,
}: {
  packageName: string;
  onSelect: (app: InstalledAndroidApp) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [apps, setApps] = useState<InstalledAndroidApp[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const android = isAndroidNative();

  useEffect(() => {
    if (!android) return;
    let active = true;
    nativeDeck.getInstalledApps().then(
      (installed) => {
        if (active) setApps(installed.filter((app) => app.allowed));
      },
      () => {
        if (active) setError("No se pudieron cargar las aplicaciones.");
      },
    );
    return () => {
      active = false;
    };
  }, [android]);

  if (!android) {
    return (
      <p className="text-sm text-muted-foreground">
        Elige las aplicaciones desde la APK de VISO Deck en Android.
        {packageName && " La aplicación guardada se conserva."}
      </p>
    );
  }

  const selected = apps?.find((app) => app.packageName === packageName);
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filtered = apps?.filter((app) =>
    app.name.toLocaleLowerCase().includes(normalizedSearch),
  );

  const manage = async () => {
    if (managing) return;
    setManaging(true);
    setError(null);
    try {
      await nativeDeck.configureAllowedApps();
      setApps(
        (await nativeDeck.getInstalledApps()).filter((app) => app.allowed),
      );
    } catch {
      setError("No se pudo actualizar la selección. Intenta de nuevo.");
    } finally {
      setManaging(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={id}>Buscar aplicaciones</Label>
        <Input
          id={id}
          value={search}
          disabled={disabled || managing}
          placeholder="Nombre de la aplicación"
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {!apps && !error && (
        <p role="status" className="text-sm text-muted-foreground">
          Cargando aplicaciones…
        </p>
      )}
      {error && (
        <p role="status" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {selected && (
        <p className="text-xs text-muted-foreground">
          Seleccionada: {selected.name}
        </p>
      )}
      {apps && packageName && !selected && (
        <p role="status" className="text-sm text-muted-foreground">
          La aplicación guardada ya no está instalada o permitida. Elige otra o
          revisa tu selección.
        </p>
      )}
      {apps && (
        <div className="max-h-60 space-y-1 overflow-y-auto overscroll-contain rounded-xl border p-1">
          {filtered?.map((app) => (
            <button
              key={app.packageName}
              type="button"
              aria-label={app.name}
              aria-pressed={packageName === app.packageName}
              disabled={disabled || managing}
              onClick={() => onSelect(app)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50",
                packageName === app.packageName && "bg-accent",
              )}
            >
              {app.icon ? (
                <img
                  src={app.icon}
                  alt=""
                  className="size-9 shrink-0 object-contain"
                />
              ) : (
                <Smartphone className="size-9 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate">{app.name}</span>
              {packageName === app.packageName && (
                <Check
                  className="size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
          {!filtered?.length && (
            <p className="p-3 text-sm text-muted-foreground">
              {apps.length
                ? "No hay aplicaciones con ese nombre."
                : "Elige qué aplicaciones permites abrir desde VISO."}
            </p>
          )}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || managing}
        onClick={() => void manage()}
      >
        {managing ? "Actualizando…" : "Administrar aplicaciones permitidas"}
      </Button>
    </div>
  );
}

function ActionFields({
  value,
  onChange,
  statuses,
  pages,
  disabled,
  onAppSelected,
}: Omit<ActionEditorProps, "value" | "onChange"> & {
  value: SimpleDeckAction;
  onChange: (value: SimpleDeckAction) => void;
}) {
  const id = useId();
  switch (value.type) {
    case "status":
      return statuses.length ? (
        <ActionSelect
          label="Estado"
          value={value.statusId}
          disabled={disabled}
          options={statuses.map((status) => ({
            value: status._id as Id<"statuses">,
            label: status.name,
          }))}
          onChange={(statusId) => onChange({ ...value, statusId })}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Crea un estado antes de elegir esta acción.
        </p>
      );
    case "page":
      return pages.length ? (
        <ActionSelect
          label="Página de destino"
          value={value.pageId}
          disabled={disabled}
          options={pages.map((page) => ({
            value: page._id as Id<"deckPages">,
            label: page.name,
          }))}
          onChange={(pageId) => onChange({ ...value, pageId })}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Crea una página de destino primero.
        </p>
      );
    case "url":
      return (
        <div className="space-y-2">
          <Label htmlFor={id}>Dirección web</Label>
          <Input
            id={id}
            disabled={disabled}
            value={value.url}
            maxLength={500}
            placeholder="https://example.com"
            onChange={(event) =>
              onChange({ ...value, url: event.target.value })
            }
          />
        </div>
      );
    case "android-app":
      return (
        <AllowedAppSelector
          packageName={value.packageName}
          disabled={disabled}
          onSelect={(app) => {
            onChange({ ...value, packageName: app.packageName });
            onAppSelected?.(app);
          }}
        />
      );
    case "media":
      return (
        <div className="space-y-2">
          <ActionSelect
            label="Control multimedia"
            value={value.command}
            options={choices(MEDIA_LABELS)}
            disabled={disabled}
            onChange={(command) => onChange({ ...value, command })}
          />
          <p className="text-xs text-muted-foreground">
            {value.command === "play-pause" ||
            value.command === "next" ||
            value.command === "previous"
              ? "Requiere Android, permiso de acceso multimedia y una sesión de reproducción activa."
              : "Controla el volumen multimedia del dispositivo Android. Requiere la aplicación VISO Deck."}
          </p>
        </div>
      );
    case "rgb":
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Requiere una integración conectada y una luz real descubierta y
            autorizada. Copia su ID desde la configuración de luces; escribir un
            ID no autoriza el dispositivo.
          </p>
          <div className="space-y-2">
            <Label htmlFor={`${id}-device`}>ID de la luz autorizada</Label>
            <Input
              id={`${id}-device`}
              value={value.deviceId}
              disabled={disabled}
              maxLength={200}
              placeholder="light.salon"
              onChange={(event) =>
                onChange({ ...value, deviceId: event.target.value })
              }
            />
          </div>
          <ActionSelect
            label="Acción de la luz"
            value={value.command}
            options={choices(RGB_LABELS)}
            disabled={disabled}
            onChange={(command) =>
              onChange({
                type: "rgb",
                command,
                deviceId: value.deviceId,
                ...(command === "color" ? { color: "#ffffff" } : {}),
                ...(command === "brightness" ? { brightness: 100 } : {}),
                ...(command === "power" ? { on: true } : {}),
                ...(command === "scene" ? { scene: "" } : {}),
              })
            }
          />
          {value.command === "color" && (
            <div className="space-y-2">
              <Label htmlFor={`${id}-color`}>Color RGB (#RRGGBB)</Label>
              <Input
                id={`${id}-color`}
                value={value.color ?? ""}
                maxLength={7}
                disabled={disabled}
                placeholder="#ffffff"
                onChange={(event) =>
                  onChange({ ...value, color: event.target.value })
                }
              />
            </div>
          )}
          {value.command === "brightness" && (
            <div className="space-y-2">
              <Label htmlFor={`${id}-brightness`}>Brillo (%)</Label>
              <Input
                id={`${id}-brightness`}
                type="number"
                min={0}
                max={100}
                value={value.brightness ?? ""}
                disabled={disabled}
                onChange={(event) => {
                  if (event.target.value === "") {
                    const { brightness: _brightness, ...withoutBrightness } =
                      value;
                    onChange(withoutBrightness);
                  } else
                    onChange({
                      ...value,
                      brightness: Number(event.target.value),
                    });
                }}
              />
            </div>
          )}
          {value.command === "power" && (
            <ActionSelect
              label="Encendido"
              value={value.on === undefined ? "" : value.on ? "on" : "off"}
              options={[
                { value: "on", label: "Encender" },
                { value: "off", label: "Apagar" },
              ]}
              disabled={disabled}
              onChange={(state) => onChange({ ...value, on: state === "on" })}
            />
          )}
          {value.command === "scene" && (
            <div className="space-y-2">
              <Label htmlFor={`${id}-scene`}>ID de la escena autorizada</Label>
              <Input
                id={`${id}-scene`}
                value={value.scene ?? ""}
                maxLength={100}
                disabled={disabled}
                onChange={(event) =>
                  onChange({ ...value, scene: event.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Las escenas requieren un proveedor que admita esta acción.
              </p>
            </div>
          )}
        </div>
      );
    case "display":
      return (
        <p className="text-xs text-muted-foreground">
          Abre tu Display público.
        </p>
      );
    case "off":
      return (
        <p className="text-xs text-muted-foreground">
          Desactiva el estado actual.
        </p>
      );
  }
}

export function ActionEditor({
  value,
  onChange,
  statuses,
  pages,
  disabled,
  onAppSelected,
}: ActionEditorProps) {
  const message = getActionValidationMessage(value);
  const simpleOptions = choices(ACTION_LABELS).filter(
    (option) => option.value !== "automation",
  ) as { value: SimpleDeckAction["type"]; label: string }[];
  const updateStep = (index: number, next: SimpleDeckAction) => {
    if (value.type !== "automation") return;
    onChange({
      ...value,
      steps: value.steps.map((step, position) =>
        position === index ? next : step,
      ),
    });
  };
  const moveStep = (index: number, direction: -1 | 1) => {
    if (value.type !== "automation") return;
    const destination = index + direction;
    if (destination < 0 || destination >= value.steps.length) return;
    const steps = [...value.steps];
    [steps[index], steps[destination]] = [steps[destination], steps[index]];
    onChange({ ...value, steps });
  };

  return (
    <div className="space-y-3">
      <ActionSelect
        label="Acción"
        value={value.type}
        options={choices(ACTION_LABELS)}
        disabled={disabled}
        onChange={(type) =>
          onChange(
            type === "automation"
              ? { type, steps: [] }
              : createSimpleAction(type, statuses, pages),
          )
        }
      />
      {value.type === "automation" ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Los pasos se ejecutan en orden. La automatización se detiene si un
            paso falla.
          </p>
          {value.steps.map((step, index) => (
            <div key={index} className="space-y-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-1">
                <p className="mr-auto text-sm font-medium">Paso {index + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Subir paso ${index + 1}`}
                  disabled={disabled || index === 0}
                  onClick={() => moveStep(index, -1)}
                >
                  Subir
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Bajar paso ${index + 1}`}
                  disabled={disabled || index === value.steps.length - 1}
                  onClick={() => moveStep(index, 1)}
                >
                  Bajar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Quitar paso ${index + 1}`}
                  disabled={disabled}
                  onClick={() =>
                    onChange({
                      ...value,
                      steps: value.steps.filter(
                        (_, position) => position !== index,
                      ),
                    })
                  }
                >
                  Quitar
                </Button>
              </div>
              <ActionSelect
                label={`Acción del paso ${index + 1}`}
                value={step.type}
                options={simpleOptions}
                disabled={disabled}
                onChange={(type) =>
                  updateStep(index, createSimpleAction(type, statuses, pages))
                }
              />
              <ActionFields
                value={step}
                onChange={(next) => updateStep(index, next)}
                statuses={statuses}
                pages={pages}
                disabled={disabled}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={disabled || value.steps.length >= MAX_STEPS}
            onClick={() =>
              onChange({ ...value, steps: [...value.steps, { type: "off" }] })
            }
          >
            Añadir paso ({value.steps.length}/{MAX_STEPS})
          </Button>
        </div>
      ) : (
        <ActionFields
          value={value}
          onChange={onChange}
          statuses={statuses}
          pages={pages}
          disabled={disabled}
          onAppSelected={onAppSelected}
        />
      )}
      {message && (
        <p role="status" className="text-xs text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}

export default ActionEditor;
