import { useEffect, useRef, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex } from "convex/react";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { isAndroidNative } from "@/lib/android-native";
import {
  beginGoogleAuthAttempt,
  clearGoogleAuthAttempt,
  type GoogleAuthMode,
} from "@/lib/google-auth-flow";
import { Button } from "@/components/ui/button";
import { useNativeGoogleAuth } from "@/lib/native-google-auth-context";

interface GoogleSignInButtonProps {
  mode?: GoogleAuthMode;
  disabled?: boolean;
  withEmailSeparator?: boolean;
  onPendingChange?: (pending: boolean) => void;
  onError?: (message: string | null) => void;
}

export function GoogleSignInButton({
  mode = "signin",
  disabled = false,
  withEmailSeparator = false,
  onPendingChange,
  onError,
}: GoogleSignInButtonProps) {
  const convex = useConvex();
  const { signIn } = useAuthActions();
  const [available, setAvailable] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const native = isAndroidNative();
  const preview = !native && import.meta.env.VITE_ANDROID_PREVIEW === "true";
  const nativeAuth = useNativeGoogleAuth();
  const waiting = pending || (native && nativeAuth.pending);

  useEffect(() => {
    if (native) onPendingChange?.(waiting);
  }, [native, waiting, onPendingChange]);

  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    // An older/unavailable server must never break password sign-in.
    void convex.query(api.social_auth.availability, {}).then(
      (value) => {
        if (!cancelled)
          setAvailable(
            native ? value.nativeGoogle === true : value.google === true,
          );
      },
      () => {
        if (!cancelled) setAvailable(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [convex, native, preview]);

  useEffect(() => {
    if (native) return;
    const restore = (event: PageTransitionEvent) => {
      // Browser Back can restore the pre-redirect page from BFCache with its
      // in-flight UI intact. It must be usable again without a page reload.
      if (!event.persisted || !busy.current) return;
      busy.current = false;
      setPending(false);
      setError(null);
      clearGoogleAuthAttempt();
      onError?.(null);
      onPendingChange?.(false);
    };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, [native, onError, onPendingChange]);

  const start = async () => {
    if (disabled || busy.current || !available || waiting) return;
    busy.current = true;
    setPending(true);
    setError(null);
    onError?.(null);
    onPendingChange?.(true);
    try {
      if (native) {
        await nativeAuth.start(mode);
        busy.current = false;
        setPending(false);
        return;
      }
      if (mode === "link") {
        await convex.mutation(api.social_auth.prepareGoogleLink, {});
      }
      beginGoogleAuthAttempt(mode);
      const result = await signIn("google", { redirectTo: "/?google=return" });
      if (!result.redirect) throw new Error("Google did not return a redirect");
      // Convex Auth stores its verifier and navigates. Keep controls locked until
      // that navigation rather than allowing a second attempt to replace it.
    } catch {
      clearGoogleAuthAttempt();
      const message =
        mode === "link"
          ? "No pudimos abrir Google para vincular tu cuenta. Intentá de nuevo."
          : "No pudimos iniciar Google. Intentá de nuevo o usá tu correo y contraseña.";
      setError(message);
      onError?.(message);
      busy.current = false;
      setPending(false);
      onPendingChange?.(false);
    }
  };

  if (!available || preview) return null;

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={disabled || waiting || (native && !nativeAuth.ready)}
        aria-busy={waiting}
        onClick={() => void start()}
      >
        {waiting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.31 2.98-7.36Z"
            />
            <path
              fill="#34A853"
              d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.23-2.51c-.9.6-2.05.97-3.39.97-2.6 0-4.81-1.76-5.6-4.14H3.06v2.59A10 10 0 0 0 12 22Z"
            />
            <path
              fill="#FBBC05"
              d="M6.4 13.91A6 6 0 0 1 6.09 12c0-.66.11-1.31.31-1.91V7.5H3.06A10 10 0 0 0 2 12c0 1.62.39 3.15 1.06 4.5l3.34-2.59Z"
            />
            <path
              fill="#EA4335"
              d="M12 5.95c1.47 0 2.78.5 3.82 1.49l2.87-2.87A9.61 9.61 0 0 0 12 2a10 10 0 0 0-8.94 5.5l3.34 2.59c.79-2.38 3-4.14 5.6-4.14Z"
            />
          </svg>
        )}
        {waiting
          ? "Abriendo Google…"
          : mode === "link"
            ? "Vincular Google"
            : "Continuar con Google"}
      </Button>
      {native && nativeAuth.pending && (
        <div className="space-y-2 text-center text-xs text-muted-foreground">
          <p>Completá el acceso en Google para volver a tu cuenta VISO.</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              void nativeAuth
                .cancel()
                .catch(() =>
                  setError("No pudimos cancelar. Cerrá y volvé a abrir VISO."),
                )
            }
          >
            Cancelar acceso Google
          </Button>
        </div>
      )}
      {error && !onError && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {withEmailSeparator && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" aria-hidden="true" />
          <span>o con tu correo</span>
          <span className="h-px flex-1 bg-border" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
