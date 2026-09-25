import { Suspense } from "react";
import Link from "next/link";
import { BookOpenText } from "lucide-react";
import { redirectIfAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <AuthedGate>{children}</AuthedGate>
    </Suspense>
  );
}

async function AuthedGate({ children }: { children: React.ReactNode }) {
  await redirectIfAuthed();
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-muted/40 p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand-gradient opacity-20 blur-3xl"
      />
      <div className="relative w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2.5 font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow">
            <BookOpenText className="h-5 w-5" />
          </span>
          <span className="text-lg">
            AniManga<span className="text-gradient">BuckList</span>
          </span>
        </Link>
        {children}
        <nav className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            Terms of Service
          </Link>
        </nav>
      </div>
    </main>
  );
}