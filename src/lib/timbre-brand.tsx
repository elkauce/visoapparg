import { createContext, useContext } from "react";
export const TimbreBrandContext = createContext({
  name: "VISO TIMBRE",
  standalone: false,
});
export function useTimbreBrand() {
  return useContext(TimbreBrandContext);
}
