import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed border-border/80 bg-card/30 p-12 text-center",
        "fade-in",
        className,
      )}
    >
      {/* faint radial wash so empty areas still feel designed */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--color-primary)_7%,transparent),transparent_65%)]"
      />
      {icon && (
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8 text-primary ring-1 ring-primary/15">
          {icon}
        </div>
      )}
      <p className="relative mt-1 font-display text-base font-semibold tracking-tight">{title}</p>
      {description && (
        <p className="relative max-w-sm text-sm text-balance text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="relative mt-3">{action}</div>}
    </div>
  );
}
