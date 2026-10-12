"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImageOff, Loader2, Search, Sparkles } from "lucide-react";
import type { LibraryStatus, MediaType, SearchResultItem } from "@ambl/types";
import { addTitleAction, addMangabakaTitleAction } from "@/actions/library";
import { Badge } from "@/components/ui/badge";
import { ProviderIcon } from "@/components/provider-icon";
import { cn } from "@/lib/utils";
import {
  defaultStatusForType,
  mediaStatusBadge,
  mediaStatusLabel,
  mediaTypeLabel,
  planStatusForType,
} from "@/lib/format";
import { useSearch } from "@/components/search-context";

interface SearchItem extends SearchResultItem {
  titleId: string | null;
  inLibrary: boolean;
  source?: string;
}

function itemKey(item: SearchItem) {
  return `${item.malId ?? ""}-${item.anilistId ?? ""}-${item.mangabakaId ?? ""}-${item.title}`;
}

const TYPE_TABS: { key: "MANGA" | "ANIME"; label: string }[] = [
  { key: "MANGA", label: "Manga" },
  { key: "ANIME", label: "Anime" },
];

const SOURCE_TABS: { key: "all" | "mal" | "mangabaka" | "anilist"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mal", label: "MAL" },
  { key: "mangabaka", label: "MangaBaka" },
  { key: "anilist", label: "AniList" },
];

export function CommandSearch() {
  const { query, setQuery, type, setType, source, setSource, open, setOpen } = useSearch();
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  const runSearch = useCallback(async (q: string, searchType: string, searchSource: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q, type: searchType, limit: "12", source: searchSource });
      const res = await fetch(`/api/search?${params}`, { signal: controller.signal });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Search failed");
      }
      const data = await res.json();
      setItems(data.items ?? []);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }
    const t = setTimeout(() => void runSearch(q, type, source), 350);
    return () => clearTimeout(t);
  }, [query, type, source, runSearch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing =
        el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape") {
        inputRef.current?.blur();
        setOpen(false);
      }
    };
    const focus = () => {
      inputRef.current?.focus();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("ambl:focus-search", focus);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("ambl:focus-search", focus);
    };
  }, [setOpen]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [setOpen]);

  const add = async (item: SearchItem, status: LibraryStatus) => {
    const key = itemKey(item);
    setPendingKey(key);
    const res =
      item.malId != null
        ? await addTitleAction({
            malId: item.malId,
            mediaType: item.mediaType as MediaType,
            status,
          })
        : item.mangabakaId != null
          ? await addMangabakaTitleAction({ mangabakaId: item.mangabakaId, status })
          : null;
    setPendingKey(null);
    if (!res) {
      setError("This title can't be added right now.");
      return;
    }
    if (res.ok && res.data?.titleId) {
      setAdded((prev) => ({ ...prev, [key]: res.data!.titleId }));
      router.refresh();
    } else {
      setError(res.error ?? "Could not add this title.");
    }
  };

  const showPanel = open && query.trim().length >= 2;

  return (
    <div data-command-search className="sticky bottom-0 z-40 mt-auto">
      <div className="mx-auto w-full max-w-3xl px-3 pb-3 sm:pb-4">
        <div ref={rootRef} className="relative">
          {showPanel && (
            <div className="absolute bottom-full mb-2 max-h-[60vh] w-full overflow-y-auto rounded-2xl border bg-card/95 p-1.5 shadow-2xl backdrop-blur-xl">
              {loading && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                </div>
              )}
              {!loading && error && (
                <p className="m-1 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              {!loading && !error && items.length === 0 && (
                <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4" /> Nothing found for "{query.trim()}".
                </div>
              )}
              {!loading &&
                items.map((item) => {
                  const key = itemKey(item);
                  const busy = pendingKey !== null;
                  const addedId = added[key];
                  const inLibrary = item.inLibrary || Boolean(addedId);
                  const progress = item.providerProgress;
                  return (
                    <div
                      key={itemKey(item)}
                      className={cn(
                        "group flex items-start gap-3 rounded-xl p-2 transition-colors",
                        !inLibrary && "cursor-pointer hover:bg-accent/60",
                      )}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (!busy && !inLibrary) void add(item, defaultStatusForType(item.mediaType));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !busy && !inLibrary) {
                          void add(item, defaultStatusForType(item.mediaType));
                        }
                      }}
                    >
                      {item.coverUrl ? (
                        <img
                          src={item.coverUrl}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-[76px] w-[54px] shrink-0 rounded-md object-cover ring-1 ring-border"
                        />
                      ) : (
                        <div className="flex h-[76px] w-[54px] shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <ImageOff className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                          <p className="truncate text-sm font-medium">{item.title}</p>
                          {item.source && (
                            <span
                              className={cn(
                                "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                item.source === "mangabaka"
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                  : item.source === "anilist"
                                  ? "bg-purple-500/15 text-purple-700 dark:text-purple-300"
                                  : "bg-sky-500/15 text-sky-700 dark:text-sky-300",
                              )}
                            >
                              <ProviderIcon provider={item.source} />
                              {item.source === "mangabaka" ? "MangaBaka" : item.source === "anilist" ? "AniList" : "MAL"}
                            </span>
                          )}
                        </div>
                        {item.englishTitle && item.englishTitle !== item.title && (
                          <p className="truncate text-xs text-muted-foreground">
                            {item.englishTitle}
                          </p>
                        )}
                        {item.synopsis && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground/90">
                            {item.synopsis}
                          </p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline">{mediaTypeLabel(item.mediaType)}</Badge>
                          {item.status && (
                            <Badge variant={mediaStatusBadge(item.status)}>
                              {mediaStatusLabel(item.status)}
                            </Badge>
                          )}
                          {item.year && <Badge variant="secondary">{item.year}</Badge>}
                          {item.genres.slice(0, 3).map((genre) => (
                            <span
                              key={genre}
                              className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {genre}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                        {inLibrary ? (
                          <Badge variant="success" className="gap-1">
                            <Check className="h-3 w-3" /> In library
                          </Badge>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={(e) => {
                                e.stopPropagation();
                                void add(item, planStatusForType(item.mediaType));
                              }}
                              className="hidden rounded-md border border-input px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50 sm:inline-flex"
                            >
                              Plan
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={(e) => {
                                e.stopPropagation();
                                void add(item, defaultStatusForType(item.mediaType));
                              }}
                              className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                            >
                              {pendingKey === key ? "Adding…" : "Add"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          <div
            className={cn(
              "flex items-center gap-1.5 rounded-2xl border bg-card/95 p-1.5 shadow-xl backdrop-blur-xl transition-shadow",
              open ? "ring-2 ring-ring/50" : "ring-1 ring-transparent",
            )}
          >
            <Search className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              placeholder="Search and add a title…"
              aria-label="Search and add a title"
              className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <div className="flex shrink-0 items-center gap-0.5 rounded-xl bg-muted/60 p-0.5">
              {TYPE_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setType(tab.key)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                    type === tab.key
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
              <div className="flex shrink-0 items-center gap-0.5 rounded-xl bg-muted/60 p-0.5">
                {SOURCE_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSource(tab.key as any)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                      source === tab.key
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <kbd className="mr-1 hidden shrink-0 rounded-md border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
              /
            </kbd>
          </div>
        </div>
      </div>
    </div>
  );
}