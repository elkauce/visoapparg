import { useEffect, useRef } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex, useConvexAuth } from "convex/react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { isAndroidNative } from "@/lib/android-native";
import {
  clearGoogleAuthAttempt,
  isGoogleAuthAttemptCurrent,
  readGoogleAuthAttempt,
} from "@/lib/google-auth-flow";

const FAILURE =
  "No pudimos completar Google. Si ya tenés VISO, entrá con tu contraseña y vinculá Google desde Cuenta.";

export default function GoogleAuthReturn() {
  const convex = useConvex();
  const { signIn } = useAuthActions();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const processing = useRef(false);

  useEffect(() => {
    if (isAndroidNative() || import.meta.env.VITE_ANDROID_PREVIEW === "true")
      return;
    const params = new URLSearchParams(location.search);
    if (params.get("google") !== "return" || isLoading || processing.current)
      return;
    const attempt = readGoogleAuthAttempt();
    const link = attempt?.mode === "link";
    // Codes without our attempt marker belong to Convex Auth's automatic
    // handler. Owned flows wait for stored-session hydration and catch errors.
    if (params.has("code") && !attempt) return;
    processing.current = true;

    const finish = () => {
      clearGoogleAuthAttempt();
      params.delete("google");
      if (attempt) params.delete("code");
      navigate(
        {
          pathname: location.pathname,
          search: params.size ? `?${params.toString()}` : "",
          hash: location.hash,
        },
        { replace: true },
      );
    };

    void (async () => {
      try {
        if (!attempt || !isGoogleAuthAttemptCurrent(attempt)) {
          if (attempt) toast.error(FAILURE);
          return;
        }
        if (link && !isAuthenticated)
          throw new Error("The existing session is unavailable");
        const code = params.get("code");
        if (!code) throw new Error("Google was cancelled or rejected");
        // Link codes are our deferred 256-bit codes. Do not let a malformed
        // link return fall through to the SDK's ordinary sign-in-code path,
        // which may clear the account's existing session on rejection.
        if (link && !/^[0-9a-f]{64}$/i.test(code))
          throw new Error("Google linking code is malformed");
        // The installed SDK's implementation and automatic OAuth handler accept
        // an omitted provider, although its public declaration requires string.
        // Widen only this call to use the exact same verifier/token mechanism.
        const redeem = signIn as (
          provider: string | undefined,
          params: Parameters<typeof signIn>[1],
        ) => ReturnType<typeof signIn>;
        const result = await redeem(undefined, { code });
        if (!result.signingIn)
          throw new Error("Google sign-in was not completed");
        if (link) {
          const connection = await convex.query(api.social_auth.connection, {});
          if (!connection.linked) throw new Error("Google is not linked");
          toast.success(
            "Google vinculado. Tu deck y tus dispositivos se conservan.",
          );
        } else {
          toast.success("Entraste a VISO con Google.");
        }
      } catch {
        toast.error(FAILURE);
      } finally {
        finish();
      }
    })();
  }, [
    convex,
    isAuthenticated,
    isLoading,
    location.hash,
    location.pathname,
    location.search,
    navigate,
    signIn,
  ]);

  return null;
}
