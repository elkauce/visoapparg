import { afterEach, it, expect, vi } from "vitest";
import { render, fireEvent, act, cleanup } from "@testing-library/react";
import { useDeckIdle } from "./use-deck-idle";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const base = {
  enabled: true,
  mainPageId: "main",
  restPageId: "music",
  seconds: 3,
};
it("keeps manual mode unchanged, changes to rest on idle and consumes only the wake gesture", () => {
  vi.useFakeTimers();
  const page = vi.fn(),
    action = vi.fn();
  function App({ enabled }: { enabled: boolean }) {
    const idle = useDeckIdle(
      { ...base, enabled },
      ["main", "music"],
      false,
      page,
      () => {},
    );
    return (
      <div {...idle}>
        <button onClick={action}>Key</button>
      </div>
    );
  }
  const view = render(<App enabled={false} />);
  act(() => vi.advanceTimersByTime(5000));
  expect(page).not.toHaveBeenCalled();
  view.rerender(<App enabled />);
  act(() => vi.advanceTimersByTime(3000));
  expect(page).toHaveBeenLastCalledWith("music");
  fireEvent.pointerDown(view.getByText("Key"));
  fireEvent.pointerUp(view.getByText("Key"));
  fireEvent.click(view.getByText("Key"));
  expect(page).toHaveBeenLastCalledWith("main");
  expect(action).not.toHaveBeenCalled();
  fireEvent.pointerDown(view.getByText("Key"));
  fireEvent.pointerUp(view.getByText("Key"));
  fireEvent.click(view.getByText("Key"));
  expect(action).toHaveBeenCalledTimes(1);
});
it("pauses for settings/editing and has an accessible long-press exit", () => {
  vi.useFakeTimers();
  const page = vi.fn(),
    configure = vi.fn();
  function App({ blocked = false }: { blocked?: boolean }) {
    const idle = useDeckIdle(base, ["main", "music"], blocked, page, configure);
    return (
      <div {...idle}>
        <button>Key</button>
      </div>
    );
  }
  const view = render(<App blocked />);
  act(() => vi.advanceTimersByTime(6000));
  expect(page).not.toHaveBeenCalled();
  view.rerender(<App />);
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  document.body.append(dialog);
  act(() => vi.advanceTimersByTime(3000));
  expect(page).not.toHaveBeenCalled();
  dialog.remove();
  act(() => vi.advanceTimersByTime(3000));
  expect(page).toHaveBeenLastCalledWith("music");
  fireEvent.pointerDown(view.getByText("Key"));
  act(() => vi.advanceTimersByTime(900));
  expect(configure).toHaveBeenCalledTimes(1);
  fireEvent.pointerUp(view.getByText("Key"));
});
it("does not activate a deleted or identical rest page", () => {
  vi.useFakeTimers();
  const page = vi.fn();
  function App() {
    const idle = useDeckIdle(base, ["main"], false, page, () => {});
    return <div {...idle} />;
  }
  render(<App />);
  act(() => vi.advanceTimersByTime(10000));
  expect(page).not.toHaveBeenCalled();
});
