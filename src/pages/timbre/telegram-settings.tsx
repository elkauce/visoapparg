import { useId, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { timbreTelegramUrl } from "@/convex/lib/timbre_telegram";
import { Button } from "@/components/ui/button";

type TelegramContactSettingsProps = {
  siteId: Id<"timbreSites">;
  unitId?: Id<"timbreUnits">;
  username?: string;
  canEnable: boolean;
};

export default function TelegramContactSettings(
  props: TelegramContactSettingsProps,
) {
  return (
    <TelegramContactForm
      key={`${props.siteId}:${props.unitId ?? "site"}`}
      {...props}
    />
  );
}

function TelegramContactForm({
  siteId,
  unitId,
  username,
  canEnable,
}: TelegramContactSettingsProps) {
  const save = useMutation(api.timbre_telegram.saveContact);
  const inputId = useId();
  const [draft, setDraft] = useState<string>();
  const [confirmedValue, setConfirmedValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // Live account updates are reflected while idle. An unsaved edit stays local
  // even when another device updates this site's settings.
  const value = draft ?? username ?? "";
  const profileUrl = timbreTelegramUrl(value);
  const confirmed = confirmedValue === value;
  const canSave = canEnable && !!value.trim() && confirmed && !busy;

  const persist = async (next: string | null) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await save({ siteId, ...(unitId ? { unitId } : {}), username: next });
      setDraft(undefined);
      setConfirmedValue(null);
      setSuccess(
        next === null
          ? "Telegram quitado de este contacto."
          : "Telegram guardado. El visitante podrá abrir este perfil desde el QR.",
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "No se pudo guardar Telegram. Intentá de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSave) void persist(value.trim());
  };

  return (
    <div className="vt-stack">
      <p>
        El visitante abre el perfil y toca Llamar o Videollamada. Ambos
        necesitan Telegram.
      </p>
      <form className="vt-form" onSubmit={submit}>
        <label htmlFor={inputId}>Usuario de Telegram</label>
        <input
          id={inputId}
          value={value}
          onChange={(event) => {
            setDraft(event.target.value);
            setError("");
            setSuccess("");
          }}
          placeholder="@tu_usuario o https://t.me/tu_usuario"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={160}
          disabled={busy || !canEnable}
        />
        {profileUrl && !busy && (
          <Button variant="outline" asChild>
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
            >
              Comprobar perfil
            </a>
          </Button>
        )}
        <p className="vt-caption">
          Comprobá que el enlace abra el perfil correcto antes de publicarlo.
        </p>
        <label className="vt-toggle vt-telegram-consent">
          <span>
            Confirmo que el perfil es correcto y tengo permiso para mostrar su
            usuario a quienes escaneen el QR.
          </span>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) =>
              setConfirmedValue(event.target.checked ? value : null)
            }
            disabled={busy || !canEnable || !value.trim()}
          />
        </label>
        <Button type="submit" disabled={!canSave}>
          {busy ? "Guardando…" : "Guardar Telegram"}
        </Button>
      </form>
      {username && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void persist(null)}
        >
          Quitar Telegram
        </Button>
      )}
      {!canEnable && (
        <p className="vt-caption">
          Para habilitar Telegram necesitás una licencia con llamadas y, en
          unidades, que estén habilitadas. Podés quitar un usuario guardado en
          cualquier momento.
        </p>
      )}
      {error && (
        <p className="vt-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="vt-success" role="status">
          {success}
        </p>
      )}
      <details className="vt-details">
        <summary>Preparar Telegram para recibir visitas</summary>
        <p>
          En Telegram, abrí Ajustes → Privacidad y seguridad. En Número de
          teléfono, elegí Nadie y revisá las excepciones. En Llamadas, elegí
          Todos para que puedan llamar visitantes que no tenés en tus contactos.
        </p>
        <p>
          Usá un perfil de persona, no un bot, grupo o canal. Las personas que
          ya conocen y tienen guardado el número pueden seguir viéndolo según
          tus ajustes de Telegram.
        </p>
        <p>
          Quitar Telegram oculta el enlace del QR. Quien ya guardó el usuario
          puede seguir contactándote desde Telegram, incluso si silenciás el
          Timbre o cambiás sus horarios en VISO.
        </p>
      </details>
      <p className="vt-caption">
        Las llamadas por Telegram se atienden allí y no actualizan
        automáticamente el historial, los estados ni las luces de VISO.
      </p>
    </div>
  );
}
