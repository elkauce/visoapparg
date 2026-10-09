import { useState } from "react";
import { cn } from "@/lib/utils.ts";

const OFFICIAL_LOGO_URL = "/brand/viso-logo.png";

/** The artwork is the original PNG supplied by the VISO brand owner. */
export function VisoBrand({
  logoUrl = import.meta.env.VITE_VISO_LOGO_URL,
  className,
}: {
  logoUrl?: string;
  className?: string;
}) {
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const configuredSource = logoUrl?.trim() || OFFICIAL_LOGO_URL;
  const source = failedUrls.includes(configuredSource) ? OFFICIAL_LOGO_URL : configuredSource;

  if (!failedUrls.includes(source)) {
    return <img src={source} alt="VISO" className={cn("h-10 w-auto max-w-40 object-contain", className)} onError={() => setFailedUrls((previous) => [...previous, source])} />;
  }

  // Keep the existing accessible heading if even the bundled image cannot load.
  return <span className={cn("text-3xl font-bold tracking-tight", className)}>VISO<span className="text-primary">.</span></span>;
}
