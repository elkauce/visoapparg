import { useEffect, useRef, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BellRing, Bell, Phone, PhoneOff } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { useTimbreBrand } from "@/lib/timbre-brand";
import { api } from "@/convex/_generated/api";
import "@/pages/timbre/calls.css";

function useTimbreBrowserNotices() {
  const nativeAndroid =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    nativeAndroid || typeof Notification === "undefined"
      ? "unsupported"
      : Notification.permission,
  );
  const [error, setError] = useState("");
  useEffect(() => {
    const refresh = () =>
      setPermission(
        nativeAndroid || typeof Notification === "undefined"
          ? "unsupported"
          : Notification.permission,
      );
    window.addEventListener("viso:timbre-notification-permission", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener(
        "viso:timbre-notification-permission",
        refresh,
      );
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [nativeAndroid]);
  const request = async () => {
    if (nativeAndroid || typeof Notification === "undefined") return;
    setError("");
    try {
      setPermission(await Notification.requestPermission());
      window.dispatchEvent(new Event("viso:timbre-notification-permission"));
    } catch {
      setError(
        "Este navegador no permite avisos. Podés atender desde VISO mientras esté abierto.",
      );
    }
  };
  return { permission, error, request, nativeAndroid };
}

export function TimbreNotificationSettings() {
  const { permission, error, request, nativeAndroid } =
    useTimbreBrowserNotices();
  if (nativeAndroid) return null;
  return (
    <div className="vt-notification-settings">
      <h3>Avisos en este dispositivo</h3>
      <p>
        Activá las notificaciones del navegador para avisarte cuando llamen.
        VISO debe permanecer abierto; la entrega con la app cerrada requiere un
        servicio de notificaciones configurado.
      </p>
      {permission === "default" && (
        <button className="vt-secondary" onClick={() => void request()}>
          <Bell size={17} />
          Activar avisos
        </button>
      )}
      {permission === "granted" && (
        <p className="vt-success">
          <Bell size={17} />
          Permiso de avisos concedido. Su entrega depende de este navegador.
        </p>
      )}
      {permission === "denied" && (
        <p className="vt-muted">
          Bloqueaste los avisos. Podés permitirlos desde los ajustes de este
          sitio en tu navegador.
        </p>
      )}
      {permission === "unsupported" && (
        <p className="vt-muted">
          Este navegador no ofrece notificaciones. Las llamadas aparecen dentro
          de VISO mientras esté abierto.
        </p>
      )}
      {error && (
        <p className="vt-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Foreground Convex subscription. This does not promise delivery with VISO closed. */
export default function TimbreIncoming() {
  const { isAuthenticated } = useConvexAuth();
  return isAuthenticated ? <AuthenticatedIncoming /> : null;
}

function AuthenticatedIncoming() {
  const brand = useTimbreBrand();
  const incoming = useQuery(api.timbre_calls.incoming, {});
  const reject = useMutation(api.timbre_calls.reject);
  const location = useLocation();
  const navigate = useNavigate();
  const {
    permission,
    error: permissionError,
    request: requestNotices,
  } = useTimbreBrowserNotices();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const seen = useRef(new Set<string>());
  const notices = useRef(new Map<string, Notification>());
  const pending = incoming?.filter((call) => call.status === "ringing") ?? [];
  const visible = pending.find(
    (call) => location.pathname !== `/timbre/call/${call.callId}`,
  );

  useEffect(() => {
    const current = notices.current;
    return () => {
      current.forEach((notice) => notice.close());
      current.clear();
    };
  }, []);
  useEffect(() => {
    const announce = () => {
      if (permission !== "granted" || typeof Notification === "undefined")
        return;
      for (const call of incoming ?? []) {
        if (
          !call.notificationsEnabled ||
          call.status !== "ringing" ||
          seen.current.has(call.callId) ||
          location.pathname === `/timbre/call/${call.callId}` ||
          document.visibilityState !== "hidden"
        )
          continue;
        try {
          const notice = new Notification("Están llamando a tu Timbre VISO", {
            body: call.siteName,
            tag: `viso-timbre-${call.callId}`,
          });
          seen.current.add(call.callId);
          notices.current.set(call.callId, notice);
          notice.onclick = () => {
            window.focus();
            navigate(`/timbre/call/${call.callId}`);
            notice.close();
          };
        } catch {
          /* Android browsers can require a native push provider instead. The visible banner remains available. */
        }
      }
      for (const [id, notice] of notices.current) {
        if (
          !incoming?.some(
            (call) => call.callId === id && call.status === "ringing",
          )
        ) {
          notice.close();
          notices.current.delete(id);
        }
      }
    };
    announce();
    document.addEventListener("visibilitychange", announce);
    return () => document.removeEventListener("visibilitychange", announce);
  }, [incoming, location.pathname, navigate, permission]);

  if (!visible) return null;
  const decline = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await reject({ callId: visible.callId });
    } catch {
      setError("No pudimos rechazar la llamada. Revisá tu conexión.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <aside
      className="vt-incoming"
      aria-label="Llamada entrante del timbre"
      role="status"
    >
      <div className="vt-incoming-title">
        <BellRing size={24} />
        <div>
          <strong>Están llamando al timbre</strong>
          <p>
            {visible.siteName}
            {pending.length > 1 ? ` · ${pending.length} llamadas` : ""}
          </p>
          {visible.visitorMessage && <p>{visible.visitorMessage}<small> · Motivo indicado por la visita</small></p>}
        </div>
      </div>
      <div className="vt-call-actions">
        <Link className="vt-primary" to={`/timbre/call/${visible.callId}`}>
          <Phone size={18} />
          Ver llamada
        </Link>
        <button
          className="vt-secondary"
          disabled={busy}
          onClick={() => void decline()}
        >
          <PhoneOff size={18} />
          Rechazar
        </button>
      </div>
      {visible.notificationsEnabled && permission === "default" && (
        <button
          className="vt-text-button"
          onClick={() => void requestNotices()}
        >
          <Bell size={16} />
          Activar avisos del navegador
        </button>
      )}
      {visible.notificationsEnabled && permission === "denied" && (
        <p className="vt-muted">
          Los avisos están bloqueados en este navegador. Podés habilitarlos en
          sus ajustes.
        </p>
      )}
      <p className="vt-muted">
        Avisos mientras {brand.standalone ? brand.name : "VISO"} está abierto. La recepción con la app cerrada
        requiere un servicio de notificaciones configurado.
      </p>
      {(error || permissionError) && (
        <p className="vt-error" role="alert">
          {error || permissionError}
        </p>
      )}
    </aside>
  );
}
