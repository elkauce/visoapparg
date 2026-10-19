import { ArrowRight } from "lucide-react";
import { SignInButton } from "@/components/ui/signin";

export default function HomeLightsCard() {
  return (
    <section
      id="viso-home-lights"
      className="viso-home-lights"
      aria-label="Luces de tu casa"
    >
      <div className="viso-bulb-art" aria-hidden="true">
        <span className="viso-bulb-glow" />
        <div className="viso-bulb">
          <span className="viso-bulb-dome" />
          <span className="viso-bulb-body" />
          <span className="viso-bulb-neck" />
          <span className="viso-bulb-base" />
        </div>
      </div>
      <div className="viso-home-lights-copy">
        <h2>
          <span className="viso-desktop-copy">
            Tu estado también se ve en las{" "}
          </span>
          <span className="viso-mobile-copy">Luces de tu casa</span>
          <span className="viso-desktop-copy">luces de tu casa.</span>
        </h2>
        <p>
          <span className="viso-desktop-copy">
            Usá las luces que ya tenés y elegí un color para cada estado.
          </span>
          <span className="viso-mobile-copy">Usá las luces que ya tenés</span>
        </p>
        <div className="viso-light-states viso-desktop-copy">
          <span>
            <i style={{ backgroundColor: "#22c55e" }} />
            Libre
          </span>
          <span>
            <i style={{ backgroundColor: "#f59e0b" }} />
            Reunión
          </span>
          <span>
            <i style={{ backgroundColor: "#ef4444" }} />
            Ocupado
          </span>
        </div>
        <div className="viso-lights-footer">
          <div className="viso-lights-integrations-copy">
            <div
              className="viso-light-integrations"
              aria-label="Compatibilidad de luces"
            >
              <div className="viso-integration-badge viso-integration-google">
                <svg viewBox="0 0 32 32" aria-hidden="true">
                  <path d="m3 14 13-12 5 4L8 18Z" fill="#ea4335" />
                  <path d="m16 2 13 12-5 5L12 7Z" fill="#fbbc04" />
                  <path d="M3 14v15h8V15l-3 3Z" fill="#34a853" />
                  <path d="M11 22h13v7H11Z" fill="#fbbc04" />
                  <path d="M24 15v14h5V14L16 2l-4 5Z" fill="#4285f4" />
                </svg>
                <div className="viso-integration-label">
                  <small>Funciona con</small>
                  <strong>Google Home</strong>
                </div>
              </div>
              <div className="viso-integration-badge viso-integration-alexa">
                <svg viewBox="0 0 32 32" aria-hidden="true">
                  <path
                    d="M16 2a14 14 0 1 0 0 28c3.1 0 6.8-1.7 9.5-4.2l-4.2.1A11 11 0 1 1 27 15c0 3.4-1.7 5.5-4.8 6.7v5.1C27.2 24.3 30 20 30 16A14 14 0 0 0 16 2Z"
                    fill="#00a8e1"
                  />
                </svg>
                <div className="viso-integration-label">
                  <small>Funciona con</small>
                  <strong>Alexa</strong>
                </div>
              </div>
            </div>
            <p className="viso-lights-note">
              Luces compatibles con cambio de color. Conexión autorizada por
              vos.
            </p>
          </div>
          <div className="viso-lights-connect-wrap">
            <SignInButton
              variant="ghost"
              className="viso-lights-connect"
              signInText="Configurar mis luces"
              showIcon={false}
            />
            <ArrowRight aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}
