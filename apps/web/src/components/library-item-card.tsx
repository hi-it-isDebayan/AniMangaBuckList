"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenText, ExternalLink, Trash2 } from "lucide-react";
import type { LibraryStatus, MediaType } from "@ambl/types";
import { removeFromLibraryAction } from "@/actions/library";
import { FavoriteButton } from "@/components/favorite-button";
import { StatusSelect } from "@/components/status-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  mediaTypeLabel,
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

export function LibraryItemRow({ item }: { item: LibraryRowData }) {
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  const unit = progressUnitForType(item.mediaType);
  const opened = unit === "EPISODE" ? item.openedEpisode : item.openedChapter;
  const completed =
    unit === "EPISODE" ? item.completedEpisode : item.completedChapter;
  const current = Math.max(opened ?? 0, completed ?? 0);
  const label = unit === "EPISODE" ? "Episode" : "Chapter";

  return (
    <div className="card-hover group relative flex items-center gap-3 overflow-hidden rounded-xl border bg-card p-2.5 pr-3 shadow-sm sm:gap-4 sm:p-3">
      <span className={cn("absolute inset-y-0 left-0 w-1", statusAccentClass(item.status))} />

      <Link
        href={`/title/${item.titleId}`}
        className="relative shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border"
      >
        {item.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.coverUrl}
            alt={item.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-[72px] w-[52px] object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="cover-fallback flex h-[72px] w-[52px] items-center justify-center text-muted-foreground">
            <BookOpenText className="h-6 w-6" />
          </span>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Link
              href={`/title/${item.titleId}`}
              className="line-clamp-1 font-medium leading-snug transition-colors group-hover:text-primary"
            >
              {item.title}
            </Link>
            {item.englishTitle && item.englishTitle !== item.title && (
              <p className="line-clamp-1 text-xs text-muted-foreground">{item.englishTitle}</p>
            )}
          </div>
          <span className="hidden shrink-0 text-[11px] text-muted-foreground/70 sm:block">
            {relativeTime(item.updatedAt)}
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{mediaTypeLabel(item.mediaType)}</Badge>
          {item.year && <Badge variant="secondary">{item.year}</Badge>}
          <Badge className="bg-primary/15 text-primary">
            {label} {current}
          </Badge>
          <span className="text-[11px] text-muted-foreground sm:hidden">
            {relativeTime(item.updatedAt)}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <StatusSelect titleId={item.titleId} status={item.status} />
          <div className="ml-auto flex items-center gap-1">
            {item.lastSourceUrl && (
              <a
                href={item.lastSourceUrl}
                target="_blank"
                rel="noreferrer"
                title="Open last source"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <FavoriteButton titleId={item.titleId} favorite={item.isFavorite} />
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
                className="h-8 w-8 text-muted-foreground"
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

export function LibraryItemCard({ item }: { item: LibraryRowData }) {
  return <LibraryItemRow item={item} />;
}
