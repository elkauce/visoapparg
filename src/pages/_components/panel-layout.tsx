import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  BellRing,
  Home,
  Monitor,
  Plug,
  Settings2,
  ShoppingBag,
} from "lucide-react";
import { VisoBrand } from "@/components/viso-brand";
import { isAndroidNative } from "@/lib/android-native";
import "./panel.css";

export type PanelSection =
  "states" | "display" | "connections" | "marketplace" | "timbre" | "account";

const SECTIONS = [
  { id: "states", label: "Panel", icon: Home, web: "/", android: "/android" },
  {
    id: "display",
    label: "Display",
    icon: Monitor,
    web: "/?section=display",
    android: "/android/display",
  },
  {
    id: "connections",
    label: "Conexiones",
    icon: Plug,
    web: "/?section=connections",
    android: "/android/integrations",
  },
  {
    id: "marketplace",
    label: "Marketplace",
    icon: ShoppingBag,
    web: "/marketplace",
    android: "/marketplace",
  },
  {
    id: "timbre",
    label: "Timbre",
    icon: BellRing,
    web: "/timbre",
    android: "/timbre",
  },
  {
    id: "account",
    label: "Cuenta",
    icon: Settings2,
    web: "/?section=account",
    android: "/android/settings",
  },
] as const;

/** One navigation surface: a left rail on desktop and an app bar on mobile.
 * Fullscreen Deck and Display routes deliberately do not use this layout. */
export default function PanelLayout({
  section,
  className = "",
  children,
}: {
  section: PanelSection;
  className?: string;
  children: ReactNode;
}) {
  const android = isAndroidNative();
  return (
    <div className={`viso-control-panel min-h-screen ${className}`}>
      <aside className="viso-panel-rail" aria-label="Panel VISO">
        <Link
          to={android ? "/android" : "/"}
          className="viso-panel-brand-link"
          aria-label="Ir al panel VISO"
        >
          <VisoBrand className="viso-panel-brand" />
        </Link>
        <nav className="viso-panel-rail-nav" aria-label="Navegación principal">
          {SECTIONS.map(
            ({ id, label, icon: Icon, web, android: nativePath }) => (
              <Link
                key={id}
                title={label}
                to={android ? nativePath : web}
                data-section={id}
                aria-current={section === id ? "page" : undefined}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ),
          )}
        </nav>
      </aside>
      <div className="viso-panel-shell">{children}</div>
    </div>
  );
}
