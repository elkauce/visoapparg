import {
  Children,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Gesture = {
  pointerId: number;
  x: number;
  y: number;
  time: number;
  dragging: boolean;
};

type DeckSlideProps = {
  index: number;
  pageKeys: readonly string[];
  onIndexChange(index: number): void;
  label: string;
  children: ReactNode;
};

const EXCLUDED_CONTROLS =
  "input, textarea, select, [role='slider'], [role='dialog'], [contenteditable='true'], [data-deck-slide-ignore]";

/** User-driven pager. A rightward drag reveals the next numbered page. */
export default function DeckSlide({
  index,
  pageKeys,
  onIndexChange,
  label,
  children,
}: DeckSlideProps) {
  const viewport = useRef<HTMLElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const blockedClick = useRef(false);
  const pendingIndex = useRef<number | null>(null);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phase = useRef<"idle" | "dragging" | "settling">("idle");
  const [offset, setOffset] = useState(0);
  const [animated, setAnimated] = useState(false);
  const finishRef = useRef<() => void>(() => undefined);
  const pages = Children.toArray(children);

  function clearFinishTimer() {
    if (finishTimer.current !== null) clearTimeout(finishTimer.current);
    finishTimer.current = null;
  }

  function releasePointer() {
    const current = gesture.current;
    gesture.current = null;
    if (current && viewport.current?.hasPointerCapture?.(current.pointerId)) {
      viewport.current.releasePointerCapture(current.pointerId);
    }
  }

  function finish() {
    if (phase.current !== "settling") return;
    clearFinishTimer();
    const next = pendingIndex.current;
    pendingIndex.current = null;
    phase.current = "idle";
    setAnimated(false);
    setOffset(0);
    if (next !== null) onIndexChange(next);
  }
  useLayoutEffect(() => {
    finishRef.current = finish;
  });

  function settle(target: number, next: number | null) {
    phase.current = "settling";
    pendingIndex.current = next;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    setAnimated(true);
    setOffset(target);
    clearFinishTimer();
    // Only complete an animation started by a user's gesture, never autoplay.
    finishTimer.current = setTimeout(() => finishRef.current(), 280);
  }

  function cancelGesture() {
    if (gesture.current) blockedClick.current = true;
    if (phase.current !== "dragging") {
      releasePointer();
      return;
    }
    blockedClick.current = true;
    releasePointer();
    settle(0, null);
  }

  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const reset = () => {
      const current = gesture.current;
      gesture.current = null;
      if (current?.dragging) blockedClick.current = true;
      if (current && node.hasPointerCapture?.(current.pointerId))
        node.releasePointerCapture(current.pointerId);
      clearFinishTimer();
      pendingIndex.current = null;
      phase.current = "idle";
      setAnimated(false);
      setOffset(0);
    };
    reset();
    const observer = new ResizeObserver(reset);
    observer.observe(node);
    const preventHorizontalScroll = (event: TouchEvent) => {
      // Cancelling PointerEvent alone does not cancel native touch scrolling.
      // Stop a recognized slide from starting a fling that consumes the next tap.
      if (gesture.current?.dragging && event.cancelable) event.preventDefault();
    };
    node.addEventListener("touchmove", preventHorizontalScroll, {
      passive: false,
    });
    window.addEventListener("blur", reset);
    return () => {
      observer.disconnect();
      node.removeEventListener("touchmove", preventHorizontalScroll);
      window.removeEventListener("blur", reset);
      clearFinishTimer();
      gesture.current = null;
    };
  }, [index, pageKeys.length]);

  const next = (index + 1) % pageKeys.length;
  const previous = (index + pageKeys.length - 1) % pageKeys.length;
  const order = [next, index, previous];

  return (
    <main
      ref={viewport}
      aria-label={label}
      aria-roledescription="carrusel"
      aria-describedby="viso-deck-slide-instructions"
      tabIndex={0}
      className="relative min-h-0 min-w-0 flex-1 overflow-hidden outline-none"
      style={{ touchAction: "pan-y", overscrollBehaviorX: "none" }}
      onPointerDown={(event) => {
        // Dialog portals still bubble through React; they are not pager content.
        if (!event.currentTarget.contains(event.target as Node)) return;
        if (!event.isPrimary) {
          cancelGesture();
          return;
        }
        if (event.pointerType === "mouse" && event.button !== 0) return;
        if (phase.current === "settling") {
          blockedClick.current = true;
          return;
        }
        blockedClick.current = false;
        if (
          event.target instanceof Element &&
          event.target.closest(EXCLUDED_CONTROLS)
        )
          return;
        gesture.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          time: event.timeStamp,
          dragging: false,
        };
      }}
      onPointerMove={(event) => {
        const current = gesture.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const dx = event.clientX - current.x;
        const dy = event.clientY - current.y;
        if (!current.dragging) {
          if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
            gesture.current = null;
            return;
          }
          if (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy) * 1.5) return;
          current.dragging = true;
          blockedClick.current = true;
          phase.current = "dragging";
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        event.preventDefault();
        const width = event.currentTarget.clientWidth;
        setOffset(Math.max(-width, Math.min(width, dx)));
      }}
      onPointerUp={(event) => {
        const current = gesture.current;
        if (!current || current.pointerId !== event.pointerId) return;
        if (!current.dragging) {
          releasePointer();
          return;
        }
        blockedClick.current = true;
        const dx = event.clientX - current.x;
        const width = event.currentTarget.clientWidth;
        const threshold = Math.max(48, Math.min(100, width * 0.18));
        const velocity =
          Math.abs(dx) / Math.max(1, event.timeStamp - current.time);
        const advance =
          Math.abs(dx) >= threshold || (Math.abs(dx) >= 30 && velocity > 0.45);
        releasePointer();
        settle(
          advance ? (dx > 0 ? width : -width) : 0,
          advance ? (dx > 0 ? next : previous) : null,
        );
      }}
      onPointerCancel={(event) => {
        if (gesture.current?.pointerId === event.pointerId) cancelGesture();
      }}
      onLostPointerCapture={(event) => {
        if (
          event.target === event.currentTarget &&
          gesture.current?.pointerId === event.pointerId
        )
          cancelGesture();
      }}
      onClickCapture={(event) => {
        if (!event.currentTarget.contains(event.target as Node)) return;
        if (event.detail === 0) {
          // Voice and assistive activation do not start a pointer gesture.
          blockedClick.current = false;
          return;
        }
        if (!blockedClick.current) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      onKeyDownCapture={(event) => {
        if (!event.currentTarget.contains(event.target as Node)) return;
        blockedClick.current = false;
      }}
      onKeyDown={(event) => {
        if (!event.currentTarget.contains(event.target as Node)) return;
        if (
          event.target instanceof Element &&
          event.target.closest(EXCLUDED_CONTROLS)
        )
          return;
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        if (phase.current !== "idle") return;
        settle(
          event.key === "ArrowRight"
            ? event.currentTarget.clientWidth
            : -event.currentTarget.clientWidth,
          event.key === "ArrowRight" ? next : previous,
        );
      }}
      onDragStart={(event) => {
        if (event.currentTarget.contains(event.target as Node))
          event.preventDefault();
      }}
    >
      <p id="viso-deck-slide-instructions" className="sr-only">
        Deslizá a la derecha para avanzar y a la izquierda para volver.
      </p>
      <div
        data-deck-slide-track="true"
        className="relative size-full"
        style={{
          transform: `translateX(calc(-100% + ${offset}px))`,
          transition: animated ? "transform 220ms ease-out" : "none",
          willChange: offset !== 0 || animated ? "transform" : "auto",
        }}
        onTransitionEnd={(event) => {
          if (
            event.target === event.currentTarget &&
            event.propertyName === "transform"
          )
            finish();
        }}
      >
        {pageKeys.map((key, page) => (
          <div
            key={key}
            data-deck-slide-active={page === index ? "true" : "false"}
            aria-hidden={page !== index}
            inert={page !== index}
            className="absolute top-0 h-full w-full overflow-hidden"
            style={{
              left: `${(order.includes(page) ? order.indexOf(page) : 4) * 100}%`,
              visibility: order.includes(page) ? "visible" : "hidden",
            }}
          >
            {pages[page]}
          </div>
        ))}
      </div>
    </main>
  );
}
