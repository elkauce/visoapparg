import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DeckPage from "./page.tsx";

const state = vi.hoisted(() => ({
  layout: null as unknown,
  statuses: null as unknown,
  connected: true,
  mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
  error: vi.fn(),
  native: false,
  enter: vi.fn(),
  exit: vi.fn(),
  openUrl: vi.fn(),
  media: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference);
    return name === "deck_layout:get"
      ? state.layout
      : name === "statuses:list"
        ? state.statuses
        : null;
  },
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference);
    state.mutations[name] ??= vi.fn(async () => null);
    return state.mutations[name];
  },
  useConvexConnectionState: () => ({
    isWebSocketConnected: state.connected,
    hasEverConnected: true,
  }),
}));
vi.mock("@convex-dev/auth/react", () => ({ useAuthToken: () => "test-token" }));
vi.mock("sonner", () => ({
  toast: { error: state.error, info: vi.fn(), success: vi.fn() },
}));
vi.mock("@/lib/android-native.ts", () => ({
  isAndroidNative: () => state.native,
  immersive: { enter: state.enter, exit: state.exit },
  actions: { openUrl: state.openUrl, openApp: vi.fn(), media: state.media },
  nativeDeck: {
    getDeviceId: vi.fn(async () => "test-device-id"),
    getHomeAssistantLights: vi.fn(async () => []),
    controlLight: vi.fn(),
  },
}));
vi.mock("./_components/sports-dialog.tsx", () => ({ default: () => null }));

const page = { _id: "page1", userId: "user1", name: "Principal", order: 0 };
const fixture = {
  pages: [page],
  keys: [
    {
      _id: "key1",
      pageId: "page1",
      position: 0,
      content: { kind: "status", statusId: "free" },
    },
    {
      _id: "key2",
      pageId: "page1",
      position: 1,
      content: { kind: "status", statusId: "busy" },
    },
    { _id: "key3", pageId: "page1", position: 6, content: { kind: "off" } },
  ],
  volume: 0,
};
const statuses = {
  statuses: [
    { _id: "free", name: "Libre", color: "#22c55e", icon: "check-circle" },
    { _id: "busy", name: "Ocupado", color: "#ef4444", icon: "ban" },
  ],
  activeStatusId: "free",
};

function openDeck() {
  return render(
    <MemoryRouter>
      <DeckPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubEnv("VITE_ANDROID_DECK_EXTENSIONS", "false");
  state.layout = structuredClone(fixture);
  state.statuses = structuredClone(statuses);
  state.connected = true;
  state.native = false;
  state.mutations = {};
  vi.clearAllMocks();
  state.enter.mockResolvedValue(undefined);
  state.exit.mockResolvedValue(undefined);
  state.openUrl.mockResolvedValue(undefined);
  state.media.mockResolvedValue(undefined);
  localStorage.clear();
});
afterEach(() => vi.unstubAllEnvs());

describe("Deck real synchronisation and legacy compatibility", () => {
  it("keeps the original order, active colour and empty slots without changing existing data", () => {
    const { container } = openDeck();
    const buttons = screen
      .getAllByRole("button")
      .filter((button) =>
        ["Libre", "Ocupado", "Apagar"].includes(
          button.getAttribute("aria-label") ?? "",
        ),
      );
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Libre",
      "Ocupado",
      "Apagar",
    ]);
    expect(screen.getByRole("button", { name: "Libre" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Libre" })).toHaveStyle({
      backgroundColor: "#22c55e",
    });
    expect(container.querySelector("main > div")?.children).toHaveLength(15);
    expect(
      screen.queryByRole("button", { name: "Agregar tecla" }),
    ).not.toBeInTheDocument();
    expect(state.mutations["deck_layout:ensureDefault"]).not.toHaveBeenCalled();
    expect(state.mutations["statuses:createDefaults"]).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });

  it("does not duplicate taps or locally pretend a state was confirmed", async () => {
    let acknowledge!: () => void;
    state.mutations["statuses:setActive"] = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          acknowledge = resolve;
        }),
    );
    const rendered = openDeck();
    const busy = screen.getByRole("button", { name: "Ocupado" });
    fireEvent.click(busy);
    fireEvent.click(busy);
    expect(state.mutations["statuses:setActive"]).toHaveBeenCalledTimes(1);
    expect(state.mutations["statuses:setActive"]).toHaveBeenCalledWith({
      statusId: "busy",
    });
    expect(busy).toHaveAttribute("aria-pressed", "false");
    expect(busy).toBeDisabled();
    await act(async () => acknowledge());
    expect(busy).toHaveAttribute("aria-pressed", "false");
    state.statuses = { ...statuses, activeStatusId: "busy" };
    rendered.rerender(
      <MemoryRouter>
        <DeckPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Ocupado" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Libre" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("reflects external state changes and reconnects without enqueueing offline presses", () => {
    state.connected = false;
    const rendered = openDeck();
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Reconectando con VISO",
    );
    fireEvent.click(screen.getByRole("button", { name: "Ocupado" }));
    expect(state.mutations["statuses:setActive"]).not.toHaveBeenCalled();
    state.connected = true;
    state.statuses = { ...statuses, activeStatusId: "busy" };
    rendered.rerender(
      <MemoryRouter>
        <DeckPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Conectado a VISO",
    );
    expect(screen.getByRole("button", { name: "Ocupado" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(state.mutations["statuses:setActive"]).not.toHaveBeenCalled();
  });

  it("preserves all configured positions when a user chooses six keys per view", () => {
    localStorage.setItem(
      "viso:deck:grid:user1:page1",
      JSON.stringify({ slots: 6, columns: 3 }),
    );
    openDeck();
    expect(
      screen.queryByRole("button", { name: "Apagar" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Vista siguiente" }));
    expect(screen.getByRole("button", { name: "Apagar" })).toBeInTheDocument();
    expect(state.mutations["deck_layout:configurePage"]).not.toHaveBeenCalled();
  });

  it("prepares a new empty account only after an explicit action and awaits statuses first", async () => {
    const sequence: string[] = [];
    state.layout = { pages: [], keys: [], volume: 0 };
    state.statuses = { statuses: [], activeStatusId: null };
    state.mutations["statuses:createDefaults"] = vi.fn(async () => {
      sequence.push("statuses");
    });
    state.mutations["deck_layout:ensureDefault"] = vi.fn(async () => {
      sequence.push("page");
    });
    openDeck();
    expect(sequence).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Preparar Deck" }));
    await waitFor(() => expect(sequence).toEqual(["statuses", "page"]));
  });

  it("keeps the existing web link behavior even though native actions require Android", async () => {
    state.layout = {
      ...fixture,
      keys: [
        {
          _id: "link1",
          pageId: "page1",
          position: 0,
          content: {
            kind: "link",
            label: "VISO",
            url: "https://visoapparg.vercel.app",
            icon: "globe",
            color: "#0ea5e9",
          },
        },
      ],
    };
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    openDeck();
    fireEvent.click(screen.getByRole("button", { name: "VISO" }));
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(
        "https://visoapparg.vercel.app/",
        "_blank",
        "noopener,noreferrer",
      ),
    );
    expect(state.openUrl).not.toHaveBeenCalled();
  });

  it("exits native immersive mode on Android Back before leaving the Deck", async () => {
    state.native = true;
    openDeck();
    fireEvent.click(screen.getByRole("button", { name: "Pantalla completa" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Salir de pantalla completa" }),
      ).toBeInTheDocument(),
    );
    const event = new Event("viso:android-back", { cancelable: true });
    await act(async () => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(state.exit).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Pantalla completa" }),
    ).toBeInTheDocument();
  });

  it("cancels key editing without writing and uses only supported arguments for legacy saves", async () => {
    openDeck();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Libre" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(state.mutations["deck_layout:setKey"]).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Libre" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(state.mutations["deck_layout:setKey"]).toHaveBeenCalledWith({
        pageId: "page1",
        position: 0,
        content: { kind: "status", statusId: "free" },
      }),
    );
    expect(state.mutations["deck_layout:moveKey"]).not.toHaveBeenCalled();
  });

  it("edits and moves an existing advanced key atomically with a stale-position guard", async () => {
    vi.stubEnv("VITE_ANDROID_DECK_EXTENSIONS", "true");
    openDeck();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Libre" }));
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Disponible" },
    });
    fireEvent.change(screen.getByLabelText("Posición (1–15)"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(state.mutations["deck_layout:moveKey"]).toHaveBeenCalledWith({
        keyId: "key1",
        pageId: "page1",
        position: 4,
        swap: false,
        from: { pageId: "page1", position: 0 },
        content: { kind: "status", statusId: "free" },
        appearance: {
          label: "Disponible",
          icon: "check-circle",
          color: "#22c55e",
        },
      }),
    );
    expect(state.mutations["deck_layout:setKey"]).not.toHaveBeenCalled();
  });

  it("guards repeated editor saves until the backend confirms the first mutation", async () => {
    let acknowledge!: () => void;
    state.mutations["deck_layout:setKey"] = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          acknowledge = resolve;
        }),
    );
    openDeck();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Libre" }));
    const save = screen.getByRole("button", { name: "Guardar" });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(state.mutations["deck_layout:setKey"]).toHaveBeenCalledTimes(1);
    expect(save).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    await act(async () => acknowledge());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
