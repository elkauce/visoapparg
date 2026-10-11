import { useState } from "react";
import {
  Home,
  LayoutGrid,
  Box,
  UserRound,
  MonitorPlay,
  Plug,
  Zap,
} from "lucide-react";
import { SignInButton } from "@/components/ui/signin";
import KeyCap from "@/components/key-cap";
import StatusScreen from "@/components/status-screen";
import { VisoBrand } from "@/components/viso-brand";
import { VISO_STATES } from "../deck/_lib/viso-states";
import { ProductCollection, ProductHero } from "./viso-products";
import HomeLightsCard from "./home-lights-card";
import "./landing.css";

const FEATURES = [
  {
    icon: Zap,
    title: "Un toque",
    text: "Cambiá tu estado desde cualquier dispositivo.",
  },
  {
    icon: MonitorPlay,
    title: "Pantalla completa",
    text: "Un link público que muestra tu estado en grande, sin contraseña.",
  },
  {
    icon: Plug,
    title: "Stream Deck y luces de casa",
    text: "Tu estado en Elgato y en tus luces inteligentes compatibles.",
  },
];

/** Public demo only: no status mutation, device pairing or account data is changed. */
export default function Landing() {
  const [index, setIndex] = useState(0);
  const [tab, setTab] = useState("inicio");
  const current = VISO_STATES[index];
  const demoFace = {
    name: current.name,
    color: current.defaultColor,
    icon: current.icon,
  };
  function scrollTo(id: string, selected: string) {
    setTab(selected);
    document.getElementById(id)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  }
  return (
    <div
      className="viso-landing"
      id="viso-home"
      style={
        { "--viso-demo-color": current.defaultColor } as React.CSSProperties
      }
    >
      <header className="viso-home-header">
        <VisoBrand className="h-8 max-w-36" />
        <SignInButton
          variant="secondary"
          className="viso-desktop-copy"
          signInText="Entrar al panel"
        />
        <div className="viso-mobile-account-wrap">
          <UserRound aria-hidden="true" />
          <SignInButton
            variant="ghost"
            className="viso-mobile-account"
            aria-label="Entrar a mi cuenta"
            signInText=""
            showIcon={false}
          />
        </div>
      </header>
      <main>
        <section className="viso-home-hero">
          <div className="viso-home-intro viso-desktop-copy">
            <p className="viso-eyebrow">TU ESTADO, A LA VISTA</p>
            <h1>
              Un toque y todos saben si estás{" "}
              <span style={{ color: current.defaultColor }}>
                {current.name.toLowerCase()}
              </span>
            </h1>
            <p>
              Un Stream Deck online. Marcá si estás libre, ocupado o en reunión,
              mostralo a pantalla completa y cambiá el color de tus luces.
            </p>
            <div className="viso-home-cta">
              <SignInButton
                size="lg"
                signInText="Crear mi deck"
                showIcon={false}
              />
              <span>Probá la demo: tocá una tecla</span>
            </div>
          </div>
          <div className="viso-demo-deck" id="viso-demo-deck">
            <div className="viso-mobile-copy">
              <ProductHero color={current.defaultColor} demo />
            </div>
            <div className="viso-desktop-status viso-desktop-copy">
              <StatusScreen face={demoFace} caption="Demo de VISO" />
            </div>
            <div
              className="viso-demo-keys"
              role="group"
              aria-label="Probar estados de VISO"
            >
              {VISO_STATES.map((status, position) => (
                <KeyCap
                  key={status.key}
                  label={status.name}
                  icon={status.icon}
                  color={status.defaultColor}
                  active={position === index}
                  onClick={() => setIndex(position)}
                />
              ))}
            </div>
            <p className="viso-demo-caption">
              Demo: probá los colores sin cambiar tu cuenta.
            </p>
          </div>
        </section>
        <section
          className="viso-home-features viso-desktop-copy"
          aria-label="Funciones VISO"
        >
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title}>
              <Icon style={{ color: current.defaultColor }} />
              <h2>{title}</h2>
              <p>{text}</p>
            </div>
          ))}
        </section>
        <HomeLightsCard />
        <ProductCollection />
        <div className="viso-mobile-entry">
          <SignInButton size="lg" signInText="Entrar" showIcon={false} />
        </div>
      </main>
      <nav className="viso-mobile-nav" aria-label="Navegación principal">
        <button
          onClick={() => scrollTo("viso-home", "inicio")}
          aria-current={tab === "inicio" ? "page" : undefined}
        >
          <Home />
          <span>Inicio</span>
        </button>
        <button
          onClick={() => scrollTo("viso-demo-deck", "deck")}
          aria-current={tab === "deck" ? "page" : undefined}
        >
          <LayoutGrid />
          <span>Deck</span>
        </button>
        <button
          onClick={() => scrollTo("viso-products", "productos")}
          aria-current={tab === "productos" ? "page" : undefined}
        >
          <Box />
          <span>Dispositivos</span>
        </button>
        <div className="viso-nav-account-wrap">
          <UserRound aria-hidden="true" />
          <SignInButton
            variant="ghost"
            signInText="Cuenta"
            showIcon={false}
            className="viso-nav-account"
            aria-label="Entrar a mi cuenta"
          />
        </div>
      </nav>
    </div>
  );
}
