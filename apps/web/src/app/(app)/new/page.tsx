import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { DISCOVER_FORMATS, type DiscoverFormat } from "@/lib/mangabaka";
import { findNewReleases } from "@/lib/discover";
import { PROMOTE_CHAPTERS } from "@/lib/catalogue-policy";
import { CatalogCard } from "@/components/catalog-card";
import { discoverItemToCatalogItem } from "@/lib/catalog";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { SegmentedTabs } from "@/components/segmented-tabs";
import { PageHeader } from "@/components/page-header";
import { RevealStagger } from "@/components/reveal";

export const metadata: Metadata = { title: "New" };
export const dynamic = "force-dynamic";

export default async function NewPage({
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

  const rawPage = Number(sp.page ?? 1);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const result = await findNewReleases({ format, page });

  const buildHref = (overrides: { format?: DiscoverFormat; page?: number }) => {
    const f = overrides.format ?? format;
    const p = overrides.page ?? 1;
    const params = new URLSearchParams();
    if (f !== "ALL") params.set("format", f);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/new?${qs}` : "/new";
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Sparkles}
        title="New releases"
        subtitle={
          <>
            Recently added titles that haven&apos;t reached {PROMOTE_CHAPTERS}+ chapters yet.
            Once they do, they&apos;re promoted to{" "}
            <Link href="/discover" className="text-primary hover:underline">
              Discover
            </Link>
            .
            {result.count > 0 ? ` · ${result.count.toLocaleString()} titles` : ""}
          </>
        }
      />

      <SegmentedTabs
        items={DISCOVER_FORMATS.map((f) => ({
          key: f.key,
          label: f.label,
          href: buildHref({ format: f.key, page: 1 }),
        }))}
        active={format}
        variant="brand"
      />

      {result.items.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-8 w-8" />}
          title="No new titles yet"
          description="Nothing new in this format right now. Check back after the next catalogue refresh."
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
  );
}
