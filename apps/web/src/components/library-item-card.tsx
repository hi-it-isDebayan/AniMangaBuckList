"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Trash2 } from "lucide-react";
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
} from "@/lib/format";

export interface LibraryRowData {
  titleId: string;
  title: string;
  englishTitle: string | null;
  mediaType: MediaType;
  status: LibraryStatus;
  isFavorite: boolean;
  year: number | null;
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
    <div
      className={cn(
        "group rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:border-primary/40 hover:shadow-md",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/title/${item.titleId}`} className="min-w-0">
          <p className="line-clamp-1 font-medium group-hover:text-primary">
            {item.title}
          </p>
          {item.englishTitle && item.englishTitle !== item.title && (
            <p className="truncate text-sm text-muted-foreground">
              {item.englishTitle}
            </p>
          )}
        </Link>
        <FavoriteButton titleId={item.titleId} favorite={item.isFavorite} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <MediaTypeBadge type={item.mediaType} />
        {item.year && (
          <span className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
            {item.year}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {unit.charAt(0) + unit.slice(1).toLowerCase()} {current}
        </span>
        <span className="text-xs text-muted-foreground">
          {relativeTime(item.updatedAt)}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <StatusSelect titleId={item.titleId} status={item.status} />
        <div className="ml-auto flex items-center gap-1">
          {item.lastSourceUrl && (
            <a
              href={item.lastSourceUrl}
              target="_blank"
              rel="noreferrer"
              title="Open last source"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Play className="h-3.5 w-3.5" />
            </a>
          )}
          {confirming ? (
            <Button
              size="sm"
              variant="destructive"
              className="h-8"
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
  );
}