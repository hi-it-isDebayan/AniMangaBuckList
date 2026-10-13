import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  WORKING: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  DEGRADED: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  BROKEN: "bg-destructive/10 text-destructive",
  UNVERIFIED: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  WORKING: "Working",
  DEGRADED: "Degraded",
  BROKEN: "Broken",
  UNVERIFIED: "Unverified",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_STYLES[status] ?? STATUS_STYLES.UNVERIFIED,
      )}
    >
      {STATUS_LABELS[status] ?? "Unverified"}
    </span>
  );
}

export function ExtractorBadge({ status }: { status: string }) {
  if (status === "SUPPORTED") {
    return (
      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
        Extractor ready
      </span>
    );
  }
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      Awaiting extractor support
    </span>
  );
}
