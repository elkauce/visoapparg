import { render, screen } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { beforeEach, expect, it, vi } from "vitest";
import MarketplaceAdmin from "./admin";

const fixture = vi.hoisted(() => ({ queries: [] as string[] }));
vi.mock("convex/react", () => ({
  useQuery: (reference: Parameters<typeof getFunctionName>[0]) => {
    fixture.queries.push(getFunctionName(reference));
    return { isAdmin: false, creator: null, checkoutEnabled: false };
  },
  useMutation: () => vi.fn(),
}));
vi.mock("@convex-dev/auth/react", () => ({ useAuthToken: () => null }));
beforeEach(() => {
  fixture.queries = [];
});
it("never requests private approval queues for a non-administrator", () => {
  render(<MarketplaceAdmin />);
  expect(screen.getByText(/disponible para los administradores/)).toBeVisible();
  expect(fixture.queries).toEqual(["marketplace:session"]);
});
