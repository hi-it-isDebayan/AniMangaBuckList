import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { listLinkedSources, listSources } from "@/lib/sources/service";
import { loadSourceUsage } from "@/lib/sources/usage";
import { AddSourcePanel } from "@/components/sources/add-source-panel";
import { SourceCard } from "@/components/sources/source-card";

export const metadata: Metadata = { title: "Discover sources" };
export const dynamic = "force-dynamic";

const STATUS_OPTIONS = ["WORKING", "DEGRADED", "BROKEN", "UNVERIFIED"];
const EXTRACTOR_OPTIONS = ["SUPPORTED", "AWAITING_EXTRACTOR"];

export default async function SourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; extractor?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";

  const [sources, links] = await Promise.all([
    listSources({
      q: q || undefined,
      status: params.status || undefined,
      extractorStatus: params.extractor || undefined,
    }),
    listLinkedSources(user.id),
  ]);
  const linkedIds = new Set(links.map((link) => link.id));
  const usage = await loadSourceUsage(sources);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-3 py-6 sm:px-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Discover sources</h1>
          <p className="text-sm text-muted-foreground">
            Community source directory. Register a site once; everyone links to the same entry.
          </p>
        </div>
        <AddSourcePanel />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search &amp; filter</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1 space-y-1.5">
              <Label htmlFor="q">Search</Label>
              <Input id="q" name="q" defaultValue={q} placeholder="Name or domain" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Health</Label>
              <select
                id="status"
                name="status"
                defaultValue={params.status ?? ""}
                className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <option value="">Any</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option.charAt(0) + option.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="extractor">Extractor</Label>
              <select
                id="extractor"
                name="extractor"
                defaultValue={params.extractor ?? ""}
                className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <option value="">Any</option>
                {EXTRACTOR_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === "SUPPORTED" ? "Ready" : "Awaiting extractor support"}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm" variant="outline">
              Apply
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sources match your search yet.</p>
        ) : (
          sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              usage={usage.get(source.id)}
              linked={linkedIds.has(source.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
