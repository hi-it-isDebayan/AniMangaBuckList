import { cn } from "@/lib/utils";
import type { SourceUsage } from "@/lib/sources/usage";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function label(month: string): string {
  const [, m] = month.split("-");
  const index = Number(m) - 1;
  return MONTH_LABELS[index] ?? month;
}

/**
 * Compact monthly histogram of how often a source was used. Renders as
 * dependency-free bars so it stays cheap inside a server component list.
 */
export function UsageHistogram({
  usage,
  className,
}: {
  usage: SourceUsage;
  className?: string;
}) {
  const max = Math.max(1, ...usage.monthly.map((point) => point.count));
  const hasData = usage.total > 0;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-muted-foreground">Monthly usage</span>
        <span className="text-xs text-muted-foreground">
          {hasData ? `${usage.total} visit${usage.total === 1 ? "" : "s"} · 6 mo` : "No usage yet"}
        </span>
      </div>
      <div className="flex items-end gap-1" role="img" aria-label={`Monthly usage: ${usage.monthly.map((p) => `${label(p.month)} ${p.count}`).join(", ")}`}>
        {usage.monthly.map((point, index) => {
          const isCurrent = index === usage.monthly.length - 1;
          const height = point.count === 0 ? 2 : Math.max(6, Math.round((point.count / max) * 40));
          return (
            <div key={point.month} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {point.count > 0 ? point.count : ""}
              </span>
              <div
                className={cn(
                  "w-full rounded-sm transition-colors",
                  isCurrent ? "bg-primary" : "bg-primary/45",
                  point.count === 0 && "bg-muted-foreground/20",
                )}
                style={{ height }}
                title={`${label(point.month)}: ${point.count}`}
              />
              <span className="text-[10px] text-muted-foreground">{label(point.month)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
