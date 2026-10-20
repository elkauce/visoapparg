import { createContext, useContext } from "react";
import type { GoogleAuthMode } from "./google-auth-flow";

interface NativeGoogleContextValue {
  ready: boolean;
  pending: boolean;
  start: (mode: GoogleAuthMode) => Promise<void>;
  cancel: () => Promise<void>;
}

export const NativeGoogleContext = createContext<NativeGoogleContextValue>({
  ready: false,
  pending: false,
  start: async () => {
    throw new Error("Google requiere la aplicación Android actualizada.");
  },
  cancel: async () => undefined,
});

export const useNativeGoogleAuth = () => useContext(NativeGoogleContext);
