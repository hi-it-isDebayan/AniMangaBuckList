import { SourceRowActions } from "@/components/sources/source-row-actions";
import { SiteLogo } from "@/components/sources/site-logo";
import { UsageHistogram } from "@/components/sources/usage-histogram";
import type { SourceUsage } from "@/lib/sources/usage-core";

/**
 * Compact, data-first source entry: the site logo in a circle, the website link,
 * a monthly usage histogram, and the per-source actions. Status/extractor
 * badges are intentionally omitted to keep the directory easy to scan.
 */
export function SourceCard({
  source,
  usage,
  linked,
}: {
  source: { id: string; name: string; domain: string; homepageUrl: string };
  usage?: SourceUsage;
  linked: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <SiteLogo domain={source.domain} name={source.name} size={40} />
          <div className="min-w-0">
            <a
              href={source.homepageUrl}
              target="_blank"
              rel="noreferrer noopener nofollow"
              className="block truncate font-medium underline-offset-4 hover:underline"
            >
              {source.name}
            </a>
            <a
              href={source.homepageUrl}
              target="_blank"
              rel="noreferrer noopener nofollow"
              className="block truncate text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {source.domain}
            </a>
          </div>
        </div>
        {linked ? <span className="text-xs text-primary">Linked</span> : null}
      </div>

      {usage ? <UsageHistogram usage={usage} className="mt-4" /> : null}

      <div className="mt-3">
        <SourceRowActions sourceId={source.id} linked={linked} />
      </div>
    </div>
  );
}
