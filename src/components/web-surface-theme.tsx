import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { isAndroidNative } from "@/lib/android-native";
import "./web-surface-theme.css";

/** Portals inherit the same palette as the web home and account panel.
 * Full-screen Deck, Display and native Android routes retain their own theme. */
export default function WebSurfaceTheme() {
  const { pathname } = useLocation();
  const light =
    pathname === "/marketplace" ||
    (pathname === "/" &&
      !isAndroidNative() &&
      import.meta.env.VITE_ANDROID_PREVIEW !== "true");

  useLayoutEffect(() => {
    if (!light) return;
    const root = document.documentElement;
    const previous = root.getAttribute("data-viso-web-theme");
    root.setAttribute("data-viso-web-theme", "light");
    return () => {
      if (previous === null) root.removeAttribute("data-viso-web-theme");
      else root.setAttribute("data-viso-web-theme", previous);
    };
  }, [light]);

  return null;
}
