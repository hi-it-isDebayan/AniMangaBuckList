import Link from "next/link";
import { BookOpenText, Settings } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { AddTitleDialog } from "@/components/add-title-dialog";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-transparent bg-background/75 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <Link href="/" className="flex items-center gap-2.5 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow">
              <BookOpenText className="h-4.5 w-4.5" />
            </span>
            <span className="hidden sm:inline">
              AniManga<span className="text-gradient">BuckList</span>
            </span>
          </Link>
          <AppNav />
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <AddTitleDialog />
            <ThemeToggle />
            <Link
              href="/profile"
              className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-accent sm:px-2"
            >
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-7 w-7 rounded-full object-cover ring-1 ring-border"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-border">
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
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}