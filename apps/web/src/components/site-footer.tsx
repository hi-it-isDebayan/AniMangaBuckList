import Link from "next/link";
import { BookOpenText } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t bg-card/40">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <p className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-gradient text-white">
            <BookOpenText className="h-3.5 w-3.5" />
          </span>
          <span className="font-medium text-foreground">AniMangaBuckList</span>
          <span>·</span>
          <span>{new Date().getFullYear()}</span>
        </p>
        <nav className="flex items-center gap-4">
          <Link href="/download" className="transition-colors hover:text-foreground">
            Apps
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            Terms of Service
          </Link>
        </nav>
      </div>
    </footer>
  );
}