import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { registerPlugin } from "@capacitor/core";
import { TimbrePushSettings } from "@/components/timbre-push";
import { isTeavisoAndroid } from "./native-app";

const native = registerPlugin<{
  setScreenOrientation(options: {
    mode: "portrait" | "automatic";
  }): Promise<void>;
  setKeepScreenOn(options: { enabled: boolean }): Promise<void>;
}>("VisoNative");
export function NativeSurface() {
  const location = useLocation();
  useEffect(() => {
    if (!isTeavisoAndroid()) return;
    const inCall = location.pathname.startsWith("/timbre/call/");
    void native
      .setScreenOrientation({ mode: inCall ? "automatic" : "portrait" })
      .catch(() => undefined);
    void native.setKeepScreenOn({ enabled: inCall }).catch(() => undefined);
    document.documentElement.dataset.teavisoNative = "true";
  }, [location.pathname]);
  return null;
}
export function NativeCallSetup() {
  return isTeavisoAndroid() ? (
    <section className="av-card av-stack teaviso-native-notifications">
      <TimbrePushSettings />
    </section>
  ) : null;
}
