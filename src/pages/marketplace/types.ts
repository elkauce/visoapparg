import type {
  MarketplaceCategory,
  MarketplacePageTemplate,
} from "@/convex/lib/marketplace_catalog";

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
  priceMode: "free" | "external" | "info" | "paid";
  priceAmount?: number;
  currency?: "ARS" | "USD";
  condition?: "new" | "used";
  gallery?: MarketGalleryItem[];
  details?: MarketDetails;
  changelog?: MarketChangelog[];
  pageTemplate?: MarketplacePageTemplate;
  profileTemplate?: "essential";
  pageSettings?: Record<string, unknown>;
  canEdit?: boolean;
  hasDraft?: boolean;
  draftStatus?: "draft" | "pending" | "rejected";
  revision?: number;
  delivery: "assets" | "profile" | "plugin" | "inquiry" | "page";
  externalUrl?: string;
  affiliate: boolean;
  status: string;
  builtin: boolean;
  assetCount: number;
  acquired: boolean;
  owned: boolean;
  assets?: MarketAsset[];
};

export type MarketGalleryItem = {
  id: string;
  name: string;
  mediaType: "image" | "video";
  storageId?: string;
  builtinPath?: string;
  externalUrl?: string;
  url?: string | null;
};
export type MarketDetails = Partial<
  Record<
    | "type"
    | "device"
    | "os"
    | "compatibility"
    | "size"
    | "version"
    | "language"
    | "supportUrl"
    | "included"
    | "setup",
    string
  >
>;
export type MarketChangelog = { version: string; date: string; notes: string };

export function productPrice(
  product: Pick<MarketProduct, "priceMode" | "priceAmount" | "currency">,
): string {
  if (product.priceMode === "free") return "Gratis";
  if (Number.isSafeInteger(product.priceAmount) && product.priceAmount! > 0) {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: product.currency ?? "ARS",
      currencyDisplay: "code",
      minimumFractionDigits: product.priceAmount! % 100 ? 2 : 0,
    }).format(product.priceAmount! / 100);
  }
  return "Precio a confirmar";
}

export type MarketLibraryEntry = {
  productId: string;
  title: string;
  category: MarketplaceCategory;
  creatorName: string;
  delivery: "assets" | "profile" | "plugin" | "inquiry" | "page";
  acquiredAt: number;
  revision?: number;
  latestRevision?: number;
  latestVersion?: string;
  updateAvailable?: boolean;
  profileTemplate?: "essential";
  pageTemplate?: MarketplacePageTemplate;
  pageSettings?: Record<string, unknown>;
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
  new: "Nuevo",
  pages: "Página",
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
