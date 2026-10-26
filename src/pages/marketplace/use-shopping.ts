import { createContext, useContext } from "react";
import type { MarketProduct } from "./types";
type Collection = "cart" | "saved";
type Shopping = {
  cart: { productId: string; product: MarketProduct | null }[];
  saved: string[];
  following: string[];
  follow: (creatorId: string, present: boolean) => Promise<boolean>;
  loading: boolean;
  set: (
    productId: string,
    collection: Collection,
    present: boolean,
  ) => Promise<boolean>;
};
export const ShoppingContext = createContext<Shopping | undefined>(undefined);
export function useShopping() {
  return useContext(ShoppingContext);
}
