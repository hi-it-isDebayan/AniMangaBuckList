"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, LayoutGrid, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  buildLibraryHref,
  hasPendingSearchChange,
  type LibraryFilterState,
} from "@/lib/library-filters";

export function LibraryToolbar({
  status,
  mediaType,
  tag,
  genre,
  sort,
  query,
  view = "list",
}: {
  status: string;
  mediaType: string;
  tag: string;
  genre: string;
  sort: string;
  query: string;
  view?: "grid" | "list";
}) {
  const router = useRouter();
  const [q, setQ] = useState(query);
  const [viewMode, setViewMode] = useState<"grid" | "list">(view);
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mirror URL changes (back/forward, filter links) into the local controls
  // instead of letting stale local state win.
  useEffect(() => setQ(query), [query]);
  useEffect(() => setViewMode(view), [view]);

  const cancelPending = useCallback(() => {
    if (pendingRef.current) {
      clearTimeout(pendingRef.current);
      pendingRef.current = null;
    }
  }, []);

  const apply = useCallback(
    (patch: LibraryFilterState) => {
      // A filter change supersedes any search still waiting to be flushed.
      // `q` is part of the base filters, so the search text is carried over
      // rather than dropped, and the stale timer cannot undo this change.
      cancelPending();
      router.replace(
        buildLibraryHref({ status, mediaType, tag, genre, sort, view: viewMode, q }, patch),
      );
    },
    [router, cancelPending, status, mediaType, tag, genre, sort, viewMode, q],
  );

  useEffect(() => {
    // Only flush a real edit. Without this guard the debounce also runs on
    // mount and after filter navigations, clobbering a newer selection.
    if (!hasPendingSearchChange(q, query)) return;
    pendingRef.current = setTimeout(() => {
      pendingRef.current = null;
      apply({ q: q.trim() });
    }, 400);
    return () => {
      if (pendingRef.current) {
        clearTimeout(pendingRef.current);
        pendingRef.current = null;
      }
    };
  }, [q, query, apply]);

  // A press on a control that starts navigation or changes a filter must not be
  // undone by an in-flight debounced search write. Drop the pending flush; the
  // control's navigation re-renders the toolbar, which re-schedules the write
  // against the new filter set.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.closest("[data-library-search]")) return;
      if (!target.closest("a, button, select, [role='tab']")) return;
      if (pendingRef.current) {
        clearTimeout(pendingRef.current);
        pendingRef.current = null;
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1" data-library-search>
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search your library…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <Select
        value={mediaType}
        className="sm:w-40"
        onChange={(e) => apply({ mediaType: e.target.value })}
        aria-label="Filter by media type"
      >
        <option value="">All types</option>
        <option value="ANIME">Anime</option>
        <option value="MANGA">Manga</option>
        <option value="MANHWA">Manhwa</option>
        <option value="MANHUA">Manhua</option>
        <option value="LIGHT_NOVEL">Light Novel</option>
        <option value="WEB_NOVEL">Web Novel</option>
      </Select>
      <Input
        placeholder="Tag…"
        value={tag}
        onChange={(e) => apply({ tag: e.target.value })}
        className="sm:w-32"
        aria-label="Filter by tag"
      />
      <Select
        value={sort}
        className="sm:w-40"
        onChange={(e) => apply({ sort: e.target.value })}
        aria-label="Sort"
      >
        <option value="updated">Recently updated</option>
        <option value="added">Recently added</option>
        <option value="title">Title (A–Z)</option>
      </Select>
      <div className="flex items-center gap-1">
        <Button
          variant={viewMode === "grid" ? "default" : "outline"}
          size="icon"
          onClick={() => apply({ view: "grid" })}
          aria-label="Grid view"
          title="Grid view"
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          variant={viewMode === "list" ? "default" : "outline"}
          size="icon"
          onClick={() => apply({ view: "list" })}
          aria-label="List view"
          title="List view"
        >
          <List className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
