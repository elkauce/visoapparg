import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { solutions } from "./v2-model";
export { Brand } from "./brand";
import { MarketingLayout } from "./marketing-layout";
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <MarketingLayout>
      <div className="av-public pc-public-content">{children}</div>
    </MarketingLayout>
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
            to={`/planes#${s.id}`}
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
