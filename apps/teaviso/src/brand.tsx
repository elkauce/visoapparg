import { Link } from "react-router-dom";

export function Brand({ className = "av-brand" }: { className?: string }) {
  return (
    <Link className={className} to="/" aria-label="Te Aviso, inicio">
      <img src="/brand/viso-icon.png" alt="" width="34" height="34" />
      <span>Te Aviso</span>
    </Link>
  );
}
