import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  House,
  Layers2,
  Menu,
  UserRound,
  X,
} from "lucide-react";
import "./marketing.css";
function Mark() {
  return (
    <Link className="brand" to="/" aria-label="Te Aviso, inicio">
      <img src="/brand/viso-icon.png" alt="" width="35" height="35" />
      <span>Te Aviso</span>
    </Link>
  );
}
export function MarketingLayout({
  children,
  plans = false,
}: {
  children: ReactNode;
  plans?: boolean;
}) {
  const [open, setOpen] = useState(false),
    location = useLocation();
  useEffect(() => {
    if (location.hash) {
      const node = document.getElementById(location.hash.slice(1));
      node?.scrollIntoView();
    } else window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);
  return (
    <div className={`ta-marketing${plans ? " plans-page" : ""}`}>
      <header className="topbar">
        <div className="nav-wrap">
          <Mark />
          <nav className="desktop-nav" aria-label="Principal">
            <Link to="/#como-funciona">Cómo funciona</Link>
            <Link to="/#modelos">Opciones</Link>
            <Link to="/carteles">Carteles</Link>
            <Link className={plans ? "nav-selected" : ""} to="/planes">
              Planes
            </Link>
            <Link className="button small outline" to="/panel">
              Ingresar <ArrowRight size={16} />
            </Link>
          </nav>
          <button
            className="mobile-menu"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
        <nav
          className="mobile-dropdown"
          aria-label="Menú móvil"
          hidden={!open}
          onClick={() => setOpen(false)}
        >
          <Link to="/#como-funciona">Cómo funciona</Link>
          <Link to="/#modelos">Opciones de timbre</Link>
          <Link to="/#espacios">Para tu espacio</Link>
          <Link to="/carteles">Carteles</Link>
          <Link to="/planes">Planes y servicios</Link>
          <Link to="/panel">Mi cuenta</Link>
        </nav>
      </header>
      {children}
      <footer className="footer wrap">
        <div>
          <Mark />
          <p>Tu puerta. En tu celular.</p>
        </div>
        <nav aria-label="Información">
          <Link to="/#modelos">Opciones</Link>
          <Link to="/planes">Planes</Link>
          <Link to="/carteles">Carteles</Link>
          <Link to="/privacidad">Privacidad y uso</Link>
        </nav>
        <span>Te Aviso</span>
      </footer>
      <nav className="mobile-bottom" aria-label="Navegación móvil">
        <Link className={!plans && !location.hash ? "active" : ""} to="/">
          <House size={21} />
          <span>Inicio</span>
        </Link>
        <Link
          className={!plans && location.hash === "#modelos" ? "active" : ""}
          to="/#modelos"
        >
          <BellRing size={21} />
          <span>Opciones</span>
        </Link>
        <Link className={plans ? "active" : ""} to="/planes">
          <Layers2 size={21} />
          <span>Planes</span>
        </Link>
        <Link to="/panel">
          <UserRound size={21} />
          <span>Ingresar</span>
        </Link>
      </nav>
    </div>
  );
}
