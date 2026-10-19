import { ConvexProvider } from "./convex.tsx";
import { QueryClientProvider } from "./query-client.tsx";
import { Toaster } from "../ui/sonner.tsx";
import { TooltipProvider } from "../ui/tooltip.tsx";

// Deck/Display keep the hardware palette. WebSurfaceTheme scopes the light
// website palette to its home, account panel and portals.
export function DefaultProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProvider>
      <QueryClientProvider>
        <TooltipProvider>
          <Toaster theme="dark" />
          {children}
        </TooltipProvider>
      </QueryClientProvider>
    </ConvexProvider>
  );
}
