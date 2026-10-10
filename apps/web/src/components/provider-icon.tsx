import { cn } from "@/lib/utils";

const GLYPHS: Record<string, { label: string; className: string; letter: string }> = {
  mal: { label: "MyAnimeList", letter: "MAL", className: "border-sky-500/30 text-sky-400" },
  anilist: { label: "AniList", letter: "AL", className: "border-violet-500/30 text-violet-400" },
  mangabaka: { label: "MangaBaka", letter: "MB", className: "border-emerald-500/30 text-emerald-400" },
};

export function ProviderIcon({
  provider,
  className,
  title,
}: {
  provider: string;
  className?: string;
  title?: string;
}) {
  const glyph = GLYPHS[provider] ?? {
    label: provider,
    letter: provider.slice(0, 2).toUpperCase(),
    className: "border-muted-foreground/30 text-muted-foreground",
  };
  return (
    <span
      title={title ?? glyph.label}
      className={cn(
        "inline-flex h-4 w-7 shrink-0 items-center justify-center rounded-sm border text-[8px] font-bold leading-none tracking-tight",
        glyph.className,
        className,
      )}
    >
      {glyph.letter}
    </span>
  );
}