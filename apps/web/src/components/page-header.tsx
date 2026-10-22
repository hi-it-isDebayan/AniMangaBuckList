import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Consistent page opener used by Discover, New, Search, Library, Sources…
 * Renders an icon chip, a display-face title, an optional subtitle line and
 * optional right-aligned actions.
 */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="flex items-center gap-2.5 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {Icon && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Icon className="h-5 w-5" />
            </span>
          )}
          {title}
        </h1>
        {subtitle && (
          <div className="mt-1.5 text-sm text-muted-foreground">{subtitle}</div>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
