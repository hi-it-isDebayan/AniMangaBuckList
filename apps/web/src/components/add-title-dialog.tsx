"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Loader2 } from "lucide-react";
import type { LibraryStatus, MediaType, SearchResultItem } from "@ambl/types";
import { addTitleAction } from "@/actions/library";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { defaultStatusForType, mediaTypeLabel, planStatusForType } from "@/lib/format";

interface SearchItem extends SearchResultItem {
  titleId: string | null;
  inLibrary: boolean;
}

export function AddTitleDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"ANIME" | "MANGA">("MANGA");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<number | null>(null);
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
    setPending(item.malId);
    const res = await addTitleAction({
      malId: item.malId ?? 0,
      mediaType: item.mediaType as MediaType,
      status,
    });
    setPending(null);
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

        <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
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
            items.map((item) => (
              <div
                key={item.malId}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.title}</p>
                  {item.englishTitle && item.englishTitle !== item.title && (
                    <p className="truncate text-sm text-muted-foreground">
                      {item.englishTitle}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">{mediaTypeLabel(item.mediaType)}</Badge>
                    {item.year && <Badge variant="secondary">{item.year}</Badge>}
                    {item.episodeCount != null && (
                      <Badge variant="secondary">{item.episodeCount} eps</Badge>
                    )}
                    {item.chapterCount != null && (
                      <Badge variant="secondary">{item.chapterCount} ch</Badge>
                    )}
                    {item.volumeCount != null && (
                      <Badge variant="secondary">{item.volumeCount} vol</Badge>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {item.inLibrary ? (
                    <Badge variant="secondary">In library</Badge>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending !== null}
                        onClick={() => add(item, planStatusForType(item.mediaType))}
                      >
                        Plan to
                      </Button>
                      <Button
                        size="sm"
                        disabled={pending !== null}
                        onClick={() => add(item, defaultStatusForType(item.mediaType))}
                      >
                        {pending === item.malId ? "Adding…" : "Add"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
        </div>
      </Dialog>
    </>
  );
}