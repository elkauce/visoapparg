import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.teaviso.app",
  appName: "Te Aviso",
  webDir: "dist-android",
  loggingBehavior: "none",
  server: { androidScheme: "https" },
  android: {
    backgroundColor: "#F5F3EF",
    allowMixedContent: process.env.TEAVISO_ANDROID_LOCAL_TEST === "1",
    webContentsDebuggingEnabled: process.env.TEAVISO_ANDROID_LOCAL_TEST === "1",
  },
};

export default config;
