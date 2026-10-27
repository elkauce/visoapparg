import { useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowRight, Menu, X } from "lucide-react";
import { solutions } from "./v2-model";
export function Brand() {
  return (
    <Link className="av-brand" to="/" aria-label="Te Aviso, inicio">
      <img src="/brand/viso-icon.png" alt="" width="44" height="44" />
      <span>
        Te Aviso<small>por VISO</small>
      </span>
    </Link>
  );
}
export function PublicLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="av-public">
      <header className="av-header">
        <Brand />
        <nav
          className={open ? "av-public-nav is-open" : "av-public-nav"}
          aria-label="Principal"
          onClick={() => setOpen(false)}
        >
          <NavLink to="/soluciones">Soluciones</NavLink>
          <a href="/#como-funciona">Cómo funciona</a>
          <NavLink to="/equipos">Equipos</NavLink>
          <NavLink to="/planes">Planes</NavLink>
          <Link className="av-button" to="/panel">
            Ingresar <ArrowRight size={16} />
          </Link>
        </nav>
        <button
          className="av-menu"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
        >
          {open ? <X /> : <Menu />}
        </button>
      </header>
      {children}
      <footer className="av-footer">
        <Brand />
        <p>Tu timbre digital. Fácil de instalar.</p>
        <nav aria-label="Más información">
          <Link to="/planes">Planes</Link>
          <Link to="/privacidad">Privacidad y uso</Link>
          <Link to="/panel">Mi cuenta</Link>
          <a
            href="https://viso-deck-android.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Conocé VISO ↗
          </a>
        </nav>
      </footer>
    </div>
  );
}
export function SolutionCards({ expanded = false }: { expanded?: boolean }) {
  return (
    <div className="av-solutions">
      {solutions.map((s) => (
        <article key={s.id} className={`av-solution ${s.color}`}>
          <div className="av-solution-top">
            <s.icon size={30} />
            <span className="av-pill">{s.label}</span>
          </div>
          <h2>{s.title}</h2>
          <p>{s.description}</p>
          {expanded && (
            <ul>
              {s.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
          <Link
            className={expanded ? "av-button av-outline" : "av-arrow"}
            to={
              s.id === "whatsapp"
                ? "/panel/nuevo?mode=whatsapp"
                : s.id === "hardware"
                  ? "/equipos"
                  : `/soluciones/${s.id}`
            }
            aria-label={`${s.action}: ${s.title}`}
          >
            {expanded ? s.action : <ArrowRight size={18} />}
          </Link>
        </article>
      ))}
    </div>
  );
}
export function Feedback({
  task,
}: {
  task: { error: string; notice: string };
}) {
  return (
    <>
      {task.error && (
        <p className="av-error" role="alert">
          {task.error}
        </p>
      )}
      {task.notice && (
        <p className="av-success" role="status">
          {task.notice}
        </p>
      )}
    </>
  );
}
export function Loading() {
  return (
    <p className="av-loading" role="status">
      Cargando tu espacio…
    </p>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="av-empty">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
