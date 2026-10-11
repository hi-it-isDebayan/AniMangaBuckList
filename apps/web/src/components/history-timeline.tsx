"use client";

import Link from "next/link";
import { ExternalLink, Globe } from "lucide-react";

export interface HistoryItem {
  id: string;
  title: string | null;
  site: string | null;
  coverUrl: string | null;
  malId: number | null;
  unit: string;
  value: number | null;
  visitedAt: string;
}

function dayLabel(d: Date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export function HistoryTimeline({ items }: { items: HistoryItem[] }) {
  const groups: { label: string; items: HistoryItem[] }[] = [];
  for (const item of items) {
    const label = dayLabel(new Date(item.visitedAt));
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <div key={group.label}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label}
          </h2>
          <ol className="relative space-y-4 border-l border-border pl-4">
            {group.items.map((item) => (
              <li key={item.id} className="relative flex items-center gap-3">
                <span className="absolute -left-[21.5px] top-1.5 h-3 w-3 rounded-full border-2 border-emerald-500 bg-card" />
                {item.coverUrl ? (
                  <Link
                    href={item.malId ? "https://myanimelist.net/anime/" + item.malId : item.site}
                    className="shrink-0"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.malId ? "View on MyAnimeList" : "View source"}
                  >
                    <img
                      src={item.coverUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-border"
                    />
                  </Link>
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground">
                    {item.title?.slice(0, 2).toUpperCase() || "?"}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium">{item.title || "Unknown title"}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(item.visitedAt).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.unit === "EPISODE" ? "Episode" : "Chapter"} {item.value ?? "?"}
                    {item.site ? (
                      <span className="flex items-center gap-1 ml-1">
                        <Globe className="h-3 w-3" />
                        <span>{item.site}</span>
                      </span>
                    ) : null}
                  </p>
                </div>
                {item.malId && (
                  <Link
                    href={"https://myanimelist.net/anime/" + item.malId}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 shrink-0 text-xs text-primary hover:underline"
                    aria-label="View on MyAnimeList"
                  >
                    <span>MAL</span>
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}