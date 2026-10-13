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
import { formatCount, formatDate, mediaStatusBadge, mediaStatusLabel } from "@/lib/format";
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

      <header className="noise-overlay relative overflow-hidden rounded-3xl border border-border/70 bg-card/60 shadow-sm shadow-black/[0.04]">
        {coverUrl && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 scale-125 opacity-30 blur-3xl"
            style={{
              backgroundImage: `url(${coverUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-background/70 via-background/40 to-background/80"
        />

        <div className="relative flex flex-col gap-5 p-4 sm:flex-row sm:gap-7 sm:p-7">
          <div className="group shrink-0 self-center sm:self-start">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl}
                alt={title}
                loading="eager"
                referrerPolicy="no-referrer"
                className="h-56 w-40 rounded-2xl border border-border/70 object-cover shadow-2xl shadow-black/25 transition-transform duration-500 group-hover:scale-[1.03] group-hover:rotate-1 sm:h-80 sm:w-56"
              />
            ) : (
              <span className="cover-fallback flex h-56 w-40 items-center justify-center rounded-2xl border border-border/70 text-muted-foreground shadow-2xl sm:h-80 sm:w-56">
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

            <h1 className="mt-3 font-display text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl">
              {title}
            </h1>
            {englishTitle && englishTitle !== title && (
              <p className="mt-1 text-base text-muted-foreground">{englishTitle}</p>
            )}
            {(nativeTitle || japaneseTitle) && (
              <p className="mt-0.5 text-sm text-muted-foreground/80">
                {[nativeTitle, japaneseTitle].filter(Boolean).join(" · ")}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {score != null && (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-sm font-bold text-amber-600 dark:text-amber-400">
                  <Star className="h-4 w-4 fill-current" />
                  {score.toFixed(1)}
                  <span className="text-xs font-normal opacity-70">/ 10</span>
                </span>
              )}
              {rank != null && (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/60 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-primary" /> #{rank.toLocaleString()} global
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {chapters != null && (
                <span className="inline-flex items-center gap-1.5">
                  <BookOpenText className="h-4 w-4" /> {formatCount(chapters)} chapters
                </span>
              )}
              {volumes != null && (
                <span className="inline-flex items-center gap-1.5">
                  <Layers className="h-4 w-4" /> {formatCount(volumes)} volumes
                </span>
              )}
              {episodes != null && (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4" /> {formatCount(episodes)} episodes
                </span>
              )}
              {(startDate || endDate) && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {formatDate(startDate)}
                  {endDate ? ` – ${formatDate(endDate)}` : ""}
                </span>
              )}
            </div>

            {genres.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {genres.slice(0, 8).map((genre) => (
                  <Badge
                    key={genre}
                    variant="outline"
                    className="transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {genre}
                  </Badge>
                ))}
              </div>
            )}

            {links.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
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
        "inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-background/50 px-2.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground",
        className,
      )}
    >
      <ExternalLink className="h-3.5 w-3.5" /> {label}
    </a>
  );
}
