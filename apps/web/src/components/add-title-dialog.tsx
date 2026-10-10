"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Loader2, ImageOff } from "lucide-react";
import type { LibraryStatus, MediaType, SearchResultItem } from "@ambl/types";
import { addTitleAction } from "@/actions/library";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { ProviderIcon } from "@/components/provider-icon";
import { cn } from "@/lib/utils";
import { defaultStatusForType, mediaTypeLabel, planStatusForType } from "@/lib/format";

interface SearchItem extends SearchResultItem {
  titleId: string | null;
  inLibrary: boolean;
}

function itemKey(item: SearchItem) {
  return `${item.malId ?? ""}-${item.anilistId ?? ""}-${item.title}`;
}

export function AddTitleDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"ANIME" | "MANGA">("MANGA");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (q.length < 2) {
      setItems([]);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q, type, limit: "14" });
      const res = await fetch(`/api/search?${params}`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Search failed");
      }
      const data = await res.json();
      setItems(data.items ?? []);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, [query, type]);

  useEffect(() => {
    if (!open) return;
    if (query.trim().length < 2) return;
    const t = setTimeout(() => void runSearch(), 450);
    return () => clearTimeout(t);
  }, [open, query, type, runSearch]);

  const add = async (item: SearchItem, status: LibraryStatus) => {
    setPendingKey(itemKey(item));
    const res = await addTitleAction({
      malId: item.malId ?? 0,
      mediaType: item.mediaType as MediaType,
      status,
    });
    setPendingKey(null);
    if (res.ok && res.data?.titleId) {
      setOpen(false);
      router.refresh();
      router.push(`/title/${res.data.titleId}`);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add title
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add a title to your library"
        className="max-w-2xl"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="pl-9"
              placeholder="Search MyAnimeList…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runSearch();
              }}
            />
          </div>
          <Select
            className="w-36"
            value={type}
            onChange={(e) => setType(e.target.value as "ANIME" | "MANGA")}
          >
            <option value="MANGA">Manga / Books</option>
            <option value="ANIME">Anime</option>
          </Select>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Tap any result to add it straight to your library. Cover shows your latest progress from connected
          trackers.
        </p>

        <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </div>
          )}
          {!loading && error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {!loading && !error && query.trim().length >= 2 && items.length === 0 && (
            <EmptyState title="No results" description={`Nothing found for “${query}”. Try a different title.`} />
          )}
          {!loading &&
            items.map((item) => {
              const key = itemKey(item);
              const busy = pendingKey !== null;
              const addingThis = pendingKey === key;
              const progress = item.providerProgress;
              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!busy && !item.inLibrary) void add(item, defaultStatusForType(item.mediaType));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !busy && !item.inLibrary) {
                      void add(item, defaultStatusForType(item.mediaType));
                    }
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md border p-2.5 transition-colors",
                    !item.inLibrary && "hover:bg-accent/50 focus-visible:bg-accent/50",
                  )}
                >
                  {item.coverUrl ? (
                    <img
                      src={item.coverUrl}
                      alt=""
                      className="h-16 w-12 shrink-0 rounded-sm object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground">
                      <ImageOff className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-medium">{item.title}</p>
                      {progress && <ProviderIcon provider={progress.provider} title={`Tracked in ${progress.label}`} />}
                    </div>
                    {item.englishTitle && item.englishTitle !== item.title && (
                      <p className="truncate text-sm text-muted-foreground">{item.englishTitle}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">{mediaTypeLabel(item.mediaType)}</Badge>
                      {item.year && <Badge variant="secondary">{item.year}</Badge>}
                      {item.episodeCount != null && <Badge variant="secondary">{item.episodeCount} eps</Badge>}
                      {item.chapterCount != null && <Badge variant="secondary">{item.chapterCount} ch</Badge>}
                      {item.volumeCount != null && <Badge variant="secondary">{item.volumeCount} vol</Badge>}
                      {progress?.text && (
                        <Badge className="bg-primary/15 text-primary">
                          {progress.text}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 self-center">
                    {item.inLibrary ? (
                      <Badge variant="secondary">In library</Badge>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            void add(item, planStatusForType(item.mediaType));
                          }}
                        >
                          Plan to
                        </Button>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            void add(item, defaultStatusForType(item.mediaType));
                          }}
                        >
                          {addingThis ? "Adding…" : "Add"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </Dialog>
    </>
  );
}