import { useState } from "react";
import {
  Home,
  LayoutGrid,
  Box,
  UserRound,
  MonitorPlay,
  Plug,
  Zap,
  ArrowRight,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { SignInButton } from "@/components/ui/signin";
import KeyCap from "@/components/key-cap";
import StatusIcon from "@/components/status-icon";
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
  const reducedMotion = useReducedMotion();
  const descriptions = [
    "Podés pasar",
    "No molestar",
    "En reunión",
    "En comunicación",
    "Un momento para concentrarme",
    "Vuelvo pronto",
  ];
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
      <motion.div
        className="viso-state-glow"
        aria-hidden="true"
        initial={false}
        animate={{ backgroundColor: current.defaultColor }}
        transition={{ duration: reducedMotion ? 0 : 0.8, ease: "easeInOut" }}
      />
      <header className="viso-home-header">
        <VisoBrand className="viso-home-brand" />
        <div className="viso-desktop-copy viso-header-entry">
          <SignInButton
            className="viso-orange-button"
            signInText="Abrir panel"
            showIcon={false}
          />
          <ArrowRight aria-hidden="true" />
        </div>
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
            <p className="viso-current-state">
              <span style={{ backgroundColor: current.defaultColor }} />
              Estado actual: {current.name}
            </p>
            <h1>
              Tu estado, a la
              <br />
              vista de todos.
            </h1>
            <p>
              Elegí tu estado y mostralo en tus pantallas y luces compatibles.
            </p>
            <div className="viso-home-cta">
              <SignInButton
                size="lg"
                className="viso-orange-button"
                signInText="Crear mi deck"
                showIcon={false}
              />
              <ArrowRight aria-hidden="true" />
            </div>
          </div>
          <div className="viso-demo-deck" id="viso-demo-deck">
            <div className="viso-mobile-copy">
              <div className="viso-app-heading">
                <h1>Tu espacio</h1>
                <span>Demo</span>
              </div>
              <p className="viso-app-description">
                Elegí un estado para tu espacio.
              </p>
              <ProductHero color={current.defaultColor} demo />
            </div>
            <div className="viso-desktop-status viso-desktop-copy">
              <motion.div
                className="viso-status-face"
                initial={false}
                animate={{ backgroundColor: current.defaultColor }}
                transition={{ duration: reducedMotion ? 0 : 0.65 }}
              >
                <StatusIcon name={current.icon} strokeWidth={1.7} />
                <h2>{current.name}</h2>
                <p>{descriptions[index]}</p>
              </motion.div>
            </div>
            <div
              className="viso-demo-keys"
              role="group"
              aria-label="Probar estados de VISO"
            >
              {VISO_STATES.map((status, position) => (
                <div
                  key={status.key}
                  style={
                    {
                      "--viso-key-color": status.defaultColor,
                    } as React.CSSProperties
                  }
                >
                  <KeyCap
                    className="viso-demo-key"
                    label={status.name}
                    icon={status.icon}
                    color={status.defaultColor}
                    active={position === index}
                    onClick={() => setIndex(position)}
                  />
                </div>
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
          <SignInButton
            size="lg"
            className="viso-orange-button"
            signInText="Entrar"
            showIcon={false}
          />
          <ArrowRight aria-hidden="true" />
        </div>
      </main>
      <footer className="viso-home-footer viso-desktop-copy">
        <VisoBrand className="viso-footer-brand" />
        <p>Tu estado, a la vista de todos.</p>
      </footer>
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
