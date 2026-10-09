import { useState } from "react";
import { cn } from "@/lib/utils.ts";

/** The official artwork is supplied by the brand owner; no replacement logo is drawn here. */
export function VisoBrand({
  logoUrl = import.meta.env.VITE_VISO_LOGO_URL,
  className,
}: {
  logoUrl?: string;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const source = logoUrl?.trim();

  if (source && failedUrl !== source) {
    return <img src={source} alt="VISO" className={cn("h-10 w-auto max-w-40 object-contain", className)} onError={() => setFailedUrl(source)} />;
  }

  // Retain the existing heading until the original logo asset is available.
  return <span className={cn("text-3xl font-bold tracking-tight", className)}>VISO<span className="text-primary">.</span></span>;
}
