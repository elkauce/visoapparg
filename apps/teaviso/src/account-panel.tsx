import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { BellRing, Save, Link2 } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { Link } from "react-router-dom";
import { api } from "@/convex/_generated/api";
import { Feedback, Loading } from "./ui-v2";
import { useTask } from "./use-teaviso-task";

type Profile = NonNullable<
  FunctionReturnType<typeof api.teaviso_accounts.profile>
>;

export default function AccountPanel() {
  const profile = useQuery(api.teaviso_accounts.profile, {});
  if (!profile?.enrolled) return <Loading />;
  return (
    <div className="av-stack">
      <header className="av-panel-heading">
        <div>
          <span className="av-eyebrow">Tu perfil en Te Aviso</span>
          <h1>Mi cuenta</h1>
          <p>Administrá tus datos y tus timbres desde acá.</p>
        </div>
      </header>
      <ProfileForm key={profile.updatedAt} profile={profile} />
      <section className="av-card av-stack">
        <h2>
          <BellRing size={22} /> Tus timbres
        </h2>
        <p>
          Los QR, integrantes, llamadas y reservas se administran en tu panel Te
          Aviso.
        </p>
        <Link className="av-button av-outline" to="/panel/timbres">
          Administrar mis timbres
        </Link>
      </section>
      {profile.canLinkDeck && (
        <section className="av-card av-stack">
          <h2>
            <Link2 size={22} /> Tu Deck VISO
          </h2>
          <p>
            Tu cuenta tiene un Deck o hardware VISO compatible. Podés mantenerlo
            vinculado a tus timbres.
          </p>
          {profile.deckLinked && (
            <a
              className="av-button av-outline"
              href="https://viso-deck-android.vercel.app/deck"
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir mi Deck VISO ↗
            </a>
          )}
        </section>
      )}
      <section className="av-card av-stack">
        <h2>Recibir llamadas</h2>
        <p>
          Permití cámara y micrófono cuando vayas a atender. Con la web abierta
          recibís las llamadas de tus timbres acá.
        </p>
        <p>
          La recepción en segundo plano del celular utiliza la APK compatible y
          sus permisos. Una app propia Te Aviso todavía está pendiente.
        </p>
        <Link to="/panel/llamadas">Configurar recepción y notificaciones</Link>
      </section>
      <Link to="/privacidad">Privacidad y uso</Link>
    </div>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const save = useMutation(api.teaviso_accounts.saveProfile),
    task = useTask();
  const [name, setName] = useState(profile.name),
    [phone, setPhone] = useState(profile.contactPhone),
    [deck, setDeck] = useState(profile.deckLinked);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void task.run(
      () =>
        save({
          name,
          contactPhone: phone,
          expectedUpdatedAt: profile.updatedAt,
          ...(profile.canLinkDeck ? { deckLinked: deck } : {}),
        }),
      "Tus datos se guardaron en Te Aviso.",
    );
  };
  return (
    <form className="av-card av-form" onSubmit={submit}>
      <h2>Mis datos</h2>
      <fieldset disabled={task.busy}>
        <label>
          Nombre
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </label>
        <label>
          Correo electrónico
          <input
            type="email"
            value={profile.email ?? ""}
            readOnly
            autoComplete="email"
          />
        </label>
        <p className="av-muted">
          Este es el correo que usás para ingresar. Tus timbres siguen asociados
          a esta cuenta.
        </p>
        <label>
          Teléfono de contacto
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            placeholder="Código de país y número"
          />
        </label>
        {profile.canLinkDeck && (
          <label className="av-checkbox">
            <input
              type="checkbox"
              checked={deck}
              onChange={(e) => setDeck(e.target.checked)}
            />{" "}
            Vincular mi Deck VISO y mostrar su acceso en el menú
          </label>
        )}
        <button className="av-button" type="submit">
          <Save size={17} />
          {task.busy ? "Guardando…" : "Guardar mis datos"}
        </button>
      </fieldset>
      <Feedback task={task} />
    </form>
  );
}
