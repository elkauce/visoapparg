import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { App as NativeApp } from "@capacitor/app";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex, useConvexAuth } from "convex/react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  actions,
  isAndroidNative,
  secureTokenStorage,
} from "@/lib/android-native";
import type { GoogleAuthMode } from "@/lib/google-auth-flow";
import { NativeGoogleContext } from "@/lib/native-google-auth-context";
import {
  createNativeGoogleNonce,
  nativeGoogleRedirect,
  nativeGoogleVerifierKey,
  NATIVE_GOOGLE_ATTEMPT_KEY,
  parseNativeGoogleCallback,
  readNativeGoogleAttempt,
  type NativeGoogleAttempt,
} from "@/lib/native-google-auth";

const CALLBACK_KEY = "viso:native-google-callback";
const FAILURE =
  "No pudimos completar Google. Si ya tenés VISO, entrá con tu contraseña y vinculá Google desde Cuenta.";

/**
 * Google runs in the system browser. Only a bound, single-use code returns to
 * the WebView. Convex Auth remains the sole issuer and owner of login tokens.
 */
export function NativeGoogleAuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const convex = useConvex();
  const { signIn } = useAuthActions();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const [callback, setCallback] = useState<{
    attempt: NativeGoogleAttempt;
    code: string | null;
  } | null>(null);
  const attemptRef = useRef<NativeGoogleAttempt | null>(null);
  const starting = useRef(false);
  const processing = useRef(false);
  const clearing = useRef(false);
  const received = useRef<string | null>(null);
  const verifierKey = nativeGoogleVerifierKey(convex.url);

  const clear = useCallback(async () => {
    if (clearing.current) return;
    clearing.current = true;
    try {
      const results = await Promise.allSettled([
        secureTokenStorage.removeItem(NATIVE_GOOGLE_ATTEMPT_KEY),
        secureTokenStorage.removeItem(CALLBACK_KEY),
        secureTokenStorage.removeItem(verifierKey),
      ]);
      if (results.some((result) => result.status === "rejected"))
        throw new Error("No se pudo limpiar el acceso Google.");
    } finally {
      attemptRef.current = null;
      setPending(false);
      setCallback(null);
      received.current = null;
      clearing.current = false;
    }
  }, [verifierKey]);

  const cancel = useCallback(async () => {
    // Once code redemption starts, it must finish before changing the session.
    if (processing.current || starting.current || clearing.current) return;
    await clear();
  }, [clear]);

  const start = useCallback(
    async (mode: GoogleAuthMode) => {
      if (
        !isAndroidNative() ||
        !ready ||
        isLoading ||
        starting.current ||
        processing.current ||
        clearing.current
      )
        throw new Error("Esperá un momento y volvé a intentarlo.");
      if (attemptRef.current)
        throw new Error("Terminá o cancelá el acceso Google anterior.");
      if ((mode === "link") !== isAuthenticated)
        throw new Error("Volvé a abrir el acceso de tu cuenta.");
      starting.current = true;
      setPending(true);
      try {
        if (mode === "link")
          await convex.mutation(api.social_auth.prepareGoogleLink, {});
        const nonce = createNativeGoogleNonce();
        const redirectTo = nativeGoogleRedirect(nonce);
        // SDK 0.0.96 redirects window.location on Capacitor. Start only this leg
        // with its public action, then redeem through SDK signIn below.
        const result = await convex.action(api.auth.signIn, {
          provider: "google",
          params: { redirectTo },
        });
        if (
          typeof result.redirect !== "string" ||
          typeof result.verifier !== "string" ||
          /\s/u.test(result.verifier) ||
          !/^[a-zA-Z0-9_-]{16,256}$/.test(result.verifier)
        )
          throw new Error("Google no está disponible en este servidor.");
        const url = new URL(result.redirect);
        const site = new URL(import.meta.env.VITE_CONVEX_SITE_URL);
        if (
          url.origin !== site.origin ||
          url.pathname !== "/api/auth/signin/google" ||
          url.username ||
          url.password ||
          url.hash ||
          url.searchParams.get("code") !== result.verifier ||
          url.searchParams.get("redirectTo") !== redirectTo
        )
          throw new Error("La dirección de acceso Google no es válida.");
        const attempt: NativeGoogleAttempt = {
          mode,
          nonce,
          startedAt: Date.now(),
          returnPath: location.pathname,
          verifier: result.verifier,
        };
        // Persist before leaving the app, including across Android process death.
        await secureTokenStorage.removeItem(CALLBACK_KEY);
        await secureTokenStorage.setItem(
          NATIVE_GOOGLE_ATTEMPT_KEY,
          JSON.stringify(attempt),
        );
        attemptRef.current = attempt;
        received.current = null;
        setPending(true);
        await actions.openUrl(url.toString());
      } catch {
        await clear().catch(() => undefined);
        throw new Error(
          "No pudimos abrir Google. Intentá de nuevo o usá tu contraseña.",
        );
      } finally {
        starting.current = false;
      }
    },
    [clear, convex, isAuthenticated, isLoading, location.pathname, ready],
  );

  useEffect(() => {
    if (!isAndroidNative()) return;
    let alive = true;
    const handleUrl = async (value: string) => {
      const parsed = parseNativeGoogleCallback(value);
      if (!parsed || processing.current || clearing.current) return;
      const attempt = await readNativeGoogleAttempt(secureTokenStorage);
      // An unrelated Intent must not cancel or replace the active attempt.
      if (
        !alive ||
        !attempt ||
        parsed.nonce !== attempt.nonce ||
        processing.current ||
        clearing.current ||
        received.current === attempt.nonce
      )
        return;
      received.current = attempt.nonce;
      attemptRef.current = attempt;
      await secureTokenStorage.setItem(CALLBACK_KEY, value);
      if (
        !alive ||
        clearing.current ||
        attemptRef.current?.nonce !== attempt.nonce
      )
        return;
      setPending(true);
      setCallback({ attempt, code: parsed.code });
    };
    const listener = NativeApp.addListener("appUrlOpen", ({ url }) => {
      void handleUrl(url).catch(() => toast.error(FAILURE));
    });
    void (async () => {
      const attempt = await readNativeGoogleAttempt(secureTokenStorage);
      if (!alive) return;
      if (!attempt) {
        await clear();
        if (alive) setReady(true);
        return;
      }
      attemptRef.current = attempt;
      setPending(true);
      const savedCallback = await secureTokenStorage.getItem(CALLBACK_KEY);
      if (savedCallback) await handleUrl(savedCallback);
      const launch = await NativeApp.getLaunchUrl();
      if (launch?.url) await handleUrl(launch.url);
      if (alive) setReady(true);
    })().catch(() => {
      if (alive) {
        setReady(true);
        toast.error(
          "No pudimos recuperar el acceso Google. Podés volver a intentarlo.",
        );
      }
    });
    return () => {
      alive = false;
      void listener.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [clear]);

  useEffect(() => {
    if (!callback || isLoading || processing.current) return;
    processing.current = true;
    void (async () => {
      try {
        const fresh = await readNativeGoogleAttempt(secureTokenStorage);
        if (!fresh || fresh.nonce !== callback.attempt.nonce)
          throw new Error("Expired Google attempt");
        if (!callback.code) throw new Error("Google was cancelled");
        if ((fresh.mode === "link") !== isAuthenticated)
          throw new Error("The VISO session changed");
        if (fresh.mode === "link" && !/^[a-f0-9]{64}$/.test(callback.code))
          throw new Error("Invalid Google linking code");
        // Pinned SDK verifier key. Tokens are neither created nor injected here.
        await secureTokenStorage.setItem(verifierKey, fresh.verifier);
        const redeem = signIn as (
          provider: string | undefined,
          params: Parameters<typeof signIn>[1],
        ) => ReturnType<typeof signIn>;
        const result = await redeem(undefined, { code: callback.code });
        if (!result.signingIn) throw new Error("Google sign-in incomplete");
        if (fresh.mode === "link") {
          const connection = await convex.query(api.social_auth.connection, {});
          if (!connection.linked) throw new Error("Google link incomplete");
        }
        toast.success(
          fresh.mode === "link"
            ? "Google vinculado. Tu deck y tus dispositivos se conservan."
            : "Entraste con Google a tu cuenta VISO.",
        );
        window.dispatchEvent(new Event("viso:google-account-changed"));
        navigate(fresh.returnPath, { replace: true });
      } catch {
        toast.error(FAILURE);
      } finally {
        await clear().catch(() => undefined);
        processing.current = false;
      }
    })();
  }, [
    callback,
    clear,
    convex,
    isAuthenticated,
    isLoading,
    navigate,
    signIn,
    verifierKey,
  ]);

  return (
    <NativeGoogleContext.Provider value={{ ready, pending, start, cancel }}>
      {children}
    </NativeGoogleContext.Provider>
  );
}
