import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  DISCOVER_FORMATS,
  DISCOVER_SORTS,
  DISCOVER_YEARS,
  type DiscoverFormat,
  type DiscoverSort,
} from "@/lib/mangabaka";
import { findDiscover } from "@/lib/discover";
import { CatalogCard } from "@/components/catalog-card";
import { discoverItemToCatalogItem } from "@/lib/catalog";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { SegmentedTabs } from "@/components/segmented-tabs";
import { PageHeader } from "@/components/page-header";
import { RevealStagger } from "@/components/reveal";
import { SearchProviderWrapper } from "@/components/search-provider-wrapper";

export const metadata: Metadata = { title: "Discover" };
export const dynamic = "force-dynamic";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const sp = await searchParams;

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

  const result = await findDiscover({ format, year, sort, page });

  const buildHref = (overrides: {
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
    if (f !== "ALL") params.set("format", f);
    if (s !== "trending") params.set("sort", s);
    if (y != null) params.set("year", String(y));
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/discover?${qs}` : "/discover";
  };

  return (
    <SearchProviderWrapper defaultType="MANGA" defaultSource="mangabaka">
      <div className="space-y-5">
        <PageHeader
          icon={Compass}
          title="Discover"
          subtitle={
            <>
              What&apos;s {DISCOVER_SORTS.find((s) => s.key === sort)?.label.toLowerCase()} on
              MangaBaka
              {year ? ` from ${year}` : ""}
              {result.count > 0 ? ` · ${result.count.toLocaleString()} titles` : ""}
            </>
          }
        />

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

        <p className="text-xs text-muted-foreground">
          Anime isn&apos;t part of MangaBaka&apos;s catalogue — browse manga, manhwa, manhua, and
          novels here. Data from MangaBaka, released by publication year.
        </p>

        {result.items.length === 0 ? (
          <EmptyState
            icon={<Compass className="h-8 w-8" />}
            title="Nothing to show"
            description="No titles matched this combination yet. Try another format, year, or sort."
          />
        ) : (
          <RevealStagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {result.items.map((item) => {
              const catalogItem = discoverItemToCatalogItem(item, { source: "local" });
              return <CatalogCard key={catalogItem.key} item={catalogItem} />;
            })}
          </RevealStagger>
        )}

        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          buildHref={(p) => buildHref({ page: p })}
        />
      </div>
    </SearchProviderWrapper>
  );
}