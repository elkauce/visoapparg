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
import LightsPanel from "./_components/lights-panel.tsx";
import DevicesPanel from "./_components/devices-panel.tsx";
import LightSync from "./_components/light-sync.tsx";
import { VisoBrand } from "@/components/viso-brand.tsx";

function DeckScreen() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <VisoBrand className="h-8 max-w-36" />
        <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link to="/deck">
              <LayoutGrid /> Abrir deck
            </Link>
          </Button>
          <SignInButton variant="ghost" size="sm" signOutText="Salir" />
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-8 px-6 pb-16 pt-4">
        <Deck />
        <SharePanel />
        <AndroidDownloadPanel />
        <StreamDeckPanel />
        <LightsPanel />
        <details className="rounded-2xl border bg-card/60 p-5">
          <summary className="cursor-pointer text-sm font-medium">
            Ajustes de dispositivos
          </summary>
          <div className="mt-4">
            <DevicesPanel />
          </div>
        </details>
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
