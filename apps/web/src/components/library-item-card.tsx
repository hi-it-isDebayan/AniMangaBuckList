"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenText, Play, Trash2 } from "lucide-react";
import type { LibraryStatus, MediaType } from "@ambl/types";
import { removeFromLibraryAction } from "@/actions/library";
import { FavoriteButton } from "@/components/favorite-button";
import { StatusSelect } from "@/components/status-select";
import { MediaTypeBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  progressUnitForType,
  relativeTime,
  statusAccentClass,
} from "@/lib/format";

export interface LibraryRowData {
  titleId: string;
  title: string;
  englishTitle: string | null;
  mediaType: MediaType;
  status: LibraryStatus;
  isFavorite: boolean;
  year: number | null;
  coverUrl: string | null;
  openedChapter: number | null;
  completedChapter: number | null;
  openedEpisode: number | null;
  completedEpisode: number | null;
  lastSourceUrl: string | null;
  updatedAt: Date | string;
}

export function LibraryItemCard({ item }: { item: LibraryRowData }) {
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  const unit = progressUnitForType(item.mediaType);
  const opened = unit === "EPISODE" ? item.openedEpisode : item.openedChapter;
  const completed =
    unit === "EPISODE" ? item.completedEpisode : item.completedChapter;
  const current = Math.max(opened ?? 0, completed ?? 0);

  return (
    <div className="card-hover group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <span
        className={cn("absolute inset-x-0 top-0 z-10 h-1", statusAccentClass(item.status))}
      />
      <div className="relative shrink-0 overflow-hidden bg-muted">
        <Link href={`/title/${item.titleId}`} className="block">
          {item.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.coverUrl}
              alt={item.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="aspect-[2/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
            />
          ) : (
            <span className="cover-fallback flex aspect-[2/3] w-full items-center justify-center text-muted-foreground">
              <BookOpenText className="h-10 w-10" />
            </span>
          )}
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/20 opacity-60 transition-opacity duration-300 group-hover:opacity-40" />
        </Link>
        <span
          className={cn(
            "absolute left-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-md",
            statusAccentClass(item.status),
          )}
        >
          {item.status.replaceAll("_", " ").toLowerCase()}
        </span>
        <span className="absolute right-2 top-2 rounded-lg bg-black/30 backdrop-blur-md">
          <FavoriteButton titleId={item.titleId} favorite={item.isFavorite} />
        </span>
        <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
          {unit.charAt(0) + unit.slice(1).toLowerCase()} {current}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <Link
            href={`/title/${item.titleId}`}
            className="line-clamp-2 font-medium leading-snug group-hover:text-primary"
          >
            {item.title}
          </Link>
          {item.englishTitle && item.englishTitle !== item.title && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {item.englishTitle}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <MediaTypeBadge type={item.mediaType} />
          {item.year && (
            <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">
              {item.year}
            </span>
          )}
          <span className="ml-auto text-[11px] text-muted-foreground/70">
            {relativeTime(item.updatedAt)}
          </span>
        </div>

        <div className="mt-auto flex items-center gap-1.5 pt-1">
          <StatusSelect titleId={item.titleId} status={item.status} />
          <div className="ml-auto flex items-center gap-1">
            {item.lastSourceUrl && (
              <a
                href={item.lastSourceUrl}
                target="_blank"
                rel="noreferrer"
                title="Open last source"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Play className="h-3.5 w-3.5" />
              </a>
            )}
            {confirming ? (
              <Button
                size="sm"
                variant="destructive"
                className="h-8 px-2"
                onClick={async () => {
                  await removeFromLibraryAction({ titleId: item.titleId });
                  router.refresh();
                }}
              >
                Remove?
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setConfirming(true)}
                aria-label="Remove from library"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}