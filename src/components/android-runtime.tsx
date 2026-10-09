import { useEffect, useLayoutEffect } from "react";
import { App as NativeApp } from "@capacitor/app";
import { useLocation, useNavigate } from "react-router-dom";
import { isAndroidNative } from "@/lib/android-native.ts";

/** Android keeps the React tree alive when orientation changes. */
export default function AndroidRuntime() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useLayoutEffect(() => {
    // A long integration menu must not carry its scroll into the next screen.
    if (isAndroidNative() || pathname.startsWith("/android")) {
      window.scrollTo(0, 0);
    }
  }, [pathname]);
  useEffect(() => {
    if (!isAndroidNative()) return;
    const listener = NativeApp.addListener("backButton", () => {
      if (document.querySelector('[role="dialog"][data-state="open"]')) {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
        return;
      }
      const event = new Event("viso:android-back", { cancelable: true });
      if (!window.dispatchEvent(event)) return;
      if (pathname === "/") void NativeApp.exitApp();
      else if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
      else navigate("/", { replace: true });
    });
    return () => { void listener.then((handle) => handle.remove()); };
  }, [navigate, pathname]);
  return null;
}
