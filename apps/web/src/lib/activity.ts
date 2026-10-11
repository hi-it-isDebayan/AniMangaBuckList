export interface ActivityDay {
  date: string;
  count: number;
}

export interface HeatmapCell extends ActivityDay {
  inRange: boolean;
}

export interface HeatmapWeek {
  days: HeatmapCell[];
  monthLabel: string | null;
}

const DAY_MS = 86_400_000;
const MONTHS = [
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

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function buildHeatmap(
  rows: ActivityDay[],
  weeks = 52,
  today = new Date(),
): HeatmapWeek[] {
  const counts = new Map(rows.map((r) => [r.date, r.count]));
  const end = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const startBase = new Date(end.getTime() - (weeks * 7 - 1) * DAY_MS);
  const start = new Date(startBase.getTime() - startBase.getUTCDay() * DAY_MS);

  const days: HeatmapCell[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    const date = isoDay(new Date(t));
    days.push({ date, count: counts.get(date) ?? 0, inRange: true });
  }

  const result: HeatmapWeek[] = [];
  let lastMonth = -1;
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    const first = chunk[0];
    const month = first ? new Date(first.date).getUTCMonth() : -1;
    const firstOfMonth = month !== lastMonth;
    lastMonth = month;
    result.push({
      days: chunk,
      monthLabel: firstOfMonth && first ? MONTHS[month] : null,
    });
  }
  return result;
}

export function buildHeatmapGitHubStyle(
  rows: ActivityDay[],
  weeks = 52,
  today = new Date(),
): HeatmapWeek[] {
  const counts = new Map(rows.map((r) => [r.date, r.count]));
  const end = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const startBase = new Date(end.getTime() - (weeks * 7 - 1) * DAY_MS);
  const start = new Date(startBase.getTime() - startBase.getUTCDay() * DAY_MS);

  const days: HeatmapCell[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    const date = isoDay(new Date(t));
    days.push({ date, count: counts.get(date) ?? 0, inRange: true });
  }

  const weekCount = Math.ceil(days.length / 7);
  const paddedDays = [...days];
  while (paddedDays.length < weekCount * 7) {
    const lastDate = new Date(paddedDays[paddedDays.length - 1].date);
    lastDate.setUTCDate(lastDate.getUTCDate() + 1);
    paddedDays.push({
      date: isoDay(lastDate),
      count: 0,
      inRange: false,
    });
  }

  const weeksData: HeatmapWeek[] = [];
  let lastMonth = -1;
  for (let w = 0; w < weekCount; w++) {
    const weekDays: HeatmapCell[] = [];
    for (let d = 0; d < 7; d++) {
      weekDays.push(paddedDays[w + d * weekCount]);
    }
    const first = weekDays[0];
    const month = first ? new Date(first.date).getUTCMonth() : -1;
    const firstOfMonth = month !== lastMonth;
    lastMonth = month;
    weeksData.push({
      days: weekDays,
      monthLabel: firstOfMonth && first ? MONTHS[month] : null,
    });
  }
  return weeksData;
}

export function heatLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

export const HEAT_CLASS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-muted",
  1: "bg-primary/25",
  2: "bg-primary/45",
  3: "bg-primary/70",
  4: "bg-primary",
};

export const GITHUB_HEAT_CLASS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-gray-100 dark:bg-gray-800",
  1: "bg-green-300 dark:bg-green-800",
  2: "bg-green-400 dark:bg-green-700",
  3: "bg-green-500 dark:bg-green-600",
  4: "bg-green-600 dark:bg-green-500",
};