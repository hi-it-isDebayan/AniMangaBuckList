"use client";

import { useState } from "react";
import { Building2, PencilLine, UserRound } from "lucide-react";
import type { CastMember } from "@/lib/external-cast";
import { namesMatch } from "@/lib/external-cast";
import { cn } from "@/lib/utils";

/**
 * One credited person with a portrait when we managed to match them against the
 * fetched staff list. Matching is name-token based ("Oda Eiichiro" === "Eiichiro
 * Oda") so it works regardless of western vs. eastern name order.
 */
function PersonChip({
  name,
  portrait,
  role,
}: {
  name: string;
  portrait?: CastMember | null;
  role?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const src = portrait?.imageUrl ?? null;

  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-glow">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-border/60 transition-shadow group-hover:ring-primary/40"
        />
      ) : (
        <span className="cover-fallback flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-muted-foreground/70 ring-1 ring-border/60">
          <UserRound className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold tracking-tight">{name}</p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
          <PencilLine className="h-3 w-3 shrink-0" />
          {role ?? (portrait?.detail ?? "Credited")}
        </p>
      </div>
    </div>
  );
}

/**
 * Credits grid. Author/artist names come from MangaBaka (already in Neon);
 * the portraits come from the runtime-fetched staff list and are matched by
 * name. Names without a match simply show the initials placeholder.
 */
export function CreditsGrid({
  authors,
  artists,
  publishers,
  staff,
}: {
  authors: string[];
  artists: string[];
  publishers: string[];
  staff: CastMember[];
}) {
  const match = (name: string) => staff.find((member) => namesMatch(name, member.name)) ?? null;
  // Artists are often the same person as the author; keep them grouped.
  const authorSet = new Set(authors);

  return (
    <div className="space-y-5">
      {authors.length > 0 && (
        <div>
          <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Authors
          </h3>
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {authors.map((name) => (
              <li key={name}>
                <PersonChip name={name} portrait={match(name)} role={match(name)?.detail} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {artists.filter((name) => !authorSet.has(name)).length > 0 && (
        <div>
          <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Art
          </h3>
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {artists
              .filter((name) => !authorSet.has(name))
              .map((name) => (
                <li key={name}>
                  <PersonChip name={name} portrait={match(name)} role={match(name)?.detail} />
                </li>
              ))}
          </ul>
        </div>
      )}

      {publishers.length > 0 && (
        <div>
          <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Publishers
          </h3>
          <div className="flex flex-wrap gap-2">
            {publishers.map((name) => (
              <span
                key={name}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground",
                )}
              >
                <Building2 className="h-3.5 w-3.5" />
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
