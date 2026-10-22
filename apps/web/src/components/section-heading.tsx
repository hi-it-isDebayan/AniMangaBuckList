import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared section header: an icon chip + display title, optional count badge and
 * an optional "View all" link. Used across the dashboard and list pages so
 * every section starts with the same rhythm.
 */
export function SectionHeading({
  icon: Icon,
  title,
  count,
  href,
  linkLabel = "View all",
  className,
}: {
  icon?: LucideIcon;
  title: string;
  count?: number;
  href?: string;
  linkLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-3", className)}>
      <h2 className="flex items-center gap-2.5">
        {Icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <span className="font-display text-lg font-bold tracking-tight">{title}</span>
        {typeof count === "number" && count > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
            {count}
          </span>
        )}
      </h2>
      {href && (
        <Link
          href={href}
          className="shrink-0 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          {linkLabel} <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}
