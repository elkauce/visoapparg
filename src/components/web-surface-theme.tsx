import { isAndroidNative, nativeDeck } from "@/lib/android-native";
import { useEffect, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import "./web-surface-theme.css";
import "./management-theme.css";

/** Portals inherit the same palette as the web home and account panel.
 * Operational Deck and Display retain their own theme; management routes are light. */
export default function WebSurfaceTheme() {
  const { pathname } = useLocation();
  const light =
    pathname.startsWith("/marketplace") ||
    pathname === "/timbre" ||
    pathname.startsWith("/android") ||
    pathname === "/deck/edit" ||
    pathname === "/";

  useEffect(() => {
    if (isAndroidNative())
      void nativeDeck.setManagementAppearance(light).catch(() => undefined);
  }, [light]);

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
