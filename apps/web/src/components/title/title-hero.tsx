import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpenText,
  CalendarDays,
  ExternalLink,
  Layers,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import type { MediaStatus, MediaType } from "@ambl/types";
import { MediaTypeBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatDate, mediaStatusBadge, mediaStatusLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface TitleHeroLink {
  href: string;
  label: string;
}

export interface TitleHeroData {
  title: string;
  englishTitle?: string | null;
  nativeTitle?: string | null;
  japaneseTitle?: string | null;
  coverUrl?: string | null;
  mediaType: MediaType;
  status?: MediaStatus | null;
  year?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  /** 0–10 */
  score?: number | null;
  /** MangaBaka global popularity rank (1 = most popular). */
  rank?: number | null;
  chapters?: number | null;
  volumes?: number | null;
  episodes?: number | null;
  genres?: string[];
  links?: TitleHeroLink[];
  /** Library status badge (e.g. CURRENTLY_READING). */
  libraryStatus?: ReactNode;
}

/**
 * The single hero used by every title detail page (catalogue and library).
 * Both `/series/[id]` and `/title/[id]` render this so the two entry points
 * feel like one page.
 */
export function TitleHero({
  data,
  actions,
  backHref,
  backLabel,
}: {
  data: TitleHeroData;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  const {
    title,
    englishTitle,
    nativeTitle,
    japaneseTitle,
    coverUrl,
    mediaType,
    status,
    year,
    startDate,
    endDate,
    score,
    rank,
    chapters,
    volumes,
    episodes,
    genres = [],
    links = [],
    libraryStatus,
  } = data;

  return (
    <div className="space-y-4">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {backLabel ?? "Back"}
        </Link>
      )}

      <header className="relative overflow-hidden rounded-2xl border bg-card/60 shadow-sm">
        {coverUrl && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 scale-110 opacity-25 blur-3xl"
            style={{
              backgroundImage: `url(${coverUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        )}

        <div className="relative flex flex-col gap-5 p-4 sm:flex-row sm:gap-6 sm:p-6">
          <div className="shrink-0 self-center sm:self-start">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl}
                alt={title}
                loading="eager"
                referrerPolicy="no-referrer"
                className="h-56 w-40 rounded-xl border shadow-lg transition-transform duration-300 hover:scale-[1.02] sm:h-72 sm:w-52"
              />
            ) : (
              <span className="cover-fallback flex h-56 w-40 items-center justify-center rounded-xl border text-muted-foreground sm:h-72 sm:w-52">
                <BookOpenText className="h-10 w-10" />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <MediaTypeBadge type={mediaType} />
              {year != null && <Badge variant="secondary">{year}</Badge>}
              {status != null && (
                <Badge variant={mediaStatusBadge(status)}>{mediaStatusLabel(status)}</Badge>
              )}
              {libraryStatus}
            </div>

            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-gradient sm:text-3xl">
              {title}
            </h1>
            {englishTitle && englishTitle !== title && (
              <p className="text-muted-foreground">{englishTitle}</p>
            )}
            {(nativeTitle || japaneseTitle) && (
              <p className="text-sm text-muted-foreground">
                {[nativeTitle, japaneseTitle].filter(Boolean).join(" · ")}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
              {score != null && (
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {score.toFixed(1)}
                  <span className="font-normal text-muted-foreground">/ 10</span>
                </span>
              )}
              {rank != null && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <TrendingUp className="h-4 w-4" /> #{rank.toLocaleString()} global
                </span>
              )}
              {chapters != null && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <BookOpenText className="h-4 w-4" /> {chapters} chapters
                </span>
              )}
              {volumes != null && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Layers className="h-4 w-4" /> {volumes} volumes
                </span>
              )}
              {episodes != null && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Users className="h-4 w-4" /> {episodes} episodes
                </span>
              )}
              {(startDate || endDate) && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  {formatDate(startDate)}
                  {endDate ? ` – ${formatDate(endDate)}` : ""}
                </span>
              )}
            </div>

            {genres.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {genres.slice(0, 8).map((genre) => (
                  <Badge key={genre} variant="outline">
                    {genre}
                  </Badge>
                ))}
              </div>
            )}

            {links.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {links.map((link) => (
                  <ProviderLink key={`${link.label}:${link.href}`} href={link.href} label={link.label} />
                ))}
              </div>
            )}

            {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
        </div>
      </header>
    </div>
  );
}

export function ProviderLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      <ExternalLink className="h-3.5 w-3.5" /> {label}
    </a>
  );
}
