import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TimbreVisitorPage from "./visitor";

const fixture = vi.hoisted(() => ({
  qr: null as null | Record<string, unknown>,
  rtc: true,
  session: null as null | Record<string, unknown>,
  mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
  query: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: (
    reference: Parameters<typeof getFunctionName>[0],
    args: unknown,
  ) => {
    const name = getFunctionName(reference);
    fixture.query(name, args);
    if (args === "skip") return undefined;
    if (name === "timbre:publicQr") return fixture.qr;
    if (name === "timbre_calls:rtcAvailability")
      return { available: fixture.rtc };
    if (name === "timbre_calls:session") return fixture.session;
    return [];
  },
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference);
    fixture.mutations[name] ??= vi.fn(async () =>
      name === "timbre_calls:startCall"
        ? { callId: "call-1", visitorToken: "private-capability" }
        : {},
    );
    return fixture.mutations[name];
  },
  useAction: () => vi.fn(),
}));
vi.mock("@/components/ui/signin", () => ({
  SignInButton: () => <button>Entrar</button>,
}));

function show() {
  return render(
    <MemoryRouter initialEntries={["/t/opaque-qr"]}>
      <Routes>
        <Route path="/t/:qr" element={<TimbreVisitorPage />} />
      </Routes>
    </MemoryRouter>,
  );
}
function media() {
  const stop = vi.fn();
  return {
    stop,
    stream: {
      getTracks: () => [{ stop }],
      getVideoTracks: () => [],
      getAudioTracks: () => [],
    } as unknown as MediaStream,
  };
}
beforeEach(() => {
  sessionStorage.clear();
  fixture.qr = {
    label: "Entrada principal",
    siteName: "Oficina VISO",
    kind: "office",
    units: [],
    audioEnabled: true,
    videoEnabled: true,
    chatEnabled: true,
    messagesEnabled: true,
    available: true,
    reason: "available",
  };
  fixture.rtc = true;
  fixture.session = {
    siteName: "Oficina VISO",
    mode: "audio",
    status: "ringing",
    role: "visitor",
    chatEnabled: true,
    messagesEnabled: true,
    acceptedByMe: false,
  };
  fixture.mutations = {};
  fixture.query.mockClear();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Timbre public visitor", () => {
  it("needs no account and requests no devices until a call gesture", () => {
    const getUserMedia = vi.fn();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    show();
    expect(
      screen.getByRole("heading", { name: "Oficina VISO" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Entrar" }),
    ).not.toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(fixture.query).toHaveBeenCalledWith("timbre:publicQr", {
      qrToken: "opaque-qr",
    });
  });
  it("does not request media or start a call while TURN is unconfigured", () => {
    fixture.rtc = false;
    const getUserMedia = vi.fn();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    show();
    expect(screen.getByRole("button", { name: "Llamar" })).toBeDisabled();
    expect(
      screen.getByText(/administrador debe configurar/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir chat" })).toBeEnabled();
    expect(getUserMedia).not.toHaveBeenCalled();
  });
  it("keeps the call token out of the URL and closes captured tracks on cancellation", async () => {
    const user = userEvent.setup();
    const captured = media();
    const getUserMedia = vi.fn(async () => captured.stream);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    show();
    await user.click(screen.getByRole("button", { name: "Llamar" }));
    await screen.findByRole("button", { name: "Cancelar" });
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(fixture.mutations["timbre_calls:startCall"]).toHaveBeenCalledWith(
      expect.objectContaining({
        qrToken: "opaque-qr",
        mode: "audio",
        visitorNonce: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(screen.queryByText("private-capability")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(captured.stop).toHaveBeenCalled());
    expect(fixture.mutations["timbre_calls:end"]).toHaveBeenCalledWith({
      callId: "call-1",
      visitorToken: "private-capability",
    });
  });
  it("does not start a backend call after microphone permission is denied", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn(async () => {
          throw new DOMException("denied", "NotAllowedError");
        }),
      },
    });
    show();
    await user.click(screen.getByRole("button", { name: "Llamar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Permití usar el micrófono",
    );
    expect(fixture.mutations["timbre_calls:startCall"]).not.toHaveBeenCalled();
  });
  it("stops a late permission result after leaving the visitor page", async () => {
    const user = userEvent.setup();
    const captured = media();
    let deliver!: (stream: MediaStream) => void;
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn(
          () =>
            new Promise<MediaStream>((resolve) => {
              deliver = resolve;
            }),
        ),
      },
    });
    const view = show();
    await user.click(screen.getByRole("button", { name: "Llamar" }));
    view.unmount();
    deliver(captured.stream);
    await waitFor(() => expect(captured.stop).toHaveBeenCalled());
    expect(fixture.mutations["timbre_calls:startCall"]).not.toHaveBeenCalled();
  });
  it("requires a building unit and permits plan-enabled messages outside the schedule", async () => {
    fixture.qr = {
      ...fixture.qr,
      kind: "building",
      units: [{ id: "unit-2", name: "Piso 2 B" }],
      available: false,
      reason: "outside_schedule",
      absenceMessage: "Volvemos mañana.",
    };
    const user = userEvent.setup();
    show();
    expect(screen.getByText("Volvemos mañana.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dejar un mensaje" }));
    await user.type(
      screen.getByRole("textbox", { name: "Tu mensaje" }),
      "Pasé a entregar el paquete.",
    );
    expect(
      screen.getByRole("button", { name: "Enviar mensaje" }),
    ).toBeDisabled();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "¿A quién visitás?" }),
      "unit-2",
    );
    await user.click(screen.getByRole("button", { name: "Enviar mensaje" }));
    expect(await screen.findByText(/Mensaje enviado/)).toBeInTheDocument();
    expect(fixture.mutations["timbre_calls:leaveMessage"]).toHaveBeenCalledWith(
      expect.objectContaining({
        qrToken: "opaque-qr",
        unitId: "unit-2",
        text: "Pasé a entregar el paquete.",
      }),
    );
  });
  it("does not expose controls for an invalid or unlicensed QR", () => {
    fixture.qr = null;
    show();
    expect(
      screen.getByRole("heading", { name: "Este timbre no está disponible" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Llamar" }),
    ).not.toBeInTheDocument();
    expect(fixture.query).toHaveBeenCalledWith(
      "timbre_calls:rtcAvailability",
      "skip",
    );
  });
  it("retains only the per-QR anti-abuse nonce across a page reload, never the call capability", async () => {
    const user = userEvent.setup();
    const captured = media();
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn(async () => captured.stream) },
    });
    const first = show();
    await user.click(screen.getByRole("button", { name: "Llamar" }));
    await screen.findByRole("button", { name: "Cancelar" });
    const nonce =
      fixture.mutations["timbre_calls:startCall"].mock.calls[0][0].visitorNonce;
    first.unmount();
    show();
    await user.click(screen.getByRole("button", { name: "Llamar" }));
    await screen.findByRole("button", { name: "Cancelar" });
    expect(
      fixture.mutations["timbre_calls:startCall"].mock.calls[1][0],
    ).toHaveProperty("visitorNonce", nonce);
    expect(sessionStorage.getItem("viso:timbre:visit:opaque-qr")).toBe(nonce);
    expect(Object.values(sessionStorage)).not.toContain("private-capability");
  });
});
