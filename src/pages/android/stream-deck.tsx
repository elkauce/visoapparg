import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { actions } from "@/lib/android-native";
import { marketplaceWebUrl } from "@/lib/marketplace-navigation";
import { Button } from "@/components/ui/button";
import { AndroidScreen } from "./shared";

export default function AndroidStreamDeckPage() {
  const [error, setError] = useState(false);
  return (
    <AndroidScreen
      title="Stream Deck de Elgato"
      backTo="/marketplace"
      backLabel="Volver al marketplace"
    >
      <p>
        Para instalar el plugin en Elgato, abrí VISO desde tu computadora con
        esta misma cuenta.
      </p>
      <p className="text-sm text-muted-foreground">
        En Conexiones, elegí «Descargar mi plugin configurado». Incluirá tus
        estados y la configuración de tu cuenta.
      </p>
      <Button
        onClick={() => {
          setError(false);
          void actions
            .openUrl(marketplaceWebUrl("/?section=connections"))
            .catch(() => setError(true));
        }}
      >
        <ExternalLink /> Abrir panel web
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          No se pudo abrir el navegador. Intentá de nuevo.
        </p>
      )}
    </AndroidScreen>
  );
}
