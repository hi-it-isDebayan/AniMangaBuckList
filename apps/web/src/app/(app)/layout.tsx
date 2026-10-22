import Link from "next/link";
import { BookOpenText, LogOut, Settings } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ensureBootstrapAdmin } from "@/lib/sources/service";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandSearch } from "@/components/command-search";
import { MetadataRefresher } from "@/components/metadata-refresher";
import { SearchLayout } from "@/components/search-layout";
import { AppNav } from "@/components/app-nav";
import { ScrollProgress } from "@/components/scroll-progress";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  // Bootstrap the initial ADMIN server-side, against the authenticated verified
  // email. Idempotent and cheap: the DB check only runs for the matching account
  // until it already holds the role.
  await ensureBootstrapAdmin(user.id);

  return (
    <SearchLayout>
      <div className="flex min-h-dvh flex-col">
        <header className="header-accent sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto flex min-h-16 w-full max-w-6xl flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-2 sm:gap-x-3 sm:px-4">
            <Link href="/" className="group flex shrink-0 items-center gap-2.5">
              <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-brand-gradient text-white shadow-glow transition-transform duration-300 group-hover:scale-105">
                <BookOpenText className="h-4.5 w-4.5 relative z-10" />
                <span className="absolute inset-0 bg-white/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </span>
              <span className="hidden text-[15px] font-bold tracking-tight sm:inline">
                AniManga<span className="text-gradient-animated">BuckList</span>
              </span>
            </Link>
            <AppNav />
            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
              <ThemeToggle />
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-full px-1.5 py-1 transition-colors hover:bg-accent sm:px-2"
              >
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-8 w-8 rounded-full object-cover ring-2 ring-border transition-shadow hover:ring-primary/50"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-xs font-bold text-primary ring-2 ring-border transition-shadow hover:ring-primary/50">
                    {(user.displayName || user.email || "?").slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="hidden max-w-[10rem] truncate text-sm text-muted-foreground lg:inline">
                  {user.displayName || user.email}
                </span>
              </Link>
              <Link href="/settings" aria-label="Settings" title="Settings">
                <Button variant="ghost" size="sm" className="px-2">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Settings</span>
                </Button>
              </Link>
              <form action="/api/auth/logout" method="post">
                <Button type="submit" variant="ghost" size="sm" className="px-2" aria-label="Sign out" title="Sign out">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </form>
            </div>
          </div>
          <ScrollProgress />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 pt-7 sm:pt-8">{children}</main>
        <CommandSearch />
        <MetadataRefresher />
      </div>
    </SearchLayout>
  );
}