import { afterEach, describe, expect, it, vi } from "vitest";
import {
  requestTimbreMedia,
  stopTimbreMedia,
  TimbrePeer,
  timbreMediaError,
} from "./timbre-peer";

function media() {
  const audio = { stop: vi.fn(), enabled: true, kind: "audio" };
  const video = { stop: vi.fn(), enabled: true, kind: "video" };
  return {
    audio,
    video,
    stream: {
      getTracks: () => [audio, video],
      getAudioTracks: () => [audio],
      getVideoTracks: () => [video],
    } as unknown as MediaStream,
  };
}
function connection(role: "visitor" | "resident" = "visitor") {
  const rtc = {
    onicecandidate: null,
    ontrack: null,
    onconnectionstatechange: null,
    connectionState: "new",
    localDescription: null as RTCSessionDescriptionInit | null,
    remoteDescription: null as RTCSessionDescriptionInit | null,
    addTrack: vi.fn(),
    close: vi.fn(),
    addIceCandidate: vi.fn(async () => undefined),
    createOffer: vi.fn(async () => ({ type: "offer", sdp: "visitor-offer" })),
    createAnswer: vi.fn(async () => ({ type: "answer", sdp: "owner-answer" })),
    setLocalDescription: vi.fn(
      async (description: RTCSessionDescriptionInit) => {
        rtc.localDescription = description;
      },
    ),
    setRemoteDescription: vi.fn(
      async (description: RTCSessionDescriptionInit) => {
        rtc.remoteDescription = description;
      },
    ),
  };
  const signal = vi.fn(async () => undefined);
  const error = vi.fn();
  const createPeer = vi.fn(() => rtc as unknown as RTCPeerConnection);
  const peer = new TimbrePeer({
    role,
    configuration: {
      iceServers: [
        {
          urls: "turn:relay.example:3478",
          username: "short-lived",
          credential: "ephemeral",
        },
      ],
      iceTransportPolicy: "relay",
    },
    signal,
    remote: vi.fn(),
    state: vi.fn(),
    error,
    createPeer,
  });
  return { peer, rtc, signal, error, createPeer };
}

afterEach(() => vi.unstubAllGlobals());

describe("Timbre media permissions", () => {
  it("only requests media when called explicitly, with video optional", async () => {
    const { stream } = media();
    const getUserMedia = vi.fn(async () => stream);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    expect(getUserMedia).not.toHaveBeenCalled();
    await requestTimbreMedia("audio");
    expect(getUserMedia).toHaveBeenLastCalledWith({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    });
    await requestTimbreMedia("video");
    expect(getUserMedia).toHaveBeenLastCalledWith(
      expect.objectContaining({
        video: expect.objectContaining({ facingMode: "user" }),
      }),
    );
  });
  it("explains secure-origin and permission errors without requesting a fallback device", async () => {
    vi.stubGlobal("navigator", {});
    await expect(requestTimbreMedia("audio")).rejects.toThrow("HTTPS");
    expect(
      timbreMediaError(new DOMException("denied", "NotAllowedError")),
    ).toContain("Permití");
    expect(
      timbreMediaError(new DOMException("missing", "NotFoundError")),
    ).toContain("No encontramos");
    const { stream, audio, video } = media();
    stopTimbreMedia(stream);
    expect(audio.stop).toHaveBeenCalledOnce();
    expect(video.stop).toHaveBeenCalledOnce();
  });
});

describe("Timbre WebRTC signaling", () => {
  it("offers only for the visitor and retains the authenticated TURN configuration", async () => {
    const { peer, rtc, signal, createPeer } = connection();
    const { stream } = media();
    await peer.start(stream);
    expect(createPeer).toHaveBeenCalledWith(
      expect.objectContaining({ iceTransportPolicy: "relay" }),
    );
    expect(rtc.addTrack).toHaveBeenCalledTimes(2);
    expect(signal).toHaveBeenCalledWith({
      kind: "offer",
      payload: JSON.stringify({ type: "offer", sdp: "visitor-offer" }),
    });
    peer.close();
  });
  it("queues ICE before remote SDP and answers the offer once", async () => {
    const { peer, rtc, signal } = connection("resident");
    await peer.start(media().stream);
    expect(rtc.createOffer).not.toHaveBeenCalled();
    await peer.receive({
      kind: "ice",
      payload: JSON.stringify({
        candidate: "relay-candidate",
        sdpMid: "0",
        sdpMLineIndex: 0,
      }),
    });
    expect(rtc.addIceCandidate).not.toHaveBeenCalled();
    const offer = {
      kind: "offer" as const,
      payload: JSON.stringify({ type: "offer", sdp: "remote-offer" }),
    };
    await peer.receive(offer);
    await peer.receive(offer);
    expect(rtc.setRemoteDescription).toHaveBeenCalledOnce();
    expect(rtc.addIceCandidate).toHaveBeenCalledWith(
      expect.objectContaining({ candidate: "relay-candidate" }),
    );
    expect(signal).toHaveBeenCalledOnce();
    expect(signal).toHaveBeenCalledWith({
      kind: "answer",
      payload: JSON.stringify({ type: "answer", sdp: "owner-answer" }),
    });
    peer.close();
  });
  it("rejects wrong-role SDP and malformed signaling without applying it", async () => {
    const { peer, rtc, error } = connection();
    await peer.start(media().stream);
    await peer.receive({
      kind: "offer",
      payload: JSON.stringify({ type: "offer", sdp: "wrong-peer" }),
    });
    await peer.receive({ kind: "ice", payload: "not-json" });
    await peer.receive({
      kind: "answer",
      payload: JSON.stringify({ type: "offer", sdp: "wrong-type" }),
    });
    expect(error).toHaveBeenCalledTimes(3);
    expect(rtc.setRemoteDescription).not.toHaveBeenCalled();
    peer.close();
  });
  it("closes tracks on constructor failure and disposes a stream delivered after close", async () => {
    const failed = media();
    const peer = new TimbrePeer({
      role: "visitor",
      configuration: {},
      signal: vi.fn(),
      remote: vi.fn(),
      state: vi.fn(),
      error: vi.fn(),
      createPeer: () => {
        throw new Error("WebRTC no disponible");
      },
    });
    await expect(peer.start(failed.stream)).rejects.toThrow(
      "WebRTC no disponible",
    );
    expect(failed.audio.stop).toHaveBeenCalledOnce();
    expect(failed.video.stop).toHaveBeenCalledOnce();
    const late = media();
    await peer.start(late.stream);
    expect(late.audio.stop).toHaveBeenCalledOnce();
  });
  it("toggles local tracks and closes the peer idempotently without more signals", async () => {
    const { peer, rtc, signal } = connection();
    const local = media();
    await peer.start(local.stream);
    peer.mute(true);
    peer.camera(false);
    expect(local.audio.enabled).toBe(false);
    expect(local.video.enabled).toBe(false);
    peer.mute(false);
    peer.camera(true);
    expect(local.audio.enabled).toBe(true);
    expect(local.video.enabled).toBe(true);
    peer.close();
    peer.close();
    await peer.receive({
      kind: "answer",
      payload: JSON.stringify({ type: "answer", sdp: "late-answer" }),
    });
    expect(rtc.close).toHaveBeenCalledOnce();
    expect(local.audio.stop).toHaveBeenCalledOnce();
    expect(rtc.setRemoteDescription).not.toHaveBeenCalled();
    expect(signal).toHaveBeenCalledOnce();
  });
});
