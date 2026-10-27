import { useEffect, useRef, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router-dom";

export default function Auth() {
  const { signIn } = useAuthActions();
  const config = useQuery(api.teaviso.configuration, {
    origin: window.location.origin,
  });
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) {
        busy.current = false;
        setPending(false);
      }
    };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current) return;
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email")).trim().toLowerCase();
    const password = String(form.get("password"));
    if (flow === "signUp" && password.length < 8) {
      setError("Usá al menos 8 caracteres.");
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await signIn("password", { email, password, flow });
    } catch {
      setError(
        flow === "signUp"
          ? "No pudimos crear la cuenta. Si este correo ya está registrado, probá ingresar."
          : "No pudimos ingresar. Revisá tu correo y contraseña.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function google() {
    if (busy.current || !config?.google) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await signIn("google", {
        redirectTo: `${window.location.origin}/panel?google=return`,
      });
      if (!result.redirect) throw new Error();
    } catch {
      setError(
        "No pudimos abrir Google. Probá nuevamente o ingresá con correo y contraseña.",
      );
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <main className="tea-auth">
      <Link className="brand" to="/">
        <span className="tea-original-symbol" aria-hidden="true">
          <img src="/brand/viso-logo.png" alt="" />
        </span>
        Te Aviso
      </Link>
      <section className="tea-card">
        <span className="eyebrow">TU PUERTA, CONECTADA</span>
        <h1>{flow === "signUp" ? "Creá tu cuenta" : "Qué bueno verte."}</h1>
        <p>
          Ingresá a Te Aviso para configurar tus timbres, recibir visitas y
          gestionar tus reservas.
        </p>
        {config?.google && (
          <>
            <button
              className="tea-secondary"
              disabled={pending}
              onClick={() => void google()}
            >
              Continuar con Google
            </button>
            <p className="tea-muted">o con tu correo</p>
          </>
        )}
        <form onSubmit={submit}>
          <fieldset disabled={pending}>
            <label>
              Correo electrónico
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
              />
            </label>
            <label>
              Contraseña
              <input
                name="password"
                type="password"
                autoComplete={
                  flow === "signUp" ? "new-password" : "current-password"
                }
                minLength={flow === "signUp" ? 8 : 1}
                maxLength={256}
                required
              />
            </label>
            <button className="button" type="submit">
              {pending
                ? "Procesando…"
                : flow === "signUp"
                  ? "Crear cuenta"
                  : "Ingresar"}
            </button>
          </fieldset>
        </form>
        {error && <p role="alert">{error}</p>}
        <button
          className="tea-link-button"
          disabled={pending}
          onClick={() => {
            setFlow(flow === "signIn" ? "signUp" : "signIn");
            setError("");
          }}
        >
          {flow === "signIn" ? "Crear una cuenta" : "Ya tengo una cuenta"}
        </button>
        <small>
          El registro no contrata servicios pagos. Elegí cómo recibir desde tu
          panel.
        </small>
      </section>
    </main>
  );
}
