import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TimbreCallPage, { TimbreMessages } from "./call-session";
import type { Id } from "@/convex/_generated/dataModel";

const fixture = vi.hoisted(() => ({
  authenticated: true,
  session: {} as Record<string, unknown>,
  signals: [] as Array<Record<string, unknown>>,
  offline: [] as Array<Record<string, unknown>>,
  mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
  query: vi.fn(),
  rtc: vi.fn(async () => ({
    iceServers: [{ urls: "turn:relay.example" }],
    iceTransportPolicy: "relay",
  })),
  peerStart: vi.fn(async () => undefined),
  peerClose: vi.fn(),
  peerReceive: vi.fn(),
  peerMute: vi.fn(),
  peerCamera: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isAuthenticated: fixture.authenticated,
    isLoading: false,
  }),
  useQuery: (
    reference: Parameters<typeof getFunctionName>[0],
    args: unknown,
  ) => {
    const name = getFunctionName(reference);
    fixture.query(name, args);
    if (args === "skip") return undefined;
    if (name === "timbre_calls:session") return fixture.session;
    if (name === "timbre_calls:signals") return fixture.signals;
    if (name === "timbre_calls:messages") return fixture.offline;
    return [];
  },
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference);
    fixture.mutations[name] ??= vi.fn(async () => {
      if (name === "timbre_calls:accept")
        fixture.session = {
          ...fixture.session,
          status: "accepted",
          acceptedByMe: true,
        };
      return {};
    });
    return fixture.mutations[name];
  },
  useAction: () => fixture.rtc,
}));
vi.mock("@/components/ui/signin", () => ({
  SignInButton: () => <button>Entrar para atender</button>,
}));
vi.mock("@/lib/timbre-peer", async (original) => {
  const actual = await original<typeof import("@/lib/timbre-peer")>();
  return {
    ...actual,
    TimbrePeer: class {
      start = fixture.peerStart;
      close = fixture.peerClose;
      receive = fixture.peerReceive;
      mute = fixture.peerMute;
      camera = fixture.peerCamera;
    },
  };
});

function show() {
  return render(
    <MemoryRouter initialEntries={["/timbre/call/call-1"]}>
      <Routes>
        <Route path="/timbre/call/:callId" element={<TimbreCallPage />} />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  fixture.authenticated = true;
  fixture.session = {
    siteName: "Casa VISO",
    mode: "video",
    status: "ringing",
    role: "owner",
    acceptedByMe: false,
    chatEnabled: true,
    messagesEnabled: true,
  };
  fixture.signals = [];
  fixture.offline = [];
  fixture.mutations = {};
  fixture.query.mockClear();
  fixture.rtc.mockClear();
  fixture.peerStart.mockClear();
  fixture.peerClose.mockClear();
  fixture.peerReceive.mockClear();
  fixture.peerMute.mockClear();
  fixture.peerCamera.mockClear();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Resident Timbre call", () => {
  it("requires account access before reading an owner call", () => {
    fixture.authenticated = false;
    show();
    expect(
      screen.getByRole("button", { name: "Entrar para atender" }),
    ).toBeInTheDocument();
    expect(fixture.query).not.toHaveBeenCalled();
  });
  it("captures on answer, processes signaling once, and closes tracks on hangup", async () => {
    const user = userEvent.setup();
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    const getUserMedia = vi.fn(async () => stream);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    fixture.signals = [
      { id: "signal-1", kind: "offer", payload: "remote-offer" },
    ];
    const view = show();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("textbox", { name: "Mensaje" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Atender" }));
    await waitFor(() => expect(fixture.peerStart).toHaveBeenCalledWith(stream));
    expect(fixture.mutations["timbre_calls:accept"]).toHaveBeenCalledWith({
      callId: "call-1",
    });
    await waitFor(() => expect(fixture.peerReceive).toHaveBeenCalledOnce());
    view.rerender(
      <MemoryRouter initialEntries={["/timbre/call/call-1"]}>
        <Routes>
          <Route path="/timbre/call/:callId" element={<TimbreCallPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(fixture.peerReceive).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Silenciar" }));
    expect(fixture.peerMute).toHaveBeenCalledWith(true);
    await user.click(screen.getByRole("button", { name: "Finalizar" }));
    expect(fixture.mutations["timbre_calls:end"]).toHaveBeenCalledWith({
      callId: "call-1",
    });
    expect(stop).toHaveBeenCalled();
    expect(fixture.peerClose).toHaveBeenCalled();
    expect(screen.getByText("Comunicación finalizada")).toBeInTheDocument();
  });
  it("releases captured media if another recipient accepted first", async () => {
    const user = userEvent.setup();
    const stop = vi.fn();
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop }] })),
      },
    });
    fixture.mutations["timbre_calls:accept"] = vi.fn(async () => {
      throw new Error("Otra persona atendió esta llamada.");
    });
    show();
    await user.click(screen.getByRole("button", { name: "Atender" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Otra persona atendió",
    );
    expect(stop).toHaveBeenCalled();
    expect(fixture.rtc).not.toHaveBeenCalled();
  });
  it("accepts and sends a chat message without device permissions or TURN", async () => {
    fixture.session = { ...fixture.session, mode: "chat" };
    const getUserMedia = vi.fn();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Atender" }));
    await user.type(
      await screen.findByRole("textbox", { name: "Mensaje" }),
      "Ya bajo.",
    );
    await user.click(screen.getByRole("button", { name: "Enviar mensaje" }));
    expect(fixture.mutations["timbre_calls:sendMessage"]).toHaveBeenCalledWith({
      callId: "call-1",
      text: "Ya bajo.",
    });
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(fixture.rtc).not.toHaveBeenCalled();
  });
  it("does not start media or display chat for a call won by another account", () => {
    fixture.session = {
      ...fixture.session,
      status: "accepted",
      acceptedByMe: false,
    };
    show();
    expect(
      screen.getByText("Ya atendieron en otro dispositivo"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Atender" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Mensaje" }),
    ).not.toBeInTheDocument();
    expect(fixture.query).toHaveBeenCalledWith("timbre_calls:signals", "skip");
    expect(fixture.rtc).not.toHaveBeenCalled();
  });
  it("does not end a call answered on another device of the same account just by opening and leaving its history", () => {
    fixture.session = {
      ...fixture.session,
      status: "accepted",
      acceptedByMe: true,
    };
    const view = show();
    expect(
      screen.getByText("La comunicación ya fue atendida con tu cuenta"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Finalizar comunicación" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Silenciar" }),
    ).not.toBeInTheDocument();
    expect(fixture.query).toHaveBeenCalledWith("timbre_calls:signals", "skip");
    expect(fixture.rtc).not.toHaveBeenCalled();
    view.unmount();
    expect(fixture.mutations["timbre_calls:end"]).not.toHaveBeenCalled();
    expect(fixture.mutations["timbre_calls:heartbeat"]).not.toHaveBeenCalled();
  });
  it("does not reuse a previous call's media or acceptance when navigating to another call", async () => {
    const user = userEvent.setup();
    const stop = vi.fn();
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop }] })),
      },
    });
    const view = render(
      <MemoryRouter initialEntries={["/timbre/call/call-1"]}>
        <Link to="/timbre/call/call-2">Otra llamada</Link>
        <Routes>
          <Route path="/timbre/call/:callId" element={<TimbreCallPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Atender" }));
    await waitFor(() => expect(fixture.peerStart).toHaveBeenCalledOnce());
    await user.click(screen.getByRole("link", { name: "Otra llamada" }));
    expect(
      screen.getByText("La comunicación ya fue atendida con tu cuenta"),
    ).toBeInTheDocument();
    expect(fixture.peerStart).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalled();
    expect(fixture.mutations["timbre_calls:end"]).toHaveBeenCalledWith({
      callId: "call-1",
    });
    view.unmount();
    expect(fixture.mutations["timbre_calls:end"]).not.toHaveBeenCalledWith({
      callId: "call-2",
    });
  });
});

describe("Offline visitor messages", () => {
  it("does not query a disabled messages capability", () => {
    render(
      <TimbreMessages siteId={"site-1" as Id<"timbreSites">} enabled={false} />,
    );
    expect(fixture.query).toHaveBeenCalledWith("timbre_calls:messages", "skip");
    expect(screen.getByText(/mensajes están desactivados/)).toBeInTheDocument();
  });
  it("shows the correct unit and escapes visitor text", () => {
    fixture.offline = [
      {
        id: "message-1",
        unitId: "unit-b",
        text: "<script>Hola</script>",
        createdAt: Date.UTC(2026, 9, 22, 12),
      },
    ];
    const view = render(
      <TimbreMessages
        siteId={"site-1" as Id<"timbreSites">}
        unitNames={{ "unit-b": "2 B" }}
      />,
    );
    expect(screen.getByText("2 B")).toBeInTheDocument();
    expect(screen.getByText("<script>Hola</script>")).toBeInTheDocument();
    expect(view.container.querySelector("script")).toBeNull();
  });
});
