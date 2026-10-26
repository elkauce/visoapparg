import type { StorefrontTarget } from "@/convex/lib/marketplace_storefront";
import type { MarketProduct } from "./types";
export { DEFAULT_STOREFRONT } from "@/convex/lib/marketplace_storefront";
export type {
  StorefrontConfiguration,
  StorefrontMedia,
  StorefrontTarget,
} from "@/convex/lib/marketplace_storefront";
export function storeMediaSource(
  media:
    | { builtinPath?: string; url?: string | null; externalUrl?: string }
    | undefined,
): string | null {
  if (!media) return null;
  const src = media.url ?? media.externalUrl ?? media.builtinPath;
  if (!src) return null;
  if (src.startsWith("blob:") && src.length < 500) return src;
  if (
    /^\/(marketplace|products|brand)\/[\w./-]+$/.test(src) &&
    !src.includes("..") &&
    !src.includes("//")
  )
    return src;
  try {
    const url = new URL(src);
    if (
      (url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) &&
      !url.username &&
      !url.password
    )
      return url.href;
  } catch {
    /* Missing media keeps its fallback. */
  }
  return null;
}
export function storefrontTargetUrl(target: StorefrontTarget): string {
  if (target.kind === "category" && target.value === "creators")
    return "/marketplace?view=creators";
  if (target.kind === "product")
    return `/marketplace/products/${encodeURIComponent(target.value)}`;
  return `/marketplace?${new URLSearchParams({ [target.kind === "category" ? "category" : "view"]: target.value })}`;
}
export function productVideo(product: MarketProduct) {
  return product.gallery?.find(
    (item) => item.mediaType === "video" && storeMediaSource(item),
  );
}
export function productCover(product: MarketProduct) {
  return (
    product.coverUrl ??
    product.gallery?.find((item) => item.mediaType === "image")?.url ??
    null
  );
}
export function creatorUrl(product: MarketProduct) {
  const ref = product.creatorRef ?? (product.builtin ? "viso" : undefined);
  return ref
    ? `/marketplace?${new URLSearchParams({ view: "creator", creator: ref })}`
    : null;
}
