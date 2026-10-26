import { BookOpen, Home, UserRound } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export default function NativeAppNav() {
  const location = useLocation();
  const library =
    location.pathname === "/marketplace" &&
    new URLSearchParams(location.search).get("view") === "library";
  const account = location.pathname === "/android/settings";
  return (
    <nav className="viso-app-bottom-nav" aria-label="Navegación de VISO">
      {[
        {
          label: "Inicio",
          to: "/android",
          icon: Home,
          active: !library && !account,
        },
        {
          label: "Biblioteca",
          to: "/marketplace?view=library",
          icon: BookOpen,
          active: library,
        },
        {
          label: "Cuenta",
          to: "/android/settings",
          icon: UserRound,
          active: account,
        },
      ].map(({ label, to, icon: Icon, active }) => (
        <Link key={label} to={to} aria-current={active ? "page" : undefined}>
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
