import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useShopping } from "./use-shopping";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { ExternalLink, ShieldCheck, Store } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { externalMarketplaceNavigation } from "@/lib/marketplace-navigation";
import { externalPurchaseUrl, type MarketProduct } from "./types";
import { ProductCard } from "./page";
export default function StoreCreator({
  creatorId,
  products,
  onOpen,
}: {
  creatorId: string;
  products: MarketProduct[] | undefined;
  onOpen: (id: string) => void;
}) {
  const shopping = useShopping();
  const [pending, setPending] = useState(false);
  const creator = useQuery(api.marketplace_shopping.creator, { creatorId });
  if (creator === undefined) return <p role="status">Cargando la tienda…</p>;
  if (!creator)
    return (
      <div className="vm-empty">
        <Store />
        <h1>Esta tienda no está disponible</h1>
        <Link to="/marketplace">Explorar productos</Link>
      </div>
    );
  const website = externalPurchaseUrl(creator.website);
  const items = products?.filter(
    (p) => (p.creatorRef ?? (p.builtin ? "viso" : "")) === creatorId,
  );
  return (
    <section>
      <header className="vm-creator-store">
        <div className="vm-creator-avatar">
          {creator.displayName.slice(0, 1)}
        </div>
        <div>
          <h1>
            {creator.displayName}
            {creator.official && (
              <ShieldCheck aria-label="Tienda oficial VISO" />
            )}
          </h1>
          <p>{creator.bio}</p>
          {shopping && (
            <Button
              variant={
                shopping.following.includes(creator.id) ? "outline" : "default"
              }
              disabled={pending}
              aria-pressed={shopping.following.includes(creator.id)}
              onClick={async () => {
                setPending(true);
                try {
                  await shopping.follow(
                    creator.id,
                    !shopping.following.includes(creator.id),
                  );
                } finally {
                  setPending(false);
                }
              }}
            >
              {shopping.following.includes(creator.id)
                ? "Siguiendo"
                : "Seguir tienda"}
            </Button>
          )}
          {website && (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => externalMarketplaceNavigation(e, website)}
            >
              Sitio del creador
              <ExternalLink />
            </a>
          )}
        </div>
      </header>
      <div className="vm-section-heading">
        <h2>Productos</h2>
      </div>
      {items === undefined ? (
        <p role="status">Cargando productos…</p>
      ) : items.length ? (
        <div className="vm-product-grid">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} onOpen={() => onOpen(p.id)} />
          ))}
        </div>
      ) : (
        <div className="vm-empty">
          <h2>Pronto, nuevas creaciones</h2>
          <p>Las publicaciones aprobadas de esta tienda aparecerán aquí.</p>
        </div>
      )}
    </section>
  );
}

export function FollowingStores() {
  const rows = useQuery(api.marketplace_shopping.following, {});
  const shopping = useShopping();
  return (
    <section>
      <header className="vm-store-heading">
        <h1>Tiendas que seguís</h1>
      </header>
      {rows === undefined ? (
        <p role="status">Cargando tiendas…</p>
      ) : !rows?.length ? (
        <div className="vm-empty">
          <Store />
          <h2>Descubrí nuevos creadores</h2>
          <p>Entrá a la tienda de un producto y tocá Seguir tienda.</p>
          <Link to="/marketplace">Explorar productos</Link>
        </div>
      ) : (
        <div className="vm-store-account">
          {rows.map(({ creatorId, creator }) => (
            <article key={creatorId} className="vm-order-card">
              {creator ? (
                <Link
                  to={`/marketplace?view=creator&creator=${encodeURIComponent(creatorId)}`}
                >
                  <h2>{creator.displayName}</h2>
                  <p>{creator.bio}</p>
                </Link>
              ) : (
                <h2>Tienda no disponible</h2>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void shopping?.follow(creatorId, false)}
              >
                Dejar de seguir
              </Button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function CreatorDirectory() {
  const creators = useQuery(api.marketplace_shopping.creators, {});
  return (
    <section>
      <header className="vm-store-heading">
        <div>
          <h1>Creadores</h1>
          <p>Encontrá diseños para tu espacio VISO.</p>
        </div>
      </header>
      {creators === undefined ? (
        <p role="status">Cargando creadores…</p>
      ) : (
        <div className="vm-creator-directory">
          {(creators ?? []).map((creator) => (
            <Link
              key={creator.id}
              className="vm-creator-store"
              to={`/marketplace?view=creator&creator=${encodeURIComponent(creator.id)}`}
            >
              <div className="vm-creator-avatar">
                {creator.displayName.slice(0, 1)}
              </div>
              <div>
                <h2>
                  {creator.displayName}
                  {creator.official && (
                    <ShieldCheck aria-label="Tienda oficial VISO" />
                  )}
                </h2>
                <p>{creator.bio}</p>
                <strong>Visitar tienda</strong>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
