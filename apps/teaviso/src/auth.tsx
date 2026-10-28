import { useEffect, useRef, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Brand } from "./ui-v2";
import { useLocation } from "react-router-dom";
import {
  rememberSignInDestination,
  clearSignInDestination,
} from "./signin-destination";
import { isTeavisoAndroid } from "./native-app";
import { useNativeGoogleAuth } from "@/lib/native-google-auth-context";

export default function Auth() {
  const { signIn } = useAuthActions();
  const location = useLocation();
  const native = isTeavisoAndroid();
  const nativeGoogle = useNativeGoogleAuth();
  const config = useQuery(api.teaviso.configuration, {
    origin: window.location.origin,
  });
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const googleAvailable = native ? !!config?.androidGoogle : !!config?.google;
  const working = pending || (native && nativeGoogle.pending);
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
    clearSignInDestination();
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
    if (busy.current || !googleAvailable) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      rememberSignInDestination(location.pathname, location.search);
      if (native) {
        await nativeGoogle.start("signin");
        busy.current = false;
        setPending(false);
        return;
      }
      const result = await signIn("google", {
        redirectTo: `${window.location.origin}/panel?google=return`,
      });
      if (!result.redirect) throw new Error();
    } catch {
      clearSignInDestination();
      setError(
        "No pudimos abrir Google. Probá nuevamente o ingresá con correo y contraseña.",
      );
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <main className="tea-auth pc-auth">
      <header className="pc-auth-header">
        <Brand />
      </header>
      <div className="pc-auth-layout">
        <aside className="pc-auth-visual">
          <span className="pc-auth-halo" aria-hidden="true" />
          <p className="pc-eyebrow">Tu lugar, conectado</p>
          <h2>
            Estés donde estés,
            <br />
            Te Aviso.
          </h2>
          <p>Tu puerta, tus visitas y tus turnos en un mismo lugar.</p>
          <img
            src="/images/cartel-instalado.png"
            alt="Ejemplo ilustrativo de un cartel Te Aviso junto a una puerta"
          />
        </aside>
        <section className="tea-card">
          <span className="eyebrow">TU PUERTA, CONECTADA</span>
          <h1>{flow === "signUp" ? "Creá tu cuenta" : "Bienvenido."}</h1>
          <p>
            Ingresá a Te Aviso para configurar tus timbres, recibir visitas y
            gestionar tus reservas.
          </p>
          {googleAvailable && (
            <>
              <button
                className="tea-secondary"
                disabled={working || (native && !nativeGoogle.ready)}
                onClick={() => void google()}
              >
                Continuar con Google
              </button>
              <p className="tea-muted">o con tu correo</p>
            </>
          )}
          <form onSubmit={submit}>
            <fieldset disabled={working}>
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
                {working
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
            disabled={working}
            onClick={() => {
              setFlow(flow === "signIn" ? "signUp" : "signIn");
              setError("");
            }}
          >
            {flow === "signIn" ? "Crear una cuenta" : "Ya tengo una cuenta"}
          </button>
          {native && nativeGoogle.pending && (
            <button
              className="tea-link-button"
              onClick={() => {
                clearSignInDestination();
                void nativeGoogle.cancel();
              }}
            >
              Cancelar acceso con Google
            </button>
          )}
          <small>
            El registro no contrata servicios pagos. Elegí cómo recibir desde tu
            panel.
          </small>
        </section>
      </div>
    </main>
  );
}
