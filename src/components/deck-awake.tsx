import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { registerPlugin } from "@capacitor/core";
import { isAndroidNative } from "@/lib/android-native";

const native = registerPlugin<{
  setKeepScreenOn(options: { enabled: boolean }): Promise<void>;
}>("VisoNative");

/** Keep Deck and Display awake; release outside their views or when hidden. */
export default function DeckAwake() {
  const { pathname } = useLocation();
  const enabled =
    pathname === "/deck" ||
    pathname === "/android/display" ||
    /^\/s\/[^/]+\/?$/.test(pathname);
  useEffect(() => {
    if (!enabled) return;
    if (isAndroidNative()) {
      void native.setKeepScreenOn({ enabled: true }).catch(() => undefined);
      return () => {
        void native.setKeepScreenOn({ enabled: false }).catch(() => undefined);
      };
    }
    let stopped = false;
    let pending = false;
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      if (stopped || pending || document.hidden || lock || !navigator.wakeLock)
        return;
      pending = true;
      try {
        const acquired = await navigator.wakeLock.request("screen");
        if (stopped || document.hidden) {
          await acquired.release();
          return;
        }
        lock = acquired;
        acquired.addEventListener("release", () => {
          if (lock === acquired) lock = null;
        });
      } catch {
        /* Browsers may deny wake locks in battery-saving mode. */
      } finally {
        pending = false;
      }
    };
    const visibility = () => {
      if (document.hidden) {
        const current = lock;
        lock = null;
        void current?.release();
      } else void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", visibility);
      void lock?.release();
      lock = null;
    };
  }, [enabled]);
  return null;
}
