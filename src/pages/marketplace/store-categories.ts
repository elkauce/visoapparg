import {
  AudioLines,
  Compass,
  Image,
  Monitor,
  Package,
  PanelsTopLeft,
  Plug,
  Sparkles,
  Store,
} from "lucide-react";
export const STORE_CATEGORIES = [
  { id: "discover", label: "Todo", icon: Compass },
  { id: "icons", label: "Iconos", icon: Image },
  { id: "pages", label: "Páginas", icon: PanelsTopLeft },
  { id: "hardware", label: "Hardware", icon: Package },
  { id: "plugins", label: "Plugins", icon: Plug },
  { id: "profiles", label: "Perfiles", icon: PanelsTopLeft },
  { id: "screensavers", label: "Protectores", icon: Monitor },
  { id: "soundboards", label: "Sonidos", icon: AudioLines },
  { id: "new", label: "Nuevos", icon: Sparkles },
  { id: "used", label: "Usados", icon: Store },
] as const;
export type StoreCategory = (typeof STORE_CATEGORIES)[number]["id"];
