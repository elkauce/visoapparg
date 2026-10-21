import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductHero } from "./viso-products";

const fixture = vi.hoisted(() => {
  const state = { index: 1, reduced: false, hidden: false };
  const events = new Map<string, Set<() => void>>();
  const mediaChanges = new Set<() => void>();
  const emit = (name: string) =>
    events.get(name)?.forEach((callback) => callback());
  const api = {
    selectedScrollSnap: () => state.index,
    canScrollNext: () => true,
    scrollNext: vi.fn(() => {
      state.index = (state.index + 1) % 3;
      emit("select");
    }),
    scrollPrev: vi.fn(() => {
      state.index = (state.index + 2) % 3;
      emit("select");
    }),
    scrollTo: vi.fn((index: number) => {
      state.index = index;
      emit("select");
    }),
    on: vi.fn((name: string, callback: () => void) => {
      if (!events.has(name)) events.set(name, new Set());
      events.get(name)!.add(callback);
      return api;
    }),
    off: vi.fn((name: string, callback: () => void) => {
      events.get(name)?.delete(callback);
      return api;
    }),
  };
  return { state, events, mediaChanges, api, emit, viewport: vi.fn() };
});

vi.mock("embla-carousel-react", () => ({
  default: () => [fixture.viewport, fixture.api],
}));
vi.mock("motion/react", () => ({
  useReducedMotion: () => fixture.state.reduced,
}));

function advance(milliseconds: number) {
  act(() => vi.advanceTimersByTime(milliseconds));
}
function resize(width: number) {
  act(() => {
    window.innerWidth = width;
    fixture.mediaChanges.forEach((callback) => callback());
  });
}
function selected(name: string) {
  expect(
    screen.getByRole("button", { name: `Mostrar VISO ${name}` }),
  ).toHaveAttribute("aria-pressed", "true");
}

beforeEach(() => {
  vi.useFakeTimers();
  fixture.state.index = 1;
  fixture.state.reduced = false;
  fixture.state.hidden = false;
  fixture.events.clear();
  fixture.mediaChanges.clear();
  fixture.api.scrollNext.mockClear();
  fixture.api.scrollPrev.mockClear();
  fixture.api.scrollTo.mockClear();
  window.innerWidth = 390;
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => fixture.state.hidden,
  });
  vi.stubGlobal("IntersectionObserver", undefined);
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("max-width") && window.innerWidth < 768,
      media: query,
      addEventListener: (_name: string, callback: () => void) =>
        fixture.mediaChanges.add(callback),
      removeEventListener: (_name: string, callback: () => void) =>
        fixture.mediaChanges.delete(callback),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("mobile product carousel autoplay", () => {
  it("cycles through all three products every five seconds and preserves the selected state color", () => {
    const view = render(<ProductHero color="#22c55e" />);
    selected("Display");
    advance(4999);
    selected("Display");
    advance(1);
    selected("Matrix");
    advance(5000);
    selected("Mini");
    view.rerender(<ProductHero color="#ef4444" />);
    advance(5000);
    selected("Display");
    expect(
      screen.getByRole("region", { name: "Productos VISO" }),
    ).toHaveAttribute("data-state-color", "#ef4444");
  });

  it("keeps touch navigation and resumes automatically even while a tapped dot retains focus", () => {
    render(<ProductHero color="#22c55e" />);
    advance(4000);
    const dot = screen.getByRole("button", { name: "Mostrar VISO Mini" });
    fireEvent.pointerDown(dot);
    act(() => dot.focus());
    fireEvent.click(dot);
    selected("Mini");
    expect(dot).toHaveFocus();
    advance(4999);
    selected("Mini");
    advance(1);
    selected("Display");
    fireEvent.click(screen.getByRole("button", { name: "Producto anterior" }));
    selected("Mini");
  });

  it("does not advance during a swipe and gives a complete delay after the gesture", () => {
    render(<ProductHero color="#22c55e" />);
    advance(4000);
    act(() => fixture.emit("pointerDown"));
    advance(15000);
    selected("Display");
    act(() => {
      fixture.state.index = 2;
      fixture.emit("select");
      fixture.emit("pointerUp");
    });
    selected("Matrix");
    advance(4999);
    selected("Matrix");
    advance(1);
    selected("Mini");
  });

  it("pauses for keyboard navigation and resumes after focus leaves", () => {
    render(<ProductHero color="#22c55e" />);
    const next = screen.getByRole("button", { name: "Producto siguiente" });
    fireEvent.keyDown(document, { key: "Tab" });
    act(() => next.focus());
    advance(15000);
    selected("Display");
    fireEvent.blur(next, { relatedTarget: document.body });
    advance(5000);
    selected("Matrix");
  });

  it("lets the user pause and explicitly resume while the playback control has focus", () => {
    render(<ProductHero color="#22c55e" />);
    const pause = screen.getByRole("button", {
      name: "Pausar carrusel automático",
    });
    act(() => pause.focus());
    fireEvent.click(pause);
    advance(15000);
    selected("Display");
    const resume = screen.getByRole("button", {
      name: "Reanudar carrusel automático",
    });
    expect(resume).toHaveFocus();
    fireEvent.click(resume);
    advance(5000);
    selected("Matrix");
  });

  it("pauses in a hidden tab and resumes with a complete delay", () => {
    render(<ProductHero color="#22c55e" />);
    advance(4000);
    fixture.state.hidden = true;
    fireEvent(document, new Event("visibilitychange"));
    advance(15000);
    selected("Display");
    fixture.state.hidden = false;
    fireEvent(document, new Event("visibilitychange"));
    advance(4999);
    selected("Display");
    advance(1);
    selected("Matrix");
  });

  it("does not advance while the carousel is outside the viewport", () => {
    let intersect:
      ((entries: { isIntersecting: boolean }[]) => void) | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: typeof intersect) {
          intersect = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const view = render(<ProductHero color="#22c55e" />);
    act(() => intersect?.([{ isIntersecting: false }]));
    advance(15000);
    selected("Display");
    act(() => intersect?.([{ isIntersecting: true }]));
    advance(5000);
    selected("Matrix");
    view.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("honors reduced motion while leaving manual controls available", () => {
    fixture.state.reduced = true;
    render(<ProductHero color="#22c55e" />);
    advance(15000);
    selected("Display");
    expect(
      screen.queryByRole("button", { name: "Pausar carrusel automático" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Producto siguiente" }));
    selected("Matrix");
  });

  it("only autoplays at the mobile breakpoint and stops when returning to desktop", () => {
    window.innerWidth = 1024;
    render(<ProductHero color="#22c55e" />);
    advance(15000);
    selected("Display");
    resize(767);
    advance(5000);
    selected("Matrix");
    resize(768);
    advance(15000);
    selected("Matrix");
  });
});
