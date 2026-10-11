"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useDebounce } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LibraryItemRow } from "@/components/library-item-card";

interface LibrarySearchItem {
  titleId: string;
  title: string;
  englishTitle: string | null;
  mediaType: string;
  status: string;
  year: number | null;
  coverUrl: string | null;
}

export function LibrarySearch() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<LibrarySearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  const runSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, limit: "20" });
      const res = await fetch(`/api/library/search?${params}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setItems(data.items ?? []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      runSearch(debouncedQuery);
    } else {
      setItems([]);
    }
  }, [debouncedQuery, runSearch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing =
        el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        document.getElementById("library-search-input")?.focus();
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative w-full max-w-2xl">
      <div className="relative">
        <input
          id="library-search-input"
          ref={inputRef}
          type="text"
          placeholder="Search your library…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          aria-label="Search your library"
          className="h-9 w-full rounded-xl border bg-card/95 px-9 py-1.5 text-sm outline-none placeholder:text-muted-foreground bg-card/95 backdrop-blur-xl shadow-xl"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        {query.length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border bg-card shadow-xl">
            <div className="max-h-[50vh] overflow-y-auto p-1">
              {items.map((item) => (
                <button
                  key={item.titleId}
                  onClick={() => {
                    window.location.href = `/title/${item.titleId}`;
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-accent rounded-lg transition-colors"
                >
                  {item.coverUrl ? (
                    <img
                      src={item.coverUrl}
                      alt=""
                      className="h-10 w-7 shrink-0 rounded object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-10 w-7 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                      {item.title.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    {item.englishTitle && item.englishTitle !== item.title && (
                      <p className="truncate text-xs text-muted-foreground">{item.englishTitle}</p>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="capitalize">{item.mediaType.toLowerCase()}</span>
                      <span>·</span>
                      <span>{item.status}</span>
                      {item.year && <span>· {item.year}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}