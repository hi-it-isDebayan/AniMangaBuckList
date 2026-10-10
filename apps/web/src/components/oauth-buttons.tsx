export function OAuthButtons() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <OAuthButton href="/api/auth/google" label="Continue with Google" />
      <OAuthButton href="/api/auth/mal" label="Continue with MyAnimeList" />
      <OAuthButton href="/api/auth/anilist" label="Continue with AniList" />
    </div>
  );
}

function OAuthButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex h-10 w-full items-center justify-center rounded-md border border-input bg-card px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
    >
      {label}
    </a>
  );
}