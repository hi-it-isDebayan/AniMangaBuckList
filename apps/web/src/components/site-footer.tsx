import Link from "next/link";
import { BookOpenText, Heart } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="relative mt-auto border-t border-border/60 bg-card/30">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <p className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-glow">
            <BookOpenText className="h-3.5 w-3.5" />
          </span>
          <span className="font-semibold tracking-tight text-foreground">AniMangaBuckList</span>
          <span className="text-border">·</span>
          <span>{new Date().getFullYear()}</span>
        </p>
        <nav className="flex items-center gap-5">
          <Link href="/download" className="transition-colors hover:text-foreground">
            Apps
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            Terms
          </Link>
        </nav>
        <p className="flex items-center gap-1 text-xs">
          Made with <Heart className="h-3 w-3 fill-primary text-primary" /> for readers
        </p>
      </div>
    </footer>
  );
}
