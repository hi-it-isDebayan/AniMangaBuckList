import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

function oauthErrorLabel(code: string): string {
  const map: Record<string, string> = {
    "Google sign-in declined": "Google sign-in was cancelled.",
    "Stale sign-in request, try again": "That sign-in request expired. Please try again.",
    "Google token exchange failed": "Google sign-in failed. Please try again.",
    "Could not verify Google identity": "We could not verify your Google account.",
    "Google identity could not be verified": "We could not verify your Google account.",
    "Google sign-in failed": "Google sign-in failed. Please try again.",
    "MyAnimeList sign-in declined": "MyAnimeList sign-in was cancelled.",
    "MyAnimeList token exchange failed": "MyAnimeList sign-in failed. Please try again.",
    "Could not fetch MAL profile": "We could not fetch your MyAnimeList profile.",
    "MyAnimeList sign-in failed": "MyAnimeList sign-in failed. Please try again.",
    "Please sign in first": "Please sign in before linking an account.",
    "Google sign-in is not configured": "Google sign-in is not configured.",
    "Maybe add MAL credentials first": "MyAnimeList sign-in is not configured.",
    session: "Your session could not be created. Please try again.",
  };
  return map[code] ?? code;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-6 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">AniMangaBuckList</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to continue your reading and watching.
          </p>
        </div>
        {error && (
          <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {oauthErrorLabel(error)}
          </p>
        )}
        <LoginForm />
      </CardContent>
    </Card>
  );
}