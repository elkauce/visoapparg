import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { DefaultProviders } from "./components/providers/default.tsx";
import DeckPage from "./pages/deck/page.tsx";
import AndroidDeck from "./pages/deck/android-deck.tsx";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import PublicStatusPage from "./pages/s/page.tsx";
import AutomaticPresence from "./components/automatic-presence";
import DeckAwake from "./components/deck-awake.tsx";
import AndroidRuntime from "./components/android-runtime.tsx";
import GoogleHomeSync from "./pages/_components/google-home-sync.tsx";
import AndroidHome from "./pages/android/home.tsx";
import AndroidSettings from "./pages/android/settings.tsx";
import AndroidDisplay from "./pages/android/display.tsx";
import AndroidIntegrations from "./pages/android/integrations.tsx";
import AndroidIntegrationDetails from "./pages/android/integration-details.tsx";
import AndroidStreamDeckPage from "./pages/android/stream-deck.tsx";
import { isAndroidNative } from "./lib/android-native.ts";
import WebSurfaceTheme from "./components/web-surface-theme";
import GoogleAuthReturn from "./components/google-auth-return";

const MarketplacePage = lazy(() => import("./pages/marketplace/page.tsx"));

export default function App() {
  return (
    <DefaultProviders>
      <BrowserRouter>
        <WebSurfaceTheme />
        <GoogleAuthReturn />
        <AndroidRuntime />
        <DeckAwake />
        <AutomaticPresence />
        <GoogleHomeSync />
        <Routes>
          <Route
            path="/"
            element={
              isAndroidNative() ||
              import.meta.env.VITE_ANDROID_PREVIEW === "true" ? (
                <AndroidHome />
              ) : (
                <Index />
              )
            }
          />
          <Route path="/android" element={<AndroidHome />} />
          <Route path="/android/settings" element={<AndroidSettings />} />
          <Route path="/android/display" element={<AndroidDisplay />} />
          <Route
            path="/android/stream-deck"
            element={<AndroidStreamDeckPage />}
          />
          <Route
            path="/android/integrations"
            element={<AndroidIntegrations />}
          />
          <Route
            path="/android/integrations/:integration"
            element={<AndroidIntegrationDetails />}
          />
          <Route
            path="/deck/edit"
            element={<DeckPage startEditing fullEditor />}
          />
          <Route path="/deck" element={<AndroidDeck />} />
          <Route path="/s/:slug" element={<PublicStatusPage />} />
          <Route
            path="/marketplace"
            element={
              <Suspense
                fallback={
                  <div
                    role="status"
                    className="min-h-dvh bg-[#f5f3ef] p-8 text-[#181a1f]"
                  >
                    Cargando Marketplace…
                  </div>
                }
              >
                <MarketplacePage />
              </Suspense>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}
