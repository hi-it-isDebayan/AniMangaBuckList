export function OAuthButtons() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <a
        href="/api/auth/mal"
        className="inline-flex h-10 w-full items-center justify-center rounded-md bg-[#2e51a2] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#2e51a2]/90"
      >
        Continue with MyAnimeList
      </a>
      <a
        href="/api/auth/google"
        className="inline-flex h-10 w-full items-center justify-center rounded-md border border-input bg-card px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
      >
        Continue with Google
      </a>
    </div>
  );
}