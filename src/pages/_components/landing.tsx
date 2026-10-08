import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { MonitorPlay, Plug, Zap } from "lucide-react";
import { SignInButton } from "@/components/ui/signin.tsx";
import KeyCap from "@/components/key-cap.tsx";
import StatusScreen from "@/components/status-screen.tsx";

const FEATURES = [
  { icon: Zap, title: "Un toque", text: "Cambia tu estado desde cualquier dispositivo." },
  { icon: MonitorPlay, title: "Pantalla completa", text: "Un link público que muestra tu estado en grande, sin contraseña." },
  { icon: Plug, title: "Stream Deck y luces", text: "Elgato, ESP32, luces RGB, Alexa y Google Home." },
] as const;

const DEMO_STATUSES = [
  { name: "Libre", color: "#22c55e", icon: "check-circle" },
  { name: "Ocupado", color: "#ef4444", icon: "ban" },
  { name: "En reunión", color: "#f59e0b", icon: "users" },
  { name: "En llamada", color: "#8b5cf6", icon: "phone" },
  { name: "Almuerzo", color: "#0ea5e9", icon: "utensils" },
  { name: "Ausente", color: "#64748b", icon: "moon" },
] as const;

const AUTO_CYCLE_MS = 2800;

// Portada: una demo viva. Al tocar una tecla, la pantalla cambia de estado igual que en el panel
export default function Landing() {
  const [index, setIndex] = useState(0);
  const [touched, setTouched] = useState(false);

  // Mientras nadie toque nada, la demo recorre los estados sola para mostrar qué hace
  useEffect(() => {
    if (touched) {
      return;
    }
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % DEMO_STATUSES.length);
    }, AUTO_CYCLE_MS);
    return () => clearInterval(timer);
  }, [touched]);

  const current = DEMO_STATUSES[index];

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#0b0b0e]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:22px_22px]" />
      <motion.div
        aria-hidden
        animate={{ backgroundColor: current.color }}
        transition={{ duration: 0.8 }}
        className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
      />

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-2xl font-extrabold tracking-tight">
          VISO<span style={{ color: current.color }}>.</span>
        </span>
        <SignInButton variant="secondary" signInText="Entrar al panel" />
      </header>

      <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-12 px-6 py-8 lg:flex-row lg:gap-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex-1 space-y-7 text-center lg:text-left"
        >
          <p className="text-xs font-semibold tracking-widest text-white/60 uppercase">
            Tu estado, a la vista
          </p>
          <h1 className="text-balance text-5xl leading-[1.02] font-extrabold tracking-tight sm:text-6xl">
            Un toque y todos saben si estás{" "}
            <span style={{ color: current.color }} className="transition-colors duration-500">
              {current.name.toLowerCase()}
            </span>
          </h1>
          <p className="mx-auto max-w-lg text-pretty text-lg text-white/70 lg:mx-0">
            Un Stream Deck online. Marca si estás libre, ocupado o en reunión,
            muéstralo a pantalla completa y cambia el color de tus luces.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
            <SignInButton size="lg" signInText="Crear mi deck" showIcon={false} />
            <span className="text-sm text-white/50">Prueba la demo: toca una tecla</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          className="w-full max-w-md space-y-6 rounded-3xl border border-white/10 bg-[#121317] p-4 shadow-2xl"
        >
          <StatusScreen face={current} caption="viso.app/s/tu-link" />
          <div className="grid grid-cols-3 gap-3 px-1 pb-3">
            {DEMO_STATUSES.map((status, position) => (
              <KeyCap
                key={status.name}
                label={status.name}
                icon={status.icon}
                color={status.color}
                active={position === index}
                onClick={() => {
                  setTouched(true);
                  setIndex(position);
                }}
              />
            ))}
          </div>
        </motion.div>
      </main>

      <section className="relative mx-auto grid w-full max-w-6xl gap-4 px-6 pt-4 pb-12 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-2xl border border-white/10 bg-[#121317]/80 p-5">
            <Icon className="mb-3 size-5" style={{ color: current.color }} />
            <p className="font-bold">{title}</p>
            <p className="text-sm text-white/60">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
