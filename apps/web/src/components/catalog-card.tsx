"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenText, Check, ExternalLink, Loader2, Plus, Star } from "lucide-react";
import type { LibraryStatus } from "@ambl/types";
import { addMangabakaTitleAction, addTitleAction } from "@/actions/library";
import { selectAddSource } from "@/lib/add-source";
import { catalogHref, type CatalogItem } from "@/lib/catalog";
import { Badge } from "@/components/ui/badge";
import {
  defaultStatusForType,
  mediaStatusBadge,
  mediaStatusLabel,
  mediaTypeLabel,
  planStatusForType,
} from "@/lib/format";
import { cn } from "@/lib/utils";

const SOURCE_LABELS: Record<string, string> = {
  local: "Catalogue",
  mangabaka: "MangaBaka",
  mal: "MAL",
  anilist: "AniList",
};

/**
 * One card for the whole catalogue. Discover and Search render the same card,
 * so a local catalogue row, a live MangaBaka hit and a MAL result share one
 * visual language and one add-to-library flow.
 */
export function CatalogCard({
  item,
  showSource = false,
}: {
  item: CatalogItem;
  showSource?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const href = catalogHref(item);
  const addSource = selectAddSource(item);
  const inLibrary = item.inLibrary || added;

  const add = async (plan: boolean) => {
    if (!addSource || pending) return;
    setPending(true);
    setError(null);
    const status: LibraryStatus = plan
      ? planStatusForType(item.mediaType)
      : defaultStatusForType(item.mediaType);

    const res =
      addSource === "mangabaka"
        ? await addMangabakaTitleAction({ mangabakaId: item.mangabakaId!, status })
        : await addTitleAction({
            malId: item.malId!,
            mediaType: item.mediaType,
            status,
          });

    setPending(false);
    if (res.ok) {
      setAdded(true);
      router.refresh();
    } else {
      setError(res.error ?? "Could not add this title.");
    }
  };

  const cover = item.coverUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.coverUrl}
      alt={item.title}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
    />
  ) : (
    <span className="cover-fallback flex h-full w-full items-center justify-center text-muted-foreground">
      <BookOpenText className="h-8 w-8" />
    </span>
  );

  return (
    <div className="card-hover group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="relative aspect-[2/3] overflow-hidden bg-muted">
        {href ? (
          <Link href={href} className="block h-full w-full" aria-label={item.title}>
            {cover}
          </Link>
        ) : (
          cover
        )}

        {item.score != null && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {item.score.toFixed(1)}
          </span>
        )}

        {showSource && (
          <span
            className={cn(
              "absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur",
              item.source === "mangabaka" || item.source === "local"
                ? "bg-emerald-500/85 text-white"
                : item.source === "anilist"
                  ? "bg-purple-500/85 text-white"
                  : "bg-sky-500/85 text-white",
            )}
          >
            {SOURCE_LABELS[item.source] ?? item.source}
          </span>
        )}

        {item.canonicalUrl && (
          <a
            href={item.canonicalUrl}
            target="_blank"
            rel="noreferrer"
            title="Open on MangaBaka"
            className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/80 group-hover:opacity-100"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          {href ? (
            <Link
              href={href}
              className="line-clamp-2 text-sm font-medium leading-snug transition-colors hover:text-primary"
              title={item.title}
            >
              {item.title}
            </Link>
          ) : (
            <p className="line-clamp-2 text-sm font-medium leading-snug">{item.title}</p>
          )}
          {item.nativeTitle && item.nativeTitle !== item.title && (
            <p className="line-clamp-1 text-xs text-muted-foreground">{item.nativeTitle}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{mediaTypeLabel(item.mediaType)}</Badge>
          {item.status && (
            <Badge variant={mediaStatusBadge(item.status)}>{mediaStatusLabel(item.status)}</Badge>
          )}
          {item.year && <Badge variant="secondary">{item.year}</Badge>}
        </div>

        <p className="text-[11px] text-muted-foreground">
          {item.chapterCount ? `${item.chapterCount} ch` : ""}
          {item.chapterCount && item.volumeCount ? " · " : ""}
          {item.volumeCount ? `${item.volumeCount} vol` : ""}
          {!item.chapterCount && !item.volumeCount
            ? item.episodeCount
              ? `${item.episodeCount} ep`
              : "Catalogue title"
            : ""}
        </p>

        <div className="mt-auto flex items-center gap-1.5 pt-1">
          {inLibrary ? (
            <Badge variant="success" className="gap-1">
              <Check className="h-3 w-3" /> In library
            </Badge>
          ) : !addSource ? (
            <Badge variant="secondary">No provider id</Badge>
          ) : (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => void add(true)}
                className="inline-flex h-8 items-center justify-center rounded-lg border border-input px-2.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
              >
                Plan
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void add(false)}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                {pending ? "Adding…" : "Add"}
              </button>
            </>
          )}
        </div>
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>
    </div>
  );
}

export function CatalogGrid({
  items,
  showSource = false,
}: {
  items: CatalogItem[];
  showSource?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((item) => (
        <CatalogCard key={item.key} item={item} showSource={showSource} />
      ))}
    </div>
  );
}
