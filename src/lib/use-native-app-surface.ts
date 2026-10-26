import { useLocation } from "react-router-dom";
import { isAndroidNative } from "./android-native";
export function useNativeAppSurface() {
  const { pathname } = useLocation();
  return (
    isAndroidNative() ||
    import.meta.env.VITE_ANDROID_PREVIEW === "true" ||
    pathname.startsWith("/android")
  );
}
