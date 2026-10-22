"use client";

import { useState } from "react";
import { ChevronDown, Clapperboard, UserRound, Users } from "lucide-react";
import type { CastCharacter, CastMember } from "@/lib/external-cast";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<CastCharacter["role"], string> = {
  MAIN: "Main",
  SUPPORTING: "Supporting",
  BACKGROUND: "Background",
};

const ROLE_STYLES: Record<CastCharacter["role"], string> = {
  MAIN: "bg-primary/15 text-primary ring-primary/25",
  SUPPORTING: "bg-sky-500/12 text-sky-600 dark:text-sky-400 ring-sky-500/25",
  BACKGROUND: "bg-muted text-muted-foreground ring-border",
};

function Portrait({
  src,
  name,
  className,
  rounded = "rounded-xl",
}: {
  src: string | null;
  name: string;
  className?: string;
  rounded?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        className={cn(
          "cover-fallback flex items-center justify-center text-muted-foreground/70",
          rounded,
          className,
        )}
        aria-hidden="true"
      >
        <UserRound className="h-1/2 w-1/2" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn("object-cover", rounded, className)}
    />
  );
}

function CharacterCard({ character }: { character: CastCharacter }) {
  const [expanded, setExpanded] = useState(false);
  const vas = character.voiceActors;
  const shown = expanded ? vas : vas.slice(0, 1);

  return (
    <li className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card p-3 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-glow">
      <div className="flex items-start gap-3">
        <div className="cover-zoom shrink-0 rounded-xl ring-1 ring-border/60 transition-shadow group-hover:ring-primary/30">
          <Portrait
            src={character.imageUrl}
            name={character.name}
            className="h-16 w-16"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-snug tracking-tight">
            {character.name}
          </p>
          {character.nativeName && (
            <p className="truncate text-xs text-muted-foreground">{character.nativeName}</p>
          )}
          <span
            className={cn(
              "mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset",
              ROLE_STYLES[character.role],
            )}
          >
            {ROLE_LABEL[character.role]}
          </span>
        </div>
      </div>

      {vas.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-border/60 pt-2.5">
          {shown.map((va) => (
            <div key={va.id} className="flex items-center gap-2">
              <Portrait
                src={va.imageUrl}
                name={va.name}
                rounded="rounded-full"
                className="h-6 w-6 ring-1 ring-border/60"
              />
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {va.name}
                {va.detail ? <span className="opacity-60"> · {va.detail}</span> : null}
              </span>
              <Clapperboard className="h-3 w-3 shrink-0 text-muted-foreground/50" />
            </div>
          ))}
          {vas.length > 1 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary transition-colors hover:underline"
            >
              <ChevronDown
                className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")}
              />
              {expanded ? "Show less" : `${vas.length - 1} more voice actor${vas.length === 2 ? "" : "s"}`}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function StaffCard({ member }: { member: CastMember }) {
  return (
    <li className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30">
      <div className="cover-zoom shrink-0 rounded-xl ring-1 ring-border/60 transition-shadow group-hover:ring-primary/30">
        <Portrait src={member.imageUrl} name={member.name} className="h-14 w-14" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold tracking-tight">{member.name}</p>
        {member.detail && (
          <p className="mt-0.5 truncate text-xs capitalize text-muted-foreground">
            {member.detail}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * Characters + staff grid, rendered from data fetched at request time from
 * AniList/Jikan. Nothing here is persisted anywhere.
 */
export function CastSection({
  characters,
  staff,
}: {
  characters: CastCharacter[];
  staff: CastMember[];
}) {
  if (characters.length === 0 && staff.length === 0) return null;

  return (
    <div className="space-y-6">
      {characters.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Users className="h-4 w-4 text-primary" /> Characters
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums normal-case tracking-normal">
              {characters.length}
            </span>
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {characters.map((character) => (
              <CharacterCard key={character.id} character={character} />
            ))}
          </ul>
        </div>
      )}

      {staff.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Clapperboard className="h-4 w-4 text-primary" /> Staff
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums normal-case tracking-normal">
              {staff.length}
            </span>
          </h3>
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {staff.map((member) => (
              <StaffCard key={member.id} member={member} />
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground/70">
        Cast &amp; crew fetched from AniList at view time — not stored in your library.
      </p>
    </div>
  );
}
