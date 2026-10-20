import type { MarketplaceCategory } from "@/convex/lib/marketplace_catalog";

export type MarketAsset = {
  id: string;
  name: string;
  mediaType: "image" | "video" | "audio" | "archive" | "profile";
  builtinPath?: string;
  url?: string | null;
  storageId?: string;
  mimeType?: string;
};

export type MarketProduct = {
  id: string;
  title: string;
  description: string;
  category: MarketplaceCategory;
  creatorName: string;
  coverUrl?: string | null;
  priceMode: "free" | "external" | "info";
  delivery: "assets" | "profile" | "plugin" | "inquiry";
  externalUrl?: string;
  affiliate: boolean;
  status: string;
  builtin: boolean;
  assetCount: number;
  acquired: boolean;
  owned: boolean;
  assets?: MarketAsset[];
};

export type MarketLibraryEntry = {
  productId: string;
  title: string;
  category: MarketplaceCategory;
  creatorName: string;
  delivery: "assets" | "profile" | "plugin" | "inquiry";
  acquiredAt: number;
  profileTemplate?: "essential";
  assets: MarketAsset[];
};

export const CATEGORY_LABELS: Record<MarketplaceCategory, string> = {
  icons: "Iconos",
  plugins: "Plugins",
  profiles: "Perfiles",
  screensavers: "Protectores",
  soundboards: "Sonidos",
  hardware: "Hardware",
  used: "Usados",
};

export function assetSource(asset: MarketAsset): string | null {
  if (
    asset.builtinPath?.startsWith("/marketplace/") &&
    !asset.builtinPath.includes("..") &&
    !asset.builtinPath.includes("\\")
  ) {
    return asset.builtinPath;
  }
  if (!asset.url) return null;
  try {
    const url = new URL(asset.url);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function externalPurchaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? value
      : null;
  } catch {
    return null;
  }
}
