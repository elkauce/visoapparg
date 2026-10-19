import { useEffect, useRef, useState } from "react";
type Idle = {
  enabled: boolean;
  mainPageId: string;
  restPageId: string;
  seconds: number;
};
/** Timers change only the current page, never a VISO status or a device command. */
export function useDeckIdle(
  config: Idle | undefined,
  pages: readonly string[],
  blocked: boolean,
  onPage: (id: string) => void,
  onConfigure: () => void,
) {
  const [resting, setResting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppress = useRef(false);
  const swallowed = useRef(false);
  const callbacks = useRef({ onPage, onConfigure });
  callbacks.current = { onPage, onConfigure };
  const pageKey = pages.join(",");
  const valid =
    !!config?.enabled &&
    pages.includes(config.mainPageId) &&
    pages.includes(config.restPageId) &&
    config.mainPageId !== config.restPageId;
  const reset = useRef(() => {});
  useEffect(() => {
    let alive = true;
    const clear = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
    const arm = () => {
      clear();
      if (!alive || !valid || blocked || document.hidden) return;
      timer.current = setTimeout(
        () => {
          if (!alive) return;
          if (document.querySelector('[role="dialog"],[role="alertdialog"]')) {
            arm();
            return;
          }
          setResting(true);
          callbacks.current.onPage(config!.restPageId);
        },
        Math.max(3, config!.seconds) * 1000,
      );
    };
    reset.current = arm;
    setResting(false);
    arm();
    const activity = () => {
      if (!swallowed.current) arm();
    };
    const visibility = () => {
      if (document.hidden) clear();
      else arm();
    };
    window.addEventListener("pointerdown", activity, true);
    window.addEventListener("keydown", activity, true);
    window.addEventListener("wheel", activity, { passive: true });
    window.addEventListener("touchmove", activity, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    return () => {
      alive = false;
      clear();
      if (hold.current) clearTimeout(hold.current);
      window.removeEventListener("pointerdown", activity, true);
      window.removeEventListener("keydown", activity, true);
      window.removeEventListener("wheel", activity);
      window.removeEventListener("touchmove", activity);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [
    valid,
    config?.mainPageId,
    config?.restPageId,
    config?.seconds,
    blocked,
    pageKey,
  ]);
  const wake = () => {
    if (!valid || !resting) return false;
    setResting(false);
    callbacks.current.onPage(config!.mainPageId);
    reset.current();
    return true;
  };
  return {
    onPointerDownCapture: (e: React.PointerEvent) => {
      if (!resting) suppress.current = false;
      if (wake()) {
        e.preventDefault();
        e.stopPropagation();
        suppress.current = true;
        swallowed.current = true;
        hold.current = setTimeout(() => {
          callbacks.current.onConfigure();
        }, 900);
      }
    },
    onPointerUpCapture: (e: React.PointerEvent) => {
      if (hold.current) clearTimeout(hold.current);
      if (swallowed.current) {
        e.preventDefault();
        e.stopPropagation();
        swallowed.current = false;
        reset.current();
      }
    },
    onPointerCancelCapture: () => {
      if (hold.current) clearTimeout(hold.current);
      swallowed.current = false;
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (wake()) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (suppress.current) {
        e.preventDefault();
        e.stopPropagation();
        suppress.current = false;
      }
    },
    onKeyDownCapture: (e: React.KeyboardEvent) => {
      if (wake()) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    onContextMenu: (e: React.MouseEvent) => {
      if (swallowed.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };
}
