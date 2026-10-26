import { useRef, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { marketErrorMessage } from "@/lib/marketplace-upload";
import { ShoppingContext as Context } from "./use-shopping";
export function ShoppingProvider({ children }: { children: ReactNode }) {
  const data = useQuery(api.marketplace_shopping.get, {});
  const write = useMutation(api.marketplace_shopping.set);
  const writeFollow = useMutation(api.marketplace_shopping.follow);
  const pending = useRef(new Set<string>());
  async function set(
    productId: string,
    collection: "cart" | "saved",
    present: boolean,
  ) {
    const key = collection + productId;
    if (pending.current.has(key)) return false;
    pending.current.add(key);
    try {
      await write({ productId, collection, present });
      return true;
    } catch (e) {
      toast.error(
        marketErrorMessage(
          e,
          "No pudimos guardar el cambio. Revisá la conexión.",
        ),
      );
      return false;
    } finally {
      pending.current.delete(key);
    }
  }
  async function follow(creatorId: string, present: boolean) {
    const key = "creator" + creatorId;
    if (pending.current.has(key)) return false;
    pending.current.add(key);
    try {
      await writeFollow({ creatorId, present });
      return true;
    } catch (e) {
      toast.error(marketErrorMessage(e, "No pudimos guardar esta tienda."));
      return false;
    } finally {
      pending.current.delete(key);
    }
  }
  return (
    <Context.Provider
      value={{
        cart: data?.cart ?? [],
        saved: data?.saved ?? [],
        following: data?.following ?? [],
        follow,
        loading: data === undefined,
        set,
      }}
    >
      {children}
    </Context.Provider>
  );
}
