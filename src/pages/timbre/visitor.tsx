import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link, useParams } from "react-router-dom";
import {
  BellRing,
  CheckCircle2,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
  Video,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { VisoBrand } from "@/components/viso-brand";
import {
  requestTimbreMedia,
  stopTimbreMedia,
  timbreMediaError,
} from "@/lib/timbre-peer";
import { TimbreCallBoundary, TimbreCallSession } from "./call-session";
import "./calls.css";

type VisitorCall = {
  callId: Id<"timbreCalls">;
  visitorToken: string;
  stream?: MediaStream;
};

function VisitorContent({ qrToken }: { qrToken: string }) {
  const qr = useQuery(api.timbre.publicQr, { qrToken });
  const rtc = useQuery(
    api.timbre_calls.rtcAvailability,
    qr ? { qrToken } : "skip",
  );
  const startCall = useMutation(api.timbre_calls.startCall);
  const leaveMessage = useMutation(api.timbre_calls.leaveMessage);
  const end = useMutation(api.timbre_calls.end);
  const [unit, setUnit] = useState("");
  const [call, setCall] = useState<VisitorCall | null>(null);
  const [pending, setPending] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const target = qr?.unitId ?? (unit ? (unit as Id<"timbreUnits">) : undefined);
  const telegram = useQuery(
    api.timbre_telegram.publicContact,
    qr?.available && !call
      ? { qrToken, ...(target ? { unitId: target } : {}) }
      : "skip",
  );
  const nonce = useRef<string | null>(null);
  const alive = useRef(true);
  const pendingStream = useRef<MediaStream | null>(null);
  const busy = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stopTimbreMedia(pendingStream.current);
    };
  }, []);
  const visitorNonce = () => {
    if (!nonce.current) {
      // This is an anti-abuse identifier for this QR visit, not a call access
      // token. Retain it across reloads without correlating different QR codes.
      const key = `viso:timbre:visit:${qrToken}`;
      try {
        const saved = sessionStorage.getItem(key);
        if (saved && /^[a-f0-9]{64}$/.test(saved)) nonce.current = saved;
      } catch {
        /* Private browsing may disable session storage. */
      }
      if (nonce.current) return nonce.current;
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      nonce.current = Array.from(bytes, (value) =>
        value.toString(16).padStart(2, "0"),
      ).join("");
      try {
        sessionStorage.setItem(key, nonce.current);
      } catch {
        /* Keep the in-memory identifier when storage is unavailable. */
      }
    }
    return nonce.current;
  };

  if (call)
    return (
      <TimbreCallSession
        callId={call.callId}
        visitorToken={call.visitorToken}
        initialStream={call.stream}
        onClose={() => {
          setCall(null);
          setError("");
        }}
      />
    );
  if (qr === undefined)
    return (
      <div className="vt-call-card" role="status">
        Buscando el timbre…
      </div>
    );
  if (!qr)
    return (
      <div className="vt-call-card vt-visitor-intro">
        <BellRing size={42} />
        <h1>Este timbre no está disponible</h1>
        <p>
          El QR puede haber sido desactivado o su servicio no estar activo.
          Contactá al lugar por otro medio.
        </p>
      </div>
    );
  const needsUnit = qr.kind === "building" && !qr.unitId;
  const showUnitSelector = !qr.unitId && (needsUnit || qr.units.length > 0);
  const canSelect = !needsUnit || Boolean(target);
  const canCall = qr.available && canSelect && !pending;

  const begin = async (mode: "audio" | "video" | "chat") => {
    if (busy.current || !canCall || (mode !== "chat" && !rtc?.available))
      return;
    busy.current = true;
    setPending(true);
    setError("");
    let captured: MediaStream | undefined;
    try {
      if (mode !== "chat") {
        captured = await requestTimbreMedia(mode);
        pendingStream.current = captured;
      }
      if (!alive.current) {
        stopTimbreMedia(captured);
        return;
      }
      const created = await startCall({
        qrToken,
        mode,
        unitId: target,
        visitorNonce: visitorNonce(),
      });
      if (!alive.current) {
        stopTimbreMedia(captured);
        void end({
          callId: created.callId,
          visitorToken: created.visitorToken,
        }).catch(() => undefined);
        return;
      }
      pendingStream.current = null;
      setCall({
        callId: created.callId,
        visitorToken: created.visitorToken,
        stream: captured,
      });
    } catch (failure) {
      stopTimbreMedia(captured);
      pendingStream.current = null;
      if (alive.current) setError(timbreMediaError(failure));
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  };
  const send = async () => {
    if (busy.current || !message.trim() || !canSelect) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await leaveMessage({
        qrToken,
        unitId: target,
        visitorNonce: visitorNonce(),
        text: message.trim(),
      });
      if (alive.current) {
        setSent(true);
        setMessage("");
      }
    } catch (failure) {
      if (alive.current) setError(timbreMediaError(failure));
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  };

  return (
    <div className="vt-call-card vt-visitor-intro">
      <div className="vt-door-icon">
        <BellRing size={30} />
      </div>
      <span className="vt-eyebrow">TIMBRE DIGITAL</span>
      <h1>{qr.siteName}</h1>
      <p className="vt-location-label">{qr.label}</p>
      {showUnitSelector && (
        <div className="vt-field">
          <label htmlFor="vt-unit">¿A quién visitás?</label>
          <select
            id="vt-unit"
            value={unit}
            onChange={(event) => {
              setUnit(event.target.value);
              setSent(false);
            }}
            disabled={pending}
          >
            <option value="">
              {needsUnit ? "Elegí una unidad" : "Contacto general"}
            </option>
            {qr.units.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
          {!qr.units.length && <p>No hay unidades disponibles para llamar.</p>}
        </div>
      )}
      {qr.available ? (
        <p>
          {telegram?.url &&
          !qr.audioEnabled &&
          !qr.videoEnabled &&
          !qr.chatEnabled &&
          !qr.messagesEnabled
            ? "Podés comunicarte con el lugar por Telegram."
            : "Tocá para avisar que llegaste. Para comunicarte en VISO no necesitás instalar una app ni crear una cuenta."}
        </p>
      ) : (
        <p className="vt-availability" role="status">
          {qr.absenceMessage ||
            (qr.reason === "outside_schedule"
              ? "En este momento estamos fuera del horario de atención."
              : qr.reason === "muted"
                ? "Este timbre está silenciado por el momento."
                : "Este timbre no puede recibir llamadas ahora.")}
        </p>
      )}
      {error && (
        <p className="vt-error" role="alert">
          {error}
        </p>
      )}
      <div className="vt-visitor-actions">
        {qr.audioEnabled && (
          <button
            className="vt-primary"
            disabled={!canCall || !rtc?.available}
            onClick={() => void begin("audio")}
          >
            <Phone size={20} />
            Llamar
          </button>
        )}
        {qr.videoEnabled && (
          <button
            className="vt-secondary"
            disabled={!canCall || !rtc?.available}
            onClick={() => void begin("video")}
          >
            <Video size={20} />
            Videollamar
          </button>
        )}
        {qr.chatEnabled && (
          <button
            className="vt-secondary"
            disabled={!canCall}
            onClick={() => void begin("chat")}
          >
            <MessageCircle size={20} />
            Abrir chat
          </button>
        )}
      </div>
      {qr.available && canSelect && telegram?.url && (
        <section
          className="vt-telegram-contact"
          aria-label="Contacto por Telegram"
        >
          <a
            className="vt-secondary"
            href={telegram.url}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            <Send size={20} />
            Abrir Telegram
          </a>
          <p>
            Necesitás Telegram. Se abrirá el perfil del lugar: tocá Llamar o
            Videollamada para comunicarte allí.
          </p>
        </section>
      )}
      {qr.available &&
        (qr.audioEnabled || qr.videoEnabled) &&
        rtc &&
        !rtc.available && (
          <p className="vt-availability">
            Las llamadas todavía no están habilitadas: el administrador debe
            configurar el servicio seguro de audio y video.
          </p>
        )}
      {pending && <p role="status">Preparando la comunicación…</p>}
      {qr.messagesEnabled && (
        <section className="vt-leave-message">
          <button
            className="vt-text-button"
            onClick={() => {
              setMessageOpen(!messageOpen);
              setSent(false);
            }}
            aria-expanded={messageOpen}
          >
            <MessageCircle size={18} />
            Dejar un mensaje
          </button>
          {messageOpen &&
            (sent ? (
              <p className="vt-success" role="status">
                <CheckCircle2 size={20} />
                Mensaje enviado. Ya podés cerrar esta página.
              </p>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void send();
                }}
              >
                <label htmlFor="vt-visit-message">Tu mensaje</label>
                <textarea
                  id="vt-visit-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={1000}
                  rows={4}
                  placeholder="Por ejemplo: llegué con una entrega."
                />
                <button
                  className="vt-primary"
                  disabled={pending || !message.trim() || !canSelect}
                >
                  <Send size={18} />
                  Enviar mensaje
                </button>
              </form>
            ))}
        </section>
      )}
      <p className="vt-privacy">
        <ShieldCheck size={16} />
        {telegram?.url && qr.available && canSelect
          ? "Las llamadas de VISO no muestran teléfonos personales. En Telegram se aplican los ajustes de privacidad del perfil."
          : "La comunicación se realiza en VISO. No mostramos números de teléfono personales."}
      </p>
    </div>
  );
}

export default function TimbreVisitorPage() {
  const { qr } = useParams<{ qr: string }>();
  return (
    <main className="vt-public">
      <Link className="vt-brand-link" to="/" aria-label="VISO">
        <VisoBrand />
      </Link>
      <TimbreCallBoundary key={qr}>
        {qr ? (
          <VisitorContent qrToken={qr} />
        ) : (
          <div className="vt-call-card">
            <h1>El QR no es válido</h1>
            <p>Volvé a escanear la placa del timbre.</p>
          </div>
        )}
      </TimbreCallBoundary>
      <footer className="vt-public-footer">Timbre digital · VISO</footer>
    </main>
  );
}
