import type { Metadata } from "next";
import { Compass, Search as SearchIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  DISCOVER_FORMATS,
  DISCOVER_SORTS,
  DISCOVER_YEARS,
  type DiscoverFormat,
  type DiscoverSort,
} from "@/lib/mangabaka";
import { searchCatalog } from "@/lib/search-catalog";
import { CatalogCard } from "@/components/catalog-card";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { SegmentedTabs } from "@/components/segmented-tabs";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Search" };
export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const sp = await searchParams;

  const q = String(sp.q ?? "").trim().slice(0, 120);

  const rawFormat = String(sp.format ?? "ALL").toUpperCase();
  const format: DiscoverFormat = DISCOVER_FORMATS.some((f) => f.key === rawFormat)
    ? (rawFormat as DiscoverFormat)
    : "ALL";

  const rawSort = String(sp.sort ?? "trending").toLowerCase();
  const sort: DiscoverSort = DISCOVER_SORTS.some((s) => s.key === rawSort)
    ? (rawSort as DiscoverSort)
    : "trending";

  const rawYear = String(sp.year ?? "all").toLowerCase();
  const year =
    rawYear !== "all" && (DISCOVER_YEARS as readonly number[]).includes(Number(rawYear))
      ? Number(rawYear)
      : null;

  const rawPage = Number(sp.page ?? 1);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const result = q
    ? await searchCatalog({ q, format, year, sort, page })
    : { items: [], count: 0, totalPages: 1, page: 1, localCount: 0, remoteCount: 0 };

  const buildHref = (overrides: {
    q?: string;
    format?: DiscoverFormat;
    sort?: DiscoverSort;
    year?: number | null;
    page?: number;
  }) => {
    const f = overrides.format ?? format;
    const s = overrides.sort ?? sort;
    const y = overrides.year === undefined ? year : overrides.year;
    const p = overrides.page ?? 1;
    const params = new URLSearchParams();
    const query = overrides.q ?? q;
    if (query) params.set("q", query);
    if (f !== "ALL") params.set("format", f);
    if (s !== "trending") params.set("sort", s);
    if (y != null) params.set("year", String(y));
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/search?${qs}` : "/search";
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Compass}
        title="Search"
        subtitle={
          <>
            {q
              ? `Results for “${q}”`
              : "Search the local catalogue; anything missing is fetched from MangaBaka."}
            {q && result.localCount > 0
              ? ` · ${result.localCount.toLocaleString()} in the catalogue`
              : ""}
            {q && result.remoteCount > 0 ? ` · ${result.remoteCount} from MangaBaka` : ""}
          </>
        }
      />

      <form action="/search" method="get" className="flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search manga, manhwa, manhua, novels…"
            className="h-12 w-full rounded-2xl border border-border/70 bg-card pl-9 pr-3 text-sm shadow-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/40"
          />
        </div>
        {format !== "ALL" && <input type="hidden" name="format" value={format} />}
        {sort !== "trending" && <input type="hidden" name="sort" value={sort} />}
        {year != null && <input type="hidden" name="year" value={String(year)} />}
        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:scale-[1.03] hover:bg-primary/90"
        >
          Search
        </button>
      </form>

      <div className="flex flex-col gap-2.5">
        <SegmentedTabs
          items={DISCOVER_FORMATS.map((f) => ({
            key: f.key,
            label: f.label,
            href: buildHref({ format: f.key, page: 1 }),
          }))}
          active={format}
          variant="brand"
        />

        <div className="flex flex-wrap items-center gap-2.5">
          <SegmentedTabs
            items={DISCOVER_SORTS.map((s) => ({
              key: s.key,
              label: s.label,
              href: buildHref({ sort: s.key, page: 1 }),
            }))}
            active={sort}
          />
          <SegmentedTabs
            items={[
              { key: "all", label: "All years", href: buildHref({ year: null, page: 1 }) },
              ...DISCOVER_YEARS.map((y) => ({
                key: String(y),
                label: String(y),
                href: buildHref({ year: y, page: 1 }),
              })),
            ]}
            active={year == null ? "all" : String(year)}
          />
        </div>
      </div>

      {!q ? (
        <EmptyState
          icon={<SearchIcon className="h-8 w-8" />}
          title="Search the catalogue"
          description="Type a title above. Matches already in the local catalogue appear instantly; the rest are fetched live from MangaBaka."
        />
      ) : result.items.length === 0 ? (
        <EmptyState
          icon={<Compass className="h-8 w-8" />}
          title="Nothing found"
          description={`No catalogue or MangaBaka results for “${q}”. Try a shorter query or another format.`}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {result.items.map((item) => (
            <CatalogCard key={item.key} item={item} showSource />
          ))}
        </div>
      )}

      {q && (
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          buildHref={(p) => buildHref({ page: p })}
        />
      )}
    </div>
  );
}
