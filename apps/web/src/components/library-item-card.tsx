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

export function LibraryItemRow({
  item,
  viewMode = "list",
}: { item: LibraryRowData; viewMode?: "grid" | "list" }) {
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  const unit = progressUnitForType(item.mediaType);
  const opened = unit === "EPISODE" ? item.openedEpisode : item.openedChapter;
  const completed = unit === "EPISODE" ? item.completedEpisode : item.completedChapter;
  const current = Math.max(opened ?? 0, completed ?? 0);
  const label = unit === "EPISODE" ? "Episode" : "Chapter";

  const isGrid = viewMode === "grid";

  return (
    <div
      className={cn(
        "card-hover group relative overflow-hidden rounded-xl border bg-card shadow-sm",
        isGrid
          ? "flex flex-col items-center gap-3 p-3"
          : "flex items-center gap-3 overflow-hidden rounded-xl border bg-card p-2.5 pr-3 shadow-sm sm:gap-4 sm:p-3"
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", statusAccentClass(item.status))} />

      <Link
        href={"/title/" + item.titleId}
        className={cn(
          "relative shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border",
          isGrid ? "w-full aspect-square" : "shrink-0 overflow-hidden rounded-lg"
        )}
      >
        {item.coverUrl ? (
          <img
            src={item.coverUrl}
            alt={item.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            className={cn(
              "object-cover transition-transform duration-500 group-hover:scale-105",
              isGrid ? "h-full w-full" : "h-[72px] w-[52px] transition-transform duration-500 group-hover:scale-105"
            )}
          />
        ) : (
          <span
            className={cn(
              "cover-fallback flex items-center justify-center text-muted-foreground",
              isGrid ? "h-full w-full" : "h-[72px] w-[52px]"
            )}
          >
            <BookOpenText className="h-6 w-6" />
          </span>
        )}
      </Link>

      <div className={cn("min-w-0", isGrid ? "w-full text-center" : "min-w-0 flex-1")}>
        <div className={cn("flex items-start gap-2", isGrid ? "flex-col items-center" : "flex items-start gap-2")}>
          <div className="min-w-0 flex-1">
            <Link
              href={"/title/" + item.titleId}
              className={cn(
                "font-medium leading-snug transition-colors group-hover:text-primary",
                isGrid ? "line-clamp-2 text-center" : "line-clamp-1 leading-snug"
              )}
            >
              {item.title}
            </Link>
            {item.englishTitle && item.englishTitle !== item.title && (
              <p className={cn("line-clamp-1 text-xs text-muted-foreground", isGrid ? "text-center" : "")}>
                {item.englishTitle}
              </p>
            )}
          </div>
          <span className="hidden shrink-0 text-[11px] text-muted-foreground/70 sm:block">
            {relativeTime(item.updatedAt)}
          </span>
        </div>

        <div className={cn("mt-1.5 flex flex-wrap items-center gap-1.5", isGrid ? "justify-center" : "")}>
          <Badge variant="outline">{mediaTypeLabel(item.mediaType)}</Badge>
          {item.year && <Badge variant="secondary">{item.year}</Badge>}
          <Badge className="bg-primary/15 text-primary">
            {label} {current}
          </Badge>
          <span className="text-[11px] text-muted-foreground sm:hidden">
            {relativeTime(item.updatedAt)}
          </span>
        </div>

        <div className={cn("mt-2 flex items-center gap-2", isGrid ? "justify-center" : "")}>
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