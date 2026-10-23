import { Component, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { Link, useParams } from "react-router-dom";
import {
  Camera,
  CameraOff,
  Check,
  Maximize,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Send,
  Volume2,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { VisoBrand } from "@/components/viso-brand";
import { SignInButton } from "@/components/ui/signin";
import {
  requestTimbreMedia,
  stopTimbreMedia,
  TimbrePeer,
  timbreMediaError,
} from "@/lib/timbre-peer";
import "./calls.css";

type Credentials = { callId: Id<"timbreCalls">; visitorToken?: string };
type CallProps = Credentials & {
  initialStream?: MediaStream;
  onClose?: () => void;
};

export class TimbreCallBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="vt-public">
          <div className="vt-call-card" role="alert">
            <VisoBrand />
            <h1>La comunicación ya no está disponible</h1>
            <p>
              El timbre pudo cambiar de configuración o la sesión pudo
              finalizar. Cerrá esta página y volvé a escanear el QR para
              intentarlo de nuevo.
            </p>
            <Link className="vt-secondary" to="/">
              Ir a VISO
            </Link>
          </div>
        </div>
      );
    return this.props.children;
  }
}

function MediaView({
  stream,
  local = false,
}: {
  stream: MediaStream | null;
  local?: boolean;
}) {
  const element = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const video = element.current;
    if (!video) return;
    video.srcObject = stream;
    let active = true;
    if (stream)
      void video.play().catch(() => {
        if (active && !local) setBlocked(true);
      });
    return () => {
      active = false;
      video.srcObject = null;
    };
  }, [stream, local]);
  return (
    <>
      <video
        ref={element}
        autoPlay
        playsInline
        muted={local}
        aria-label={local ? "Tu cámara" : "Comunicación recibida"}
        className={local ? "vt-local-video" : "vt-remote-video"}
      />
      {blocked && (
        <button
          className="vt-audio-unlock"
          onClick={() => {
            void element.current
              ?.play()
              .then(() => setBlocked(false))
              .catch(() => setBlocked(true));
          }}
        >
          <Volume2 size={18} /> Activar audio
        </button>
      )}
    </>
  );
}

export function TimbreCallSession({
  callId,
  visitorToken,
  initialStream,
  onClose,
}: CallProps) {
  const credentials = useMemo(
    () => (visitorToken ? { callId, visitorToken } : { callId }),
    [callId, visitorToken],
  );
  const [joinedHere, setJoinedHere] = useState(Boolean(visitorToken));
  const session = useQuery(api.timbre_calls.session, credentials);
  const permittedPeer = Boolean(
    visitorToken || (session?.acceptedByMe && joinedHere),
  );
  const signals = useQuery(
    api.timbre_calls.signals,
    session?.status === "accepted" && permittedPeer && session.mode !== "chat"
      ? credentials
      : "skip",
  );
  const messages = useQuery(
    api.timbre_calls.chat,
    session?.chatEnabled && (session.status !== "accepted" || permittedPeer)
      ? credentials
      : "skip",
  );
  const accept = useMutation(api.timbre_calls.accept);
  const reject = useMutation(api.timbre_calls.reject);
  const end = useMutation(api.timbre_calls.end);
  const heartbeat = useMutation(api.timbre_calls.heartbeat);
  const signal = useMutation(api.timbre_calls.sendSignal);
  const sendMessage = useMutation(api.timbre_calls.sendMessage);
  const rtc = useAction(api.timbre_calls.getRtcConfiguration);
  const [local, setLocal] = useState<MediaStream | null>(
    () => initialStream ?? null,
  );
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [network, setNetwork] = useState<RTCPeerConnectionState>("new");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(true);
  const [endedHere, setEndedHere] = useState(false);
  const alive = useRef(true);
  const streamRef = useRef(local);
  const peer = useRef<TimbrePeer | null>(null);
  const seen = useRef(new Set<string>());
  const screen = useRef<HTMLDivElement>(null);
  const ended = useRef(false);
  const mayEnd = useRef(Boolean(visitorToken));
  const role = visitorToken ? "visitor" : "owner";
  const active =
    session?.status === "ringing" || session?.status === "accepted";
  const terminal = endedHere || Boolean(session && !active);
  const accepted = session?.status === "accepted" && permittedPeer;

  useEffect(() => {
    streamRef.current = local;
  }, [local]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      peer.current?.close();
      stopTimbreMedia(streamRef.current);
      if (mayEnd.current && !ended.current)
        void end(credentials).catch(() => undefined);
    };
  }, [credentials, end]);

  useEffect(() => {
    if (!active || (session?.status === "accepted" && !permittedPeer)) return;
    const timer = window.setInterval(() => {
      void heartbeat(credentials).catch(() => {
        if (alive.current)
          setError(
            "No pudimos mantener la conexión. Revisá tu conexión a internet.",
          );
      });
    }, 25_000);
    return () => window.clearInterval(timer);
  }, [active, credentials, heartbeat, permittedPeer, session?.status]);

  useEffect(() => {
    if (!accepted || !local || session?.mode === "chat" || terminal) return;
    let cancelled = false;
    let connection: TimbrePeer | null = null;
    void (async () => {
      try {
        const configuration = await rtc(credentials);
        if (cancelled) return;
        connection = new TimbrePeer({
          role: role === "visitor" ? "visitor" : "resident",
          configuration: {
            iceServers: configuration.iceServers,
            iceTransportPolicy: configuration.iceTransportPolicy,
          },
          signal: (value) => signal({ ...credentials, ...value }),
          remote: setRemote,
          state: setNetwork,
          error: (failure) => {
            if (!cancelled) setError(timbreMediaError(failure));
          },
        });
        peer.current = connection;
        await connection.start(local);
        if (!cancelled) setReady(true);
      } catch (failure) {
        if (!cancelled) {
          setError(timbreMediaError(failure));
          stopTimbreMedia(local);
          ended.current = true;
          void end(credentials).catch(() => undefined);
          setEndedHere(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      connection?.close();
      peer.current = null;
    };
  }, [
    accepted,
    credentials,
    end,
    local,
    role,
    rtc,
    session?.mode,
    signal,
    terminal,
  ]);

  useEffect(() => {
    if (!ready || !peer.current) return;
    for (const incoming of signals ?? []) {
      if (seen.current.has(incoming.id)) continue;
      seen.current.add(incoming.id);
      void peer.current.receive({
        kind: incoming.kind,
        payload: incoming.payload,
      });
    }
  }, [signals, ready]);

  useEffect(() => {
    if (!ready) return;
    peer.current?.mute(muted);
    peer.current?.camera(camera);
  }, [muted, camera, ready]);

  useEffect(() => {
    if (!terminal) return;
    ended.current = true;
    peer.current?.close();
    stopTimbreMedia(streamRef.current);
  }, [terminal]);

  const respond = async () => {
    if (!session || busy) return;
    setBusy(true);
    setError("");
    let captured: MediaStream | undefined;
    try {
      if (session.mode !== "chat")
        captured = await requestTimbreMedia(session.mode);
      if (!alive.current) {
        stopTimbreMedia(captured);
        return;
      }
      await accept({ callId });
      if (!alive.current) {
        stopTimbreMedia(captured);
        void end(credentials).catch(() => undefined);
        return;
      }
      mayEnd.current = true;
      setJoinedHere(true);
      if (captured) {
        streamRef.current = captured;
        setLocal(captured);
      }
    } catch (failure) {
      stopTimbreMedia(captured);
      if (alive.current) setError(timbreMediaError(failure));
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const finish = async (decline = false) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (decline) await reject({ callId });
      else await end(credentials);
      ended.current = true;
      peer.current?.close();
      stopTimbreMedia(streamRef.current);
      setEndedHere(true);
    } catch (failure) {
      setError(timbreMediaError(failure));
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const submitMessage = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setError("");
    try {
      await sendMessage({ ...credentials, text: value });
      setText("");
    } catch (failure) {
      setError(timbreMediaError(failure));
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const fullscreen = () => {
    if (!document.fullscreenElement)
      void screen.current?.requestFullscreen?.().catch(() => undefined);
    else void document.exitFullscreen?.().catch(() => undefined);
  };

  if (session === undefined)
    return (
      <div className="vt-call-card" role="status">
        Conectando con el timbre…
      </div>
    );
  if (!session)
    return (
      <div className="vt-call-card">
        <h1>Esta comunicación no está disponible</h1>
        <p>El enlace puede haber vencido o no pertenecer a tu cuenta.</p>
        {onClose && (
          <button className="vt-primary" onClick={onClose}>
            Volver al timbre
          </button>
        )}
      </div>
    );
  const otherDevice =
    session.status === "accepted" && role === "owner" && !permittedPeer;
  const sameAccountSession = otherDevice && session.acceptedByMe;
  const statusText = terminal
    ? session.status === "rejected"
      ? "No se pudo atender"
      : session.status === "missed"
        ? "No hubo respuesta"
        : "Comunicación finalizada"
    : otherDevice
      ? sameAccountSession
        ? "La comunicación ya fue atendida con tu cuenta"
        : "Ya atendieron en otro dispositivo"
      : accepted
        ? session.mode === "chat"
          ? "Chat conectado"
          : network === "connected"
            ? "En comunicación"
            : network === "failed"
              ? "No pudimos conectar el audio o video"
              : network === "disconnected"
                ? "Reconectando…"
                : "Conectando audio y video…"
        : role === "visitor"
          ? "Llamando…"
          : "Alguien está en el timbre";

  return (
    <div className="vt-call-card" ref={screen}>
      <header className="vt-call-heading">
        <div>
          <span className="vt-eyebrow">VISO TIMBRE</span>
          <h1>{session.siteName}</h1>
        </div>
        <span className="vt-status" role="status">
          {statusText}
        </span>
      </header>
      {error && (
        <p className="vt-error" role="alert">
          {error}
        </p>
      )}
      {sameAccountSession && (
        <p className="vt-availability">
          La comunicación continúa en la pestaña o el dispositivo que atendió.
          Desde aquí podés finalizarla; para una nueva llamada, volvé a tocar el
          timbre.
        </p>
      )}
      {session.mode !== "chat" && !terminal && !otherDevice && (
        <div
          className={`vt-call-media ${session.mode === "audio" ? "is-audio" : ""}`}
          onDoubleClick={fullscreen}
        >
          <MediaView stream={remote} />
          {!remote && (
            <div className="vt-media-placeholder">
              <Phone size={44} />
              <p>
                {accepted
                  ? "Preparando comunicación segura"
                  : "Esperando respuesta"}
              </p>
            </div>
          )}
          {session.mode === "video" && local && (
            <MediaView stream={local} local />
          )}
          <button
            className="vt-fullscreen"
            aria-label="Pantalla completa"
            onClick={fullscreen}
          >
            <Maximize size={18} />
          </button>
        </div>
      )}
      {role === "owner" && session.status === "ringing" && !terminal && (
        <div className="vt-call-actions">
          <button
            className="vt-primary"
            disabled={busy}
            onClick={() => void respond()}
          >
            <Phone size={18} /> {busy ? "Preparando…" : "Atender"}
          </button>
          <button
            className="vt-danger"
            disabled={busy}
            onClick={() => void finish(true)}
          >
            <PhoneOff size={18} /> Rechazar
          </button>
        </div>
      )}
      {!terminal && !otherDevice && (role === "visitor" || accepted) && (
        <div className="vt-call-actions">
          {accepted && session.mode !== "chat" && (
            <button
              className="vt-secondary"
              aria-pressed={muted}
              onClick={() => {
                peer.current?.mute(!muted);
                setMuted(!muted);
              }}
            >
              {muted ? <MicOff size={18} /> : <Mic size={18} />}
              {muted ? "Activar micrófono" : "Silenciar"}
            </button>
          )}
          {accepted && session.mode === "video" && (
            <button
              className="vt-secondary"
              aria-pressed={!camera}
              onClick={() => {
                peer.current?.camera(!camera);
                setCamera(!camera);
              }}
            >
              {camera ? <Camera size={18} /> : <CameraOff size={18} />}
              {camera ? "Apagar cámara" : "Activar cámara"}
            </button>
          )}
          <button
            className="vt-danger"
            disabled={busy}
            onClick={() => void finish()}
          >
            <PhoneOff size={18} />
            {session.status === "ringing" ? "Cancelar" : "Finalizar"}
          </button>
        </div>
      )}
      {session.chatEnabled && !otherDevice && (
        <section className="vt-chat" aria-label="Chat del timbre">
          <h2>Mensajes de la comunicación</h2>
          <div className="vt-chat-messages" aria-live="polite">
            {messages?.length ? (
              messages.map((message) => (
                <p
                  className={
                    message.from === role ? "vt-message is-mine" : "vt-message"
                  }
                  key={message.id}
                >
                  <span>
                    {message.from === role
                      ? "Vos"
                      : role === "visitor"
                        ? "Residente"
                        : "Visitante"}
                  </span>
                  {message.text}
                </p>
              ))
            ) : (
              <p className="vt-muted">
                {accepted
                  ? "Podés escribir sin compartir tu teléfono."
                  : "El chat estará disponible cuando atiendan."}
              </p>
            )}
          </div>
          {!terminal && accepted && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitMessage();
              }}
            >
              <label className="vt-sr-only" htmlFor="vt-chat-text">
                Mensaje
              </label>
              <input
                id="vt-chat-text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={1000}
                placeholder="Escribí un mensaje"
                autoComplete="off"
              />
              <button
                className="vt-primary"
                type="submit"
                disabled={busy || !text.trim()}
                aria-label="Enviar mensaje"
              >
                <Send size={18} />
              </button>
            </form>
          )}
        </section>
      )}
      {(terminal || otherDevice) && (
        <div className="vt-call-actions">
          {sameAccountSession && (
            <button
              className="vt-danger"
              disabled={busy}
              onClick={() => void finish()}
            >
              <PhoneOff size={18} />
              Finalizar comunicación
            </button>
          )}
          <Check size={20} />
          {onClose ? (
            <button className="vt-primary" onClick={onClose}>
              Volver al timbre
            </button>
          ) : (
            <Link className="vt-primary" to="/timbre">
              Volver a Timbre
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default function TimbreCallPage() {
  const { callId } = useParams<{ callId: string }>();
  const auth = useConvexAuth();
  return (
    <div className="vt-public">
      <Link className="vt-brand-link" to="/">
        <VisoBrand />
      </Link>
      {auth.isLoading ? (
        <p role="status">Revisando tu cuenta…</p>
      ) : !auth.isAuthenticated ? (
        <div className="vt-call-card">
          <h1>Entrá para atender tu timbre</h1>
          <p>Usá la cuenta VISO que está vinculada a esta dirección.</p>
          <SignInButton signInText="Entrar para atender" />
        </div>
      ) : callId ? (
        <TimbreCallBoundary key={callId}>
          <TimbreCallSession callId={callId as Id<"timbreCalls">} />
        </TimbreCallBoundary>
      ) : (
        <p role="alert">El enlace no es válido.</p>
      )}
    </div>
  );
}

export function TimbreMessages({
  siteId,
  enabled = true,
  unitNames = {},
}: {
  siteId: Id<"timbreSites">;
  enabled?: boolean;
  unitNames?: Record<string, string>;
}) {
  const messages = useQuery(
    api.timbre_calls.messages,
    enabled ? { siteId } : "skip",
  );
  if (!enabled)
    return (
      <p className="vt-muted">
        Los mensajes están desactivados para este timbre.
      </p>
    );
  if (messages === undefined) return <p role="status">Buscando mensajes…</p>;
  return (
    <section className="vt-chat" aria-label="Mensajes de visitantes">
      <h2>Mensajes de visitantes</h2>
      <p className="vt-muted">
        Mensajes enviados sin una llamada. Se conservan durante 30 días.
      </p>
      {messages.length ? (
        <div className="vt-offline-messages">
          {messages.map((message) => (
            <article className="vt-offline-message" key={message.id}>
              <div>
                <strong>
                  {message.unitId
                    ? unitNames[message.unitId] || "Unidad del edificio"
                    : "Visitante"}
                </strong>
                <time dateTime={new Date(message.createdAt).toISOString()}>
                  {new Intl.DateTimeFormat("es-AR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(message.createdAt)}
                </time>
              </div>
              <p>{message.text}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="vt-muted">Todavía no recibiste mensajes.</p>
      )}
    </section>
  );
}
