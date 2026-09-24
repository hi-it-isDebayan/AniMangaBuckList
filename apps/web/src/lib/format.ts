import type { LibraryStatus, MediaType, ProgressUnit } from "@ambl/types";

export const LIBRARY_STATUSES: LibraryStatus[] = [
  "CURRENTLY_WATCHING",
  "CURRENTLY_READING",
  "PLAN_TO_WATCH",
  "PLAN_TO_READ",
  "COMPLETED",
  "ON_HOLD",
  "DROPPED",
];

export function mediaTypeLabel(type: MediaType): string {
  switch (type) {
    case "ANIME":
      return "Anime";
    case "MANGA":
      return "Manga";
    case "MANHWA":
      return "Manhwa";
    case "MANHUA":
      return "Manhua";
    case "LIGHT_NOVEL":
      return "Light Novel";
    case "WEB_NOVEL":
      return "Web Novel";
  }
}

export function progressUnitForType(type: MediaType): ProgressUnit {
  return type === "ANIME" ? "EPISODE" : "CHAPTER";
}

export function defaultStatusForType(type: MediaType): LibraryStatus {
  return type === "ANIME" ? "CURRENTLY_WATCHING" : "CURRENTLY_READING";
}

export function planStatusForType(type: MediaType): LibraryStatus {
  return type === "ANIME" ? "PLAN_TO_WATCH" : "PLAN_TO_READ";
}

export function libraryStatusLabel(status: LibraryStatus): string {
  switch (status) {
    case "CURRENTLY_WATCHING":
      return "Watching";
    case "CURRENTLY_READING":
      return "Reading";
    case "PLAN_TO_WATCH":
      return "Plan to Watch";
    case "PLAN_TO_READ":
      return "Plan to Read";
    case "COMPLETED":
      return "Completed";
    case "ON_HOLD":
      return "On Hold";
    case "DROPPED":
      return "Dropped";
  }
}

export function libraryStatusBadge(status: LibraryStatus): "default" | "secondary" | "success" | "warning" | "danger" {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "DROPPED":
      return "danger";
    case "ON_HOLD":
      return "warning";
    case "PLAN_TO_WATCH":
    case "PLAN_TO_READ":
      return "secondary";
    default:
      return "default";
  }
}

export function relationTypeLabel(type: string): string {
  return type
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function relativeTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

export function greetingForHour(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}