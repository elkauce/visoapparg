import { useQuery } from "convex/react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "@/convex/_generated/api";
export function useSpaces() {
  const rows = useQuery(api.teaviso_spaces.list, {}),
    [params, setParams] = useSearchParams();
  const route = useParams();
  const requested = route.spaceId ?? params.get("space");
  const selected =
    rows?.find((r) => r._id === requested) ??
    (route.spaceId ? undefined : rows?.[0]);
  return {
    rows,
    selected,
    choose: (id: string) => {
      const next = new URLSearchParams(params);
      next.set("space", id);
      setParams(next);
    },
  };
}
