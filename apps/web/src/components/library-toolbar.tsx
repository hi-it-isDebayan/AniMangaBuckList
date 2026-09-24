"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function LibraryToolbar({
  status,
  mediaType,
  tag,
  sort,
  query,
}: {
  status: string;
  mediaType: string;
  tag: string;
  sort: string;
  query: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(query);

  const apply = (patch: Partial<Record<string, string>>) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    const nextQ = "q" in patch ? patch.q ?? "" : q;
    const merged: Record<string, string> = {
      q: nextQ.trim(),
      type: "type" in patch ? (patch.type ?? "") : mediaType,
      tag: "tag" in patch ? (patch.tag ?? "") : tag,
      sort: "sort" in patch ? (patch.sort ?? "") : sort,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }
    router.replace(`/library?${params.toString()}`);
  };

  useEffect(() => {
    const t = setTimeout(() => apply({ q }), 400);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
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
        onChange={(e) => apply({ type: e.target.value })}
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
    </div>
  );
}