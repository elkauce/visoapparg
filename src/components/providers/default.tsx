import { ConvexProvider } from "./convex.tsx";
import { QueryClientProvider } from "./query-client.tsx";
import { Toaster } from "../ui/sonner.tsx";
import { TooltipProvider } from "../ui/tooltip.tsx";

// VISO usa un tema oscuro único (estética de hardware), por eso no hay ThemeProvider
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
