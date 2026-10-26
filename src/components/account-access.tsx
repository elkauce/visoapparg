import { useCallback, useId, useRef, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "./ui/button";
import { GoogleSignInButton } from "./google-sign-in";

/** Native home uses the same providers and account as existing VISO sign-in. */
export default function AccountAccess() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const id = useId();
  const signingUp = flow === "signUp";
  const googlePending = useCallback((next: boolean) => {
    busy.current = next;
    setPending(next);
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current) return;
    const input = e.currentTarget.elements.namedItem(
      "email",
    ) as HTMLInputElement;
    const normalized = email.trim().toLowerCase();
    if (!normalized || input.validity.typeMismatch) {
      setError("Ingresá un correo electrónico válido.");
      input.focus();
      return;
    }
    if (!password || (signingUp && password.length < 8)) {
      setError(
        signingUp ? "Usá al menos 8 caracteres." : "Ingresá tu contraseña.",
      );
      return;
    }
    if (signingUp && confirmation !== password) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await signIn("password", { email: normalized, password, flow });
      setPassword("");
      setConfirmation("");
    } catch {
      setError(
        signingUp
          ? "No pudimos crear la cuenta. Si ya usás VISO, ingresá con tu cuenta existente."
          : "No pudimos ingresar. Revisá tu correo y contraseña.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <section
      className="viso-app-auth-card"
      aria-label={signingUp ? "Crear cuenta VISO" : "Ingresar a VISO"}
    >
      <h2>{signingUp ? "Creá tu cuenta" : "Ingresá a VISO"}</h2>
      <GoogleSignInButton
        withEmailSeparator
        disabled={pending}
        onPendingChange={googlePending}
        onError={setError}
      />
      <form onSubmit={submit} noValidate aria-busy={pending}>
        <fieldset disabled={pending}>
          <label htmlFor={`${id}-email`}>Correo electrónico</label>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={254}
            placeholder="tu@correo.com"
          />
          <label htmlFor={`${id}-password`}>Contraseña</label>
          <div className="viso-app-password">
            <input
              id={`${id}-password`}
              type={showPassword ? "text" : "password"}
              autoComplete={signingUp ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={signingUp ? 8 : 1}
            />
            <button
              type="button"
              aria-label={
                showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              aria-pressed={showPassword}
              onClick={() => setShowPassword((x) => !x)}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </button>
          </div>
          {signingUp && (
            <>
              <p className="viso-app-help">Usá al menos 8 caracteres.</p>
              <label htmlFor={`${id}-confirm`}>Confirmá tu contraseña</label>
              <input
                id={`${id}-confirm`}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                required
              />
            </>
          )}
          {error && <p role="alert">{error}</p>}
          <Button type="submit" className="w-full">
            {pending ? "Procesando…" : signingUp ? "Crear cuenta" : "Ingresar"}
          </Button>
        </fieldset>
      </form>
      <button
        className="viso-app-auth-switch"
        disabled={pending}
        onClick={() => {
          setFlow(signingUp ? "signIn" : "signUp");
          setError(null);
          setPassword("");
          setConfirmation("");
        }}
      >
        {signingUp ? "Ya tengo una cuenta" : "Crear una cuenta"}
      </button>
    </section>
  );
}
