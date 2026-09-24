import { Suspense } from "react";
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
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}