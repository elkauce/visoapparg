export type TimbreMediaMode = "audio" | "video";
export type TimbrePeerRole = "visitor" | "resident";
export type TimbreSignal = {
  kind: "offer" | "answer" | "ice";
  payload: string;
};

type PeerOptions = {
  role: TimbrePeerRole;
  configuration: RTCConfiguration;
  signal: (signal: TimbreSignal) => Promise<unknown>;
  remote: (stream: MediaStream) => void;
  state: (state: RTCPeerConnectionState) => void;
  error: (error: Error) => void;
  createPeer?: (configuration: RTCConfiguration) => RTCPeerConnection;
};

/** Media is requested only from an explicit call/answer button, never on mount. */
export async function requestTimbreMedia(
  mode: TimbreMediaMode,
): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      "Este navegador necesita HTTPS y acceso al micrófono para llamar.",
    );
  }
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video:
      mode === "video"
        ? { facingMode: "user", width: { ideal: 960 }, height: { ideal: 540 } }
        : false,
  });
}

export function stopTimbreMedia(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function timbreMediaError(error: unknown) {
  const name =
    error && typeof error === "object" && "name" in error ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError")
    return "Permití usar el micrófono y, para video, la cámara. Después volvé a intentar.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError")
    return "No encontramos el micrófono o la cámara solicitados en este dispositivo.";
  if (name === "NotReadableError")
    return "Otra aplicación está usando el micrófono o la cámara. Cerrala y volvé a intentar.";
  if (
    error &&
    typeof error === "object" &&
    "data" in error &&
    error.data &&
    typeof error.data === "object" &&
    "message" in error.data &&
    typeof error.data.message === "string"
  )
    return error.data.message;
  return error instanceof Error
    ? error.message
    : "No pudimos iniciar la comunicación.";
}

/** One connection per accepted call. SDP and ICE are never put in URLs or logs. */
export class TimbrePeer {
  private peer: RTCPeerConnection | null = null;
  private local: MediaStream | null = null;
  private closed = false;
  private pendingIce: RTCIceCandidateInit[] = [];
  private serial: Promise<void> = Promise.resolve();
  private initialOffer = "";
  private remoteOffer = "";
  private remoteAnswer = "";
  private remoteStream: MediaStream | null = null;
  constructor(private readonly options: PeerOptions) {}

  async start(stream: MediaStream) {
    if (this.closed) {
      stopTimbreMedia(stream);
      return;
    }
    if (this.peer) throw new Error("Esta comunicación ya está iniciada.");
    this.local = stream;
    try {
      const peer =
        this.options.createPeer?.(this.options.configuration) ??
        new RTCPeerConnection(this.options.configuration);
      this.peer = peer;
      peer.onicecandidate = (event) => {
        if (this.closed || !event.candidate) return;
        void this.options
          .signal({
            kind: "ice",
            payload: JSON.stringify(event.candidate.toJSON()),
          })
          .catch((error) => this.report(error));
      };
      peer.ontrack = (event) => {
        if (this.closed) return;
        const remote =
          event.streams[0] ?? (this.remoteStream ??= new MediaStream());
        if (!event.streams[0] && !remote.getTracks().includes(event.track))
          remote.addTrack(event.track);
        this.options.remote(remote);
      };
      peer.onconnectionstatechange = () => {
        if (!this.closed) this.options.state(peer.connectionState);
      };
      for (const track of stream.getTracks()) peer.addTrack(track, stream);
      if (this.options.role === "visitor") {
        const offer = await peer.createOffer();
        if (this.closed) return;
        await peer.setLocalDescription(offer);
        if (this.closed) return;
        this.initialOffer = peer.localDescription?.sdp ?? offer.sdp ?? "";
        await this.options.signal({
          kind: "offer",
          payload: JSON.stringify({ type: "offer", sdp: this.initialOffer }),
        });
      }
    } catch (error) {
      this.close();
      throw error;
    }
  }

  receive(signal: TimbreSignal) {
    this.serial = this.serial
      .then(() => this.apply(signal))
      .catch((error) => this.report(error));
    return this.serial;
  }

  private async apply(signal: TimbreSignal) {
    const peer = this.peer;
    if (this.closed || !peer) return;
    if (signal.payload.length > 100_000)
      throw new Error("La señal de llamada excede el tamaño permitido.");
    const value: unknown = JSON.parse(signal.payload);
    if (!value || typeof value !== "object")
      throw new Error("La señal de llamada no es válida.");
    if (signal.kind === "ice") {
      const candidate = value as RTCIceCandidateInit;
      if (typeof candidate.candidate !== "string")
        throw new Error("La señal de red no es válida.");
      if (!peer.remoteDescription) {
        if (this.pendingIce.length >= 128)
          throw new Error("Hay demasiadas señales de red pendientes.");
        this.pendingIce.push(candidate);
      } else await peer.addIceCandidate(candidate);
      return;
    }
    const description = value as RTCSessionDescriptionInit;
    if (description.type !== signal.kind || typeof description.sdp !== "string")
      throw new Error("La descripción de llamada no es válida.");
    if (signal.kind === "offer") {
      if (this.options.role !== "resident")
        throw new Error("La señal no corresponde a este participante.");
      if (this.remoteOffer === description.sdp) return;
      await peer.setRemoteDescription(description);
      if (this.closed) return;
      this.remoteOffer = description.sdp;
      await this.flushIce(peer);
      if (this.closed) return;
      const answer = await peer.createAnswer();
      if (this.closed) return;
      await peer.setLocalDescription(answer);
      if (this.closed) return;
      await this.options.signal({
        kind: "answer",
        payload: JSON.stringify({
          type: "answer",
          sdp: peer.localDescription?.sdp ?? answer.sdp,
        }),
      });
    } else {
      if (this.options.role !== "visitor")
        throw new Error("La señal no corresponde a este participante.");
      if (this.remoteAnswer === description.sdp) return;
      await peer.setRemoteDescription(description);
      if (this.closed) return;
      this.remoteAnswer = description.sdp;
      await this.flushIce(peer);
    }
  }

  private async flushIce(peer: RTCPeerConnection) {
    const pending = this.pendingIce.splice(0);
    for (const candidate of pending) {
      if (this.closed) return;
      await peer.addIceCandidate(candidate);
    }
  }
  private report(error: unknown) {
    if (!this.closed)
      this.options.error(
        error instanceof Error
          ? error
          : new Error("No se pudo intercambiar la señal de llamada."),
      );
  }
  mute(muted: boolean) {
    this.local?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }
  camera(enabled: boolean) {
    this.local?.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    const peer = this.peer;
    if (peer) {
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.onconnectionstatechange = null;
      peer.close();
    }
    stopTimbreMedia(this.local);
    this.local = null;
    this.peer = null;
    this.remoteStream = null;
    this.pendingIce = [];
  }
}
