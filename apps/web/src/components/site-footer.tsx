import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <p className="flex items-center gap-2">
          <span className="font-medium text-foreground">AniMangaBuckList</span>
          <span>·</span>
          <span>{new Date().getFullYear()}</span>
        </p>
        <nav className="flex items-center gap-4">
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