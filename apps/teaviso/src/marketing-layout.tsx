import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  House,
  Layers2,
  Menu,
  QrCode,
  UserRound,
  X,
} from "lucide-react";
import { Brand } from "./brand";
export function MarketingLayout({
  children,
  plans = false,
}: {
  children: ReactNode;
  plans?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    if (location.hash)
      document.getElementById(location.hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  const nav = (
    <>
      <Link
        to="/"
        aria-current={location.pathname === "/" ? "page" : undefined}
      >
        Inicio
      </Link>
      <Link to="/planes" aria-current={plans ? "page" : undefined}>
        Planes
      </Link>
      <Link
        to="/carteles"
        aria-current={
          location.pathname.startsWith("/carteles") ? "page" : undefined
        }
      >
        Carteles
      </Link>
      <Link className="pc-button" to="/panel">
        Mi cuenta <UserRound size={17} />
      </Link>
    </>
  );
  return (
    <div className={`ta-marketing pc-layout${plans ? " plans-page" : ""}`}>
      <header className="pc-header">
        <div className="pc-wrap pc-header-inner">
          <Brand className="brand" />
          <nav className="pc-desktop-nav" aria-label="Principal">
            {nav}
          </nav>
          <button
            className="pc-menu"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            aria-controls="public-menu"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
        <nav
          id="public-menu"
          className="pc-mobile-menu"
          hidden={!open}
          aria-label="Menú móvil"
          onClick={() => setOpen(false)}
        >
          {nav}
        </nav>
      </header>
      {children}
      <footer className="pc-footer pc-wrap">
        <div>
          <Brand className="brand" />
          <p>Tu puerta, conectada con vos.</p>
        </div>
        <nav aria-label="Información">
          <Link to="/planes">Planes</Link>
          <Link to="/carteles">Carteles</Link>
          <Link to="/privacidad">Privacidad y uso</Link>
          <Link to="/panel">
            Mi cuenta <ArrowRight size={14} />
          </Link>
        </nav>
      </footer>
      <nav className="pc-public-bottom" aria-label="Navegación móvil">
        <Link className={location.pathname === "/" ? "active" : ""} to="/">
          <House size={21} />
          <span>Inicio</span>
        </Link>
        <Link className={plans ? "active" : ""} to="/planes">
          <Layers2 size={21} />
          <span>Planes</span>
        </Link>
        <Link
          className={location.pathname.startsWith("/carteles") ? "active" : ""}
          to="/carteles"
        >
          <QrCode size={21} />
          <span>Carteles</span>
        </Link>
        <Link to="/panel">
          <UserRound size={21} />
          <span>Cuenta</span>
        </Link>
      </nav>
    </div>
  );
}
