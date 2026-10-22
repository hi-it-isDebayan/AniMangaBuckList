import Link from "next/link";
import { revalidatePath } from "next/cache";
import { CheckCircle2, MailCheck, XCircle } from "lucide-react";
import { and, eq, isNull } from "drizzle-orm";
import { users } from "@ambl/database";
import { getDb } from "@/lib/db";
import { createSession, getCurrentUser } from "@/lib/auth";
import { consumeAuthToken } from "@/lib/tokens";
import { Card, CardContent } from "@/components/ui/card";
import { ResendVerifyButton } from "@/components/resend-verify-button";
import { mailConfigured } from "@/lib/mail";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; sent?: string }>;
}) {
  const { token, sent } = await searchParams;

  let state: "sent" | "verified" | "error" = sent === "1" ? "sent" : "error";
  const db = getDb();

  if (token) {
    const userId = await consumeAuthToken(token, "email_verify");
    if (userId) {
      const row = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, userId), isNull(users.emailVerifiedAt)))
        .limit(1);
      if (row[0]) {
        await db
          .update(users)
          .set({ emailVerifiedAt: new Date() })
          .where(eq(users.id, userId));
      }
      await createSession(userId);
      revalidatePath("/settings");
      state = "verified";
    }
  }

  const user = await getCurrentUser();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-6">
      <Card className="noise-overlay w-full max-w-md border-border/70 bg-card/85 shadow-xl shadow-black/20 backdrop-blur-md">
        <CardContent className="space-y-4 pt-6">
          {state === "verified" && (
            <>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </span>
              <div className="space-y-1">
                <h1 className="font-display text-lg font-bold tracking-tight">Email verified</h1>
                <p className="text-sm text-muted-foreground">
                  Your email is confirmed. Password recovery, passkeys, and cross-device signing
                  are now fully unlocked.
                </p>
              </div>
              <Link
                href="/"
                className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:scale-[1.03] hover:bg-primary/90"
              >
                Go to your library
              </Link>
            </>
          )}

          {state === "sent" && (
            <>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                <MailCheck className="h-6 w-6 text-primary" />
              </span>
              <div className="space-y-1">
                <h1 className="font-display text-lg font-bold tracking-tight">Check your inbox</h1>
                <p className="text-sm text-muted-foreground">
                  We sent a verification link{user ? ` to ${user.email}` : ""}. It expires in 24
                  hours.
                </p>
                {!mailConfigured() && (
                  <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-300">
                    Heads up: the email service isn&apos;t configured yet (set RESEND_API_KEY
                    and MAIL_FROM), so no email was actually sent.
                  </p>
                )}
              </div>
              {user ? (
                <ResendVerifyButton />
              ) : (
                <Link
                  href="/login"
                  className="inline-block text-sm font-medium text-primary hover:underline"
                >
                  Back to sign in
                </Link>
              )}
            </>
          )}

          {state === "error" && (
            <>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 ring-1 ring-destructive/20">
                <XCircle className="h-6 w-6 text-destructive" />
              </span>
              <div className="space-y-1">
                <h1 className="font-display text-lg font-bold tracking-tight">
                  Link invalid or expired
                </h1>
                <p className="text-sm text-muted-foreground">
                  Verification links are single-use and expire after 24 hours.
                </p>
              </div>
              {user ? (
                <ResendVerifyButton />
              ) : (
                <Link
                  href="/login"
                  className="inline-block text-sm font-medium text-primary hover:underline"
                >
                  Back to sign in
                </Link>
              )}
            </>
          )}

          <p className="pt-2 text-sm text-muted-foreground">
            <Link href="/" className="font-medium text-primary hover:underline">
              Back to home
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}