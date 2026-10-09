import { useEffect } from "react";
import { App as NativeApp } from "@capacitor/app";
import { useLocation, useNavigate } from "react-router-dom";
import { isAndroidNative } from "@/lib/android-native.ts";

/** Android keeps the React tree alive when orientation changes. */
export default function AndroidRuntime() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isAndroidNative()) return;
    const listener = NativeApp.addListener("backButton", () => {
      const event = new Event("viso:android-back", { cancelable: true });
      if (!window.dispatchEvent(event)) return;
      if (pathname === "/") void NativeApp.exitApp();
      else navigate(-1);
    });
    return () => { void listener.then((handle) => handle.remove()); };
  }, [navigate, pathname]);
  return null;
}
