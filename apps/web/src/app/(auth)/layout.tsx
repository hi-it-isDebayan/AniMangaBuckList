import { Suspense } from "react";
import Link from "next/link";
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
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm">
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