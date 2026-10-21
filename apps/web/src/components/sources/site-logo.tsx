"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The site's logo, masked into a circle. Falls back to a globe glyph when the
 * favicon cannot be loaded (offline, blocked, or missing).
 */
export function SiteLogo({
  domain,
  name,
  size = 36,
  className,
}: {
  domain: string;
  name?: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = (name || domain).replace(/^www\./, "").slice(0, 1).toUpperCase();

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {failed ? (
        <span className="text-sm font-semibold text-muted-foreground">{initials}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}
      <span className="sr-only">
        <Globe className="h-4 w-4" />
        {name ?? domain} logo
      </span>
    </span>
  );
}
