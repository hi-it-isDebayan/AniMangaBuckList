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
        className="absolute inset-0 scale-105 bg-[url('/animeOpening.jpg')] bg-cover bg-center bg-no-repeat"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/55 to-background/90"
      />
      <div
        aria-hidden="true"
        className="fade-in pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-gradient opacity-25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="fade-in pointer-events-none absolute -bottom-40 right-0 h-80 w-80 rounded-full bg-gradient-to-tr from-sky-500/20 to-fuchsia-500/20 blur-3xl"
      />
      <div className="scale-in relative w-full max-w-sm">
        <Link
          href="/"
          className="group mb-6 flex items-center justify-center gap-2.5"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow transition-transform duration-300 group-hover:scale-105">
            <BookOpenText className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            AniManga<span className="text-gradient-animated">BuckList</span>
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