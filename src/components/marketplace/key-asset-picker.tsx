import { useAction, useQuery } from "convex/react";
import { Component, type ReactNode } from "react";
import { Film, ImageIcon, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { BUILTIN_MARKETPLACE_PRODUCTS } from "@/convex/lib/marketplace_catalog.ts";
import { uploadBuiltinKeyMedia } from "@/pages/deck/_lib/upload-media.ts";

export type KeyLibrarySelection = {
  id: string;
  name: string;
  previewUrl: string;
  mediaType: "image" | "video";
  load: (token: string | null) => Promise<{
    storageId: Id<"_storage">;
    mediaType: "image" | "video";
  }>;
};

type PickerProduct = {
  productId: string;
  title: string;
  assets: {
    id: string;
    name: string;
    mediaType: "image" | "video" | "audio" | "archive" | "profile";
    builtinPath?: string;
    url?: string | null;
    mimeType?: string;
  }[];
};

// Mounted only after choosing Biblioteca: the usual key editor does not query
// the marketplace or need its context to keep the existing editing flow.
class KeyLibraryBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert" className="text-sm text-muted-foreground">
        No pudimos cargar la biblioteca. Podés usar tus archivos o los iconos
        VISO de las otras pestañas.
      </p>
    ) : (
      this.props.children
    );
  }
}

export default function KeyAssetPicker(props: {
  onSelect: (selection: KeyLibrarySelection) => void;
}) {
  return (
    <KeyLibraryBoundary>
      <KeyAssetPickerContent {...props} />
    </KeyLibraryBoundary>
  );
}

function KeyAssetPickerContent({
  onSelect,
}: {
  onSelect: (selection: KeyLibrarySelection) => void;
}) {
  const library = useQuery(api.marketplace.library, {});
  const copyAsset = useAction(api.marketplace.copyAssetToDeck);
  const firstParty = BUILTIN_MARKETPLACE_PRODUCTS.filter(
    (product) =>
      product.priceMode === "free" &&
      (product.category === "icons" || product.category === "screensavers"),
  );
  const builtinIds = new Set(firstParty.map((product) => product.id));
  const acquired = (library ?? []).filter(
    (product) =>
      !builtinIds.has(product.productId) &&
      (product.category === "icons" || product.category === "screensavers"),
  );
  const products: PickerProduct[] = [
    ...firstParty.map((product) => ({
      productId: product.id,
      title: product.title,
      assets: product.assets.map((asset) => ({ ...asset, url: undefined })),
    })),
    ...acquired,
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Recursos VISO incluidos y paquetes que agregaste a tu biblioteca. Elige
        uno para esta tecla; se aplica al guardar.
      </p>
      <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
        {products.map((product) => {
          const visualAssets = product.assets.filter(
            (asset) =>
              asset.mediaType === "image" || asset.mediaType === "video",
          );
          if (!visualAssets.length) return null;
          return (
            <section key={product.productId} className="space-y-2">
              <h4 className="text-sm font-medium">{product.title}</h4>
              <div className="grid grid-cols-3 gap-2">
                {visualAssets.map((asset) => {
                  const mediaType = asset.mediaType as "image" | "video";
                  const previewUrl = asset.builtinPath ?? asset.url;
                  if (!previewUrl) return null;
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      className="group overflow-hidden rounded-xl border bg-card text-left transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
                      aria-label={`Usar ${asset.name} de ${product.title}`}
                      onClick={() =>
                        onSelect({
                          id: `${product.productId}/${asset.id}`,
                          name: asset.name,
                          mediaType,
                          previewUrl,
                          load: (token) =>
                            asset.builtinPath
                              ? uploadBuiltinKeyMedia(
                                  {
                                    builtinPath: asset.builtinPath,
                                    name: asset.name,
                                    mimeType: asset.mimeType,
                                  },
                                  token,
                                )
                              : copyAsset({
                                  productId: product.productId,
                                  assetId: asset.id,
                                }),
                        })
                      }
                    >
                      <div className="relative aspect-square overflow-hidden bg-black">
                        {mediaType === "video" ? (
                          <video
                            src={previewUrl}
                            muted
                            autoPlay
                            loop
                            playsInline
                            preload="metadata"
                            aria-hidden="true"
                            className="size-full object-cover"
                          />
                        ) : (
                          <img
                            src={previewUrl}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        )}
                        <span className="absolute bottom-1 right-1 rounded bg-black/70 p-1 text-white">
                          {mediaType === "video" ? (
                            <Film className="size-3" />
                          ) : (
                            <ImageIcon className="size-3" />
                          )}
                        </span>
                      </div>
                      <span className="block truncate px-2 py-1.5 text-xs">
                        {asset.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
        {library === undefined && (
          <p role="status" className="text-xs text-muted-foreground">
            Cargando tus paquetes…
          </p>
        )}
      </div>
      <Link
        to="/marketplace"
        className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        <ShoppingBag className="size-4" />
        Explorar Marketplace
      </Link>
    </div>
  );
}
