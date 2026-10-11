import { Lightbulb } from "lucide-react";
import { SignInButton } from "@/components/ui/signin";

export default function HomeLightsCard() {
  return (
    <section
      id="viso-home-lights"
      className="viso-home-lights"
      aria-label="Luces de tu casa"
    >
      <div className="viso-bulb-art" aria-hidden="true">
        <Lightbulb />
      </div>
      <div className="viso-home-lights-copy">
        <h2>
          <span className="viso-desktop-copy">
            Tu estado también se ve en las{" "}
          </span>
          <span className="viso-mobile-copy">Luces de tu casa</span>
          <span className="viso-desktop-copy viso-green">luces de tu casa</span>
        </h2>
        <p>
          Usá las luces inteligentes que ya tenés y elegí qué color usar para
          cada estado.
        </p>
        <div className="viso-light-states viso-desktop-copy">
          <span style={{ color: "#22c55e" }}>● LIBRE</span>
          <span style={{ color: "#f59e0b" }}>● REUNIÓN</span>
          <span style={{ color: "#ef4444" }}>● OCUPADO</span>
        </div>
        <div className="viso-light-integrations">
          <span>Google Home</span>
          <span>Alexa</span>
        </div>
        <p className="viso-lights-note">
          Luces compatibles con cambio de color. Conexión autorizada por vos.
        </p>
        <SignInButton
          variant="ghost"
          className="viso-lights-connect"
          signInText="Configurar mis luces"
          showIcon={false}
        />
      </div>
    </section>
  );
}
