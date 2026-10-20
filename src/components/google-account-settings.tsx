import { useEffect, useState } from "react";
import { useConvex } from "convex/react";
import { CheckCircle2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { GoogleSignInButton } from "./google-sign-in";
import { useNativeGoogleAuth } from "@/lib/native-google-auth-context";
import { isAndroidNative } from "@/lib/android-native";

export default function GoogleAccountSettings({
  onPendingChange,
}: {
  onPendingChange: (pending: boolean) => void;
}) {
  const convex = useConvex();
  const nativeAuth = useNativeGoogleAuth();
  useEffect(() => {
    if (isAndroidNative()) onPendingChange(nativeAuth.pending);
  }, [nativeAuth.pending, onPendingChange]);
  const [connection, setConnection] = useState<{
    linked: boolean;
    email?: string;
  } | null>(null);
  useEffect(() => {
    if (import.meta.env.VITE_ANDROID_PREVIEW === "true") return;
    let alive = true;
    const refresh = () =>
      void Promise.all([
        convex.query(api.social_auth.availability, {}),
        convex.query(api.social_auth.connection, {}),
      ])
        .then(([availability, current]) => {
          if (alive && availability.google) setConnection(current);
        })
        .catch(() => undefined);
    refresh();
    window.addEventListener("viso:google-account-changed", refresh);
    return () => {
      alive = false;
      window.removeEventListener("viso:google-account-changed", refresh);
    };
  }, [convex]);
  if (!connection) return null;
  return (
    <section
      className="space-y-3 rounded-xl border bg-card/70 p-4"
      aria-label="Acceso con Google"
    >
      <h3 className="text-sm font-semibold">Acceso con Google</h3>
      {connection.linked ? (
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-green-700" />
            Google vinculado
          </p>
          {connection.email && (
            <p className="break-all text-xs text-muted-foreground">
              {connection.email}
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Vinculá tu cuenta de Google para entrar a este mismo VISO,
            conservando tus estados, páginas y dispositivos.
          </p>
          <GoogleSignInButton mode="link" onPendingChange={onPendingChange} />
        </>
      )}
    </section>
  );
}
