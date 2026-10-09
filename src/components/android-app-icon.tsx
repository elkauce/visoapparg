import { useEffect, useState, type ReactNode } from "react";
import { AppWindow } from "lucide-react";
import { isAndroidNative, nativeDeck } from "@/lib/android-native.ts";

interface AndroidAppIconProps {
  packageName: string;
  className?: string;
  fallback?: ReactNode;
}

/** Icons are read from Android on demand; no icon data is saved to account settings. */
export function AndroidAppIcon({ packageName, className, fallback }: AndroidAppIconProps) {
  const [loaded, setLoaded] = useState<{ packageName: string; icon: string | null } | null>(null);

  useEffect(() => {
    if (!isAndroidNative() || !packageName) return;
    let active = true;
    void nativeDeck.getAppIcon(packageName).then((icon) => {
      // The bridge only returns small PNGs. Reject other URI types before rendering.
      const safeIcon = icon && icon.length <= 100_000 && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(icon) ? icon : null;
      if (active) setLoaded({ packageName, icon: safeIcon });
    }).catch(() => {
      if (active) setLoaded({ packageName, icon: null });
    });
    return () => { active = false; };
  }, [packageName]);

  const icon = isAndroidNative() && loaded?.packageName === packageName ? loaded.icon : null;
  if (icon) return <img src={icon} alt="" className={className} style={{ objectFit: "contain" }} draggable={false} />;
  return <>{fallback ?? <AppWindow className={className} aria-hidden="true" />}</>;
}

export default AndroidAppIcon;
