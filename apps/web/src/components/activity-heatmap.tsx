import { cn } from "@/lib/utils";
import {
  buildHeatmapGitHubStyle,
  heatLevel,
  GITHUB_HEAT_CLASS,
  type ActivityDay,
} from "@/lib/activity";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ActivityHeatmap({
  data,
  weeks = 52,
  className,
}: {
  data: ActivityDay[];
  weeks?: number;
  className?: string;
}) {
  const grid = buildHeatmapGitHubStyle(data, weeks);
  const total = data.reduce((a, d) => a + d.count, 0);
  const activeDays = data.filter((d) => d.count > 0).length;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{total}</span> activities ·{" "}
          <span className="font-semibold text-foreground">{activeDays}</span> active days
        </span>
        <div className="flex items-center gap-1.5">
          <span>Less</span>
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <span
              key={level}
              className={cn("h-3 w-3 rounded-sm", GITHUB_HEAT_CLASS[level])}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="flex gap-1.5">
          <div className="flex shrink-0 flex-col gap-1 pb-4 text-[9px] leading-3 text-muted-foreground">
            {WEEKDAYS.map((d, i) => (
              <span key={i} className="flex h-3 items-center">
                {d}
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            {grid.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                <span className="h-3 text-[9px] leading-3 text-muted-foreground">
                  {week.monthLabel ?? ""}
                </span>
                {week.days.map((cell) => (
                  <span
                    key={cell.date}
                    title={`${cell.count} ${cell.count === 1 ? "activity" : "activities"} on ${cell.date}`}
                    className={cn(
                      "h-3 w-3 rounded-sm transition-colors",
                      cell.inRange ? GITHUB_HEAT_CLASS[heatLevel(cell.count)] : "bg-transparent",
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}