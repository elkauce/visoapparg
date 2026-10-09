import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import DeckPage from "./pages/deck/page.tsx";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import PublicStatusPage from "./pages/s/page.tsx";
import AndroidRuntime from "./components/android-runtime.tsx";
import AndroidHome from "./pages/android/home.tsx";
import AndroidSettings from "./pages/android/settings.tsx";
import AndroidDisplay from "./pages/android/display.tsx";
import AndroidIntegrations from "./pages/android/integrations.tsx";
import AndroidIntegrationDetails from "./pages/android/integration-details.tsx";
import { isAndroidNative } from "./lib/android-native.ts";

export default function App() {
  return (
    <DefaultProviders>
      <BrowserRouter>
        <AndroidRuntime />
        <Routes>
          <Route path="/" element={isAndroidNative() || import.meta.env.VITE_ANDROID_PREVIEW === "true" ? <AndroidHome /> : <Index />} />
          <Route path="/android" element={<AndroidHome />} />
          <Route path="/android/settings" element={<AndroidSettings />} />
          <Route path="/android/display" element={<AndroidDisplay />} />
          <Route path="/android/integrations" element={<AndroidIntegrations />} />
          <Route path="/android/integrations/:integration" element={<AndroidIntegrationDetails />} />
          <Route path="/deck" element={<DeckPage />} />
          <Route path="/s/:slug" element={<PublicStatusPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}
