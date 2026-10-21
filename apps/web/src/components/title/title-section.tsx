import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Card wrapper used for every section of both title detail pages. */
export function TitleSection({
  title,
  icon,
  action,
  children,
  className,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          {icon} {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm">{children}</dd>
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  trend,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: number | null;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-baseline gap-1.5 text-lg font-semibold">
        <span className="tabular-nums">{value}</span>
        {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
        {typeof trend === "number" && trend !== 0 && (
          <span
            className={
              trend < 0
                ? "text-xs font-medium text-success"
                : "text-xs font-medium text-destructive"
            }
            title={trend < 0 ? "Rank improved this month" : "Rank slipped this month"}
          >
            {trend < 0 ? "▲" : "▼"} {Math.abs(trend).toLocaleString()}
          </span>
        )}
      </p>
    </div>
  );
}

export function Contributor({
  label,
  values,
  icon,
}: {
  label: string;
  values: string[];
  icon?: ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span key={value} className="rounded-full bg-muted px-2.5 py-1 text-xs">
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}
