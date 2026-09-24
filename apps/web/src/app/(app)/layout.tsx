import Link from "next/link";
import { BookOpenText, Settings } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { AddTitleDialog } from "@/components/add-title-dialog";
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
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <BookOpenText className="h-5 w-5 text-primary" />
            <span className="hidden sm:inline">AniMangaBuckList</span>
          </Link>
          <nav className="ml-1 flex items-center gap-0.5 text-sm sm:ml-4 sm:gap-1">
            <Link
              href="/"
              className="rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:px-3"
            >
              Home
            </Link>
            <Link
              href="/library"
              className="rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:px-3"
            >
              Library
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <AddTitleDialog />
            <ThemeToggle />
            <span className="hidden text-sm text-muted-foreground md:inline">
              {user.displayName || user.email}
            </span>
            <Link href="/settings" aria-label="Settings" title="Settings">
              <Button variant="ghost" size="sm" className="px-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}