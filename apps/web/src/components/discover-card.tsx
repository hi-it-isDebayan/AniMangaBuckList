"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenText, Check, ExternalLink, Loader2, Plus, Star } from "lucide-react";
import type { DiscoverItem } from "@/lib/mangabaka";
import { addMangabakaTitleAction } from "@/actions/library";
import { Badge } from "@/components/ui/badge";
import {
  defaultStatusForType,
  mediaStatusBadge,
  mediaStatusLabel,
  mediaTypeLabel,
  planStatusForType,
} from "@/lib/format";

export function DiscoverCard({ item }: { item: DiscoverItem }) {
  const [pending, setPending] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const add = async (plan: boolean) => {
    setPending(true);
    setError(null);
    const res = await addMangabakaTitleAction({
      mangabakaId: item.id,
      status: plan ? planStatusForType(item.mediaType) : defaultStatusForType(item.mediaType),
    });
    setPending(false);
    if (res.ok) {
      setAdded(true);
      router.refresh();
    } else {
      setError(res.error ?? "Could not add this title.");
    }
  };

  return (
    <div className="card-hover group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="relative aspect-[2/3] overflow-hidden bg-muted">
        <Link href={`/series/${item.id}`} className="block h-full w-full" aria-label={item.title}>
          {item.coverUrl ? (
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
          )}
        </Link>
        {item.score != null && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {item.score.toFixed(1)}
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
          <Link
            href={`/series/${item.id}`}
            className="line-clamp-2 text-sm font-medium leading-snug transition-colors hover:text-primary"
            title={item.title}
          >
            {item.title}
          </Link>
          {item.nativeTitle && (
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
          {!item.chapterCount && !item.volumeCount ? "MangaBaka series" : ""}
        </p>

        <div className="mt-auto flex items-center gap-1.5 pt-1">
          {added ? (
            <Badge variant="success" className="gap-1">
              <Check className="h-3 w-3" /> In library
            </Badge>
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
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
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
