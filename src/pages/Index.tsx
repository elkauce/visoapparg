import { Link } from "react-router-dom";
import { LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import Deck from "./_components/deck.tsx";
import Landing from "./_components/landing.tsx";
import AndroidDownloadPanel from "./_components/android-download-panel";
import SharePanel from "./_components/share-panel.tsx";
import StreamDeckPanel from "./_components/stream-deck-panel.tsx";
import LightSync from "./_components/light-sync.tsx";
import { VisoBrand } from "@/components/viso-brand.tsx";
import "./_components/panel.css";

function DeckScreen() {
  return (
    <div className="viso-control-panel min-h-screen">
      <header className="viso-control-panel__header">
        <VisoBrand className="viso-control-panel__brand h-8" />
        <div className="viso-control-panel__header-actions flex items-center gap-2">
          <Button asChild size="sm">
            <Link to="/deck">
              <LayoutGrid /> Abrir deck
            </Link>
          </Button>
          <SignInButton variant="ghost" size="sm" signOutText="Salir" />
        </div>
      </header>
      <main className="viso-control-panel__main">
        <div className="viso-control-panel__intro">
          <p className="viso-control-panel__eyebrow">TU ESPACIO, CONECTADO</p>
          <h1>Tu panel</h1>
          <p>Elegí un estado y llevá tu señal a todas tus pantallas.</p>
        </div>
        <section className="viso-control-panel__deck" aria-label="Tus estados">
          <Deck />
        </section>
        <div className="viso-control-panel__connections">
          <SharePanel />
          <AndroidDownloadPanel />
          <StreamDeckPanel />
        </div>
        <LightSync />
      </main>
    </div>
  );
}

export default function Index() {
  return (
    <>
      <AuthLoading>
        <div className="mx-auto max-w-5xl p-6">
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <Landing />
      </Unauthenticated>
      <Authenticated>
        <DeckScreen />
      </Authenticated>
    </>
  );
}
