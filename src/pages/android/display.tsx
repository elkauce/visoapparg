import { useState } from "react";
import { useMutation, useQuery, useConvexConnectionState } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { AndroidScreen } from "./shared.tsx";
import { toast } from "sonner";

export default function AndroidDisplay() {
  const slug = useQuery(api.public_status.getMine, {});
  const ensure = useMutation(api.public_status.ensureMine);
  const connection = useConvexConnectionState();
  const [pending, setPending] = useState(false);
  const prepare = async () => {
    if (pending || !connection.isWebSocketConnected) return;
    setPending(true);
    try { await ensure({}); } catch { toast.error("No se pudo preparar el Display. Inténtalo de nuevo."); }
    finally { setPending(false); }
  };
  return <AndroidScreen title="Display"><p className="text-muted-foreground">Muestra el estado de tu cuenta a pantalla completa. Los cambios del Deck se reciben en tiempo real.</p>
    {slug ? <><Button asChild size="lg"><Link to={`/s/${slug}`}>Abrir mi Display</Link></Button>{import.meta.env.VITE_VISO_WEB_URL && <p className="break-all text-sm text-muted-foreground">Enlace público: {import.meta.env.VITE_VISO_WEB_URL}/s/{slug}</p>}</> : <Button disabled={slug === undefined || pending || !connection.isWebSocketConnected} onClick={() => void prepare()}>{pending ? "Preparando…" : "Preparar mi Display"}</Button>}
  </AndroidScreen>;
}
