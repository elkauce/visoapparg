import { useEffect, useRef, useState } from "react";
import { useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { App } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import { Bell, BellOff } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { isAndroidNative } from "@/lib/android-native";
import { timbreNative, type TimbreNativeCapabilities } from "@/lib/timbre-native";
import {useTimbreBrand} from "@/lib/timbre-brand";

const CHANGE = "viso:timbre-push-preference";
const preferenceKey = (userId: string) => `viso:timbre-push:${userId}`;
let installation: string | undefined;
function timbrePushDeviceId() {
  if (installation) return installation;
  try { const existing = localStorage.getItem("viso:timbre-push-installation"); if (existing && /^[A-Za-z0-9_-]{20,100}$/.test(existing)) return installation = existing; } catch { /* Native app storage may be temporarily unavailable. */ }
  installation = crypto.randomUUID();
  try { localStorage.setItem("viso:timbre-push-installation", installation); } catch { /* The in-memory installation remains stable for this process. */ }
  return installation;
}
function timbrePushOptedIn(userId: string) {
  try { return localStorage.getItem(preferenceKey(userId)) === "enabled"; } catch { return false; }
}
function preference(userId: string, enabled: boolean) {
  localStorage.setItem(preferenceKey(userId), enabled ? "enabled" : "disabled");
  window.dispatchEvent(new Event(CHANGE));
}

/** Mount once within the router. No permission request occurs on mount. */
export default function TimbrePush() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const native = isAndroidNative();
  const user = useQuery(api.users.getCurrentUser, native && isAuthenticated && !isLoading ? {} : "skip");
  useEffect(() => {
    if (native && !isLoading && (!isAuthenticated || user === null)) void timbreNative.configure({ enabled: false }).catch(() => undefined);
  }, [native, isAuthenticated, isLoading, user]);
  return native && isAuthenticated && user ? <PushSession key={user._id} ownerId={user._id} /> : null;
}
function PushSession({ ownerId }: { ownerId: Id<"users"> }) {
  const convex = useConvex(), navigate = useNavigate();
  const register = useMutation(api.timbre_push.registerDevice), unregister = useMutation(api.timbre_push.unregisterDevice);
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);
  useEffect(() => {
    let alive = true, refreshing = false;
    const handles: PluginListenerHandle[] = [];
    const open = async (callId: string | null) => {
      if (!callId || !alive) return;
      if (!/^[a-zA-Z0-9]{20,64}$/.test(callId)) { await timbreNative.clearPendingCall().catch(() => undefined); return; }
      try {
        // Notification identifiers carry no authorization. The server checks
        // membership, recipient assignment, current license and call state.
        const session = await convex.query(api.timbre_calls.session, { callId: callId as Id<"timbreCalls"> });
        if (!alive || (session.status !== "ringing" && !(session.status === "accepted" && session.acceptedByMe))) return;
        navigateRef.current(`/timbre/call/${callId}`);
      } catch { /* Expired/revoked/foreign calls must not open the call UI. */ }
      finally { await timbreNative.clearPendingCall().catch(() => undefined); }
    };
    const refresh = async () => {
      if (!alive || refreshing) return; refreshing = true;
      try {
        if (!timbrePushOptedIn(ownerId)) { await timbreNative.configure({ enabled: false }); await unregister({ deviceId: timbrePushDeviceId() }); return; }
        const capabilities = await timbreNative.getCapabilities();
        if (!capabilities.available || !capabilities.notificationsEnabled) { await timbreNative.configure({ enabled: false }); await unregister({ deviceId: timbrePushDeviceId() }); return; }
        const { token } = await timbreNative.getPushToken();
        if (!alive) return;
        const registered = await register({ deviceId: timbrePushDeviceId(), token });
        if (!alive) return;
        if (!timbrePushOptedIn(ownerId)) { await timbreNative.configure({ enabled: false }); await unregister({ deviceId: timbrePushDeviceId() }); return; }
        await timbreNative.configure({ ownerId, enabled: registered.configured });
        if (registered.configured) { const pending = await timbreNative.getPendingCall(); await open(pending.callId); }
      } catch { /* Keep foreground calls functional when push/network is unavailable. */ }
      finally { refreshing = false; }
    };
    const visibility = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener(CHANGE, refresh); document.addEventListener("visibilitychange", visibility);
    void App.addListener("appStateChange", ({ isActive }) => { if (isActive) void refresh(); }).then((handle) => { if (alive) handles.push(handle); else void handle.remove(); }).catch(() => undefined);
    void timbreNative.addListener("timbreNotificationTapped", ({ callId }) => { void open(callId); }).then((handle) => { if (alive) handles.push(handle); else void handle.remove(); }).catch(() => undefined);
    void refresh();
    return () => {
      alive = false; window.removeEventListener(CHANGE, refresh); document.removeEventListener("visibilitychange", visibility);
      for (const handle of handles) void handle.remove();
      void timbreNative.configure({ enabled: false }).catch(() => undefined);
      void unregister({ deviceId: timbrePushDeviceId() }).catch(() => undefined);
    };
  }, [convex, ownerId, register, unregister]);
  return null;
}

/** Show in Timbre settings. Native opt-in is separate from browser notifications. */
export function TimbrePushSettings() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const native = isAndroidNative();
  const user = useQuery(api.users.getCurrentUser, native && isAuthenticated && !isLoading ? {} : "skip");
  return native && user ? <PushControls key={user._id} ownerId={user._id} /> : null;
}
function PushControls({ ownerId }: { ownerId: Id<"users"> }) {
  const brand=useTimbreBrand();const product=brand.standalone?"Te Aviso":"VISO";
  const configuration = useQuery(api.timbre_push.configuration, {});
  const register = useMutation(api.timbre_push.registerDevice), unregister = useMutation(api.timbre_push.unregisterDevice);
  const [capabilities, setCapabilities] = useState<TimbreNativeCapabilities | null>(null);
  const [enabled, setEnabled] = useState(() => timbrePushOptedIn(ownerId));
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { let alive = true; void timbreNative.getCapabilities().then((value) => { if (alive) setCapabilities(value); }).catch(() => { if (alive) setCapabilities({ available: false, notificationsEnabled: false, backgroundMedia: false }); }); return () => { alive = false; }; }, []);
  const toggle = async () => {
    if (busy) return; setBusy(true); setError("");
    try {
      if (enabled) {
        // Disable locally first, even when the server is temporarily offline.
        preference(ownerId, false); setEnabled(false);
        await timbreNative.configure({ enabled: false });
        await unregister({ deviceId: timbrePushDeviceId() });
      } else {
        if (!configuration?.configured || !capabilities?.available) throw new Error("Los avisos con la app cerrada todavía no están configurados.");
        const permission = await timbreNative.requestNotifications();
        if (!permission.granted) throw new Error(`Permití las notificaciones de ${product} en los ajustes de Android para recibir llamadas.`);
        const { token } = await timbreNative.getPushToken();
        const result = await register({ deviceId: timbrePushDeviceId(), token });
        if (!result.configured) throw new Error("El servicio de avisos todavía no está configurado.");
        await timbreNative.configure({ ownerId, enabled: true });
        preference(ownerId, true); setEnabled(true);
      }
    } catch (failure) {
      if (!enabled) { await timbreNative.configure({ enabled: false }).catch(() => undefined); await unregister({ deviceId: timbrePushDeviceId() }).catch(() => undefined); }
      setError(failure instanceof Error ? failure.message : "No se pudo actualizar la configuración de avisos.");
    }
    finally { setBusy(false); }
  };
  const available = configuration?.configured && capabilities?.available;
  return <div className="vt-notification-settings">
    <h3>Avisos de Timbre en Android</h3>
    <p>Recibí el aviso aunque {product} esté en segundo plano o cerrado. Al atender se abre la llamada; la cámara y el micrófono se activan con tu permiso.</p>
    {!available && <p className="vt-muted">La entrega con la app cerrada requiere configurar el servicio de notificaciones y una APK compatible. Las llamadas siguen apareciendo con {product} abierto.</p>}
    <button type="button" className="vt-secondary" disabled={busy || (!enabled && !available)} onClick={() => void toggle()}>{enabled ? <BellOff size={17} /> : <Bell size={17} />}{busy ? "Actualizando…" : enabled ? "Desactivar avisos de Android" : "Activar avisos de Android"}</button>
    {enabled && available && <p className="vt-success">Avisos habilitados para esta cuenta y este dispositivo. Android puede limitar su entrega si forzás el cierre o restringís la batería.</p>}
    {error && <p className="vt-error" role="alert">{error}</p>}
  </div>;
}
