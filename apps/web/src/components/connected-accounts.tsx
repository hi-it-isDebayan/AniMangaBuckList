"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, LogOut, KeyRound } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { logoutAllSessionsAction } from "@/actions/settings";
import { setPasswordAction, unlinkProviderAction, type OAuthActionState } from "@/actions/oauth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const emptyState: OAuthActionState = {};

export function ConnectedAccounts({
  linkedGoogle,
  hasPassword,
  mangabakaConfigured,
  mangabakaCount,
  mangabakaLastSynced,
}: {
  linkedGoogle: boolean;
  hasPassword: boolean;
  mangabakaConfigured: boolean;
  mangabakaCount: number;
  mangabakaLastSynced: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Label>Sign in with</Label>
        <ProviderRow
          name="Google"
          detail={linkedGoogle ? "Signed in with Google" : "Use your Google account to sign in"}
          connected={linkedGoogle}
          href="/api/auth/google?mode=link"
          provider="google"
        />
      </div>

      <div className="border-t border-border pt-4">
        <Label>Reading progress source</Label>
        <div className="mt-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">MangaBaka</p>
              <p className="text-sm text-muted-foreground">
                {mangabakaConfigured
                  ? "Connected with the site API key. Your latest chapter shows in search results automatically."
                  : "Not configured — add MANGABAKA_API_KEY to the environment to show your chapters in search."}
              </p>
              {mangabakaConfigured && (
                <p className="mt-0.5 text-xs text-muted-foreground/80">
                  {mangabakaCount > 0
                    ? `${mangabakaCount} titles synced${mangabakaLastSynced ? ` · last updated ${new Date(mangabakaLastSynced).toLocaleString()}` : ""}`
                    : "No titles synced yet — they appear automatically after the next check."}
                </p>
              )}
            </div>
            <span className={mangabakaConfigured ? "text-emerald-600 dark:text-emerald-300" : "text-muted-foreground"}>
              {mangabakaConfigured ? "Connected" : "Off"}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Password</p>
            <p className="text-sm text-muted-foreground">
              {hasPassword
                ? "You can sign in with your email and password."
                : "Set a password so you can keep signing in without Google."}
            </p>
          </div>
          <span className={hasPassword ? "text-emerald-600 dark:text-emerald-300" : "text-muted-foreground"}>
            {hasPassword ? "Set" : "Not set"}
          </span>
        </div>
        <PasswordForm hasPassword={hasPassword} />
      </div>

      <div className="border-t border-border pt-4">
        <Label>Sessions</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              <LogOut className="h-3.5 w-3.5" /> Sign out this device
            </Button>
          </form>
          <form action={logoutAllSessionsAction}>
            <Button type="submit" variant="outline" size="sm" className="text-destructive">
              <LogOut className="h-3.5 w-3.5" /> Sign out everywhere
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function ProviderRow({
  name,
  detail,
  connected,
  href,
  provider,
}: {
  name: string;
  detail: string;
  connected: boolean;
  href: string;
  provider: "google";
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
        {connected ? (
          <p className="mt-0.5 text-xs text-muted-foreground/80">
            Disconnecting only stops Google sign-in. This account stays signed in on this device
            until you sign out.
          </p>
        ) : null}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      {connected ? (
        <Button
          variant="outline"
          size="sm"
          className={confirming ? "text-destructive hover:text-destructive" : undefined}
          disabled={pending}
          onClick={() => {
            if (!confirming) {
              setConfirming(true);
              return;
            }
            setConfirming(false);
            startTransition(async () => {
              const res = await unlinkProviderAction({ provider });
              if (!res.ok) setError(res.error ?? "Could not unlink.");
              else setError(null);
            });
          }}
        >
          {confirming ? "Confirm?" : "Disconnect"}
        </Button>
      ) : (
        <a href={href}>
          <Button variant="outline" size="sm">Connect</Button>
        </a>
      )}
    </div>
  );
}

function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, formAction, pending] = useActionState(setPasswordAction, emptyState);

  return (
    <form action={formAction} className="mt-2 space-y-2">
      {hasPassword && (
        <div className="space-y-1.5">
          <Label htmlFor="currentPassword">Current password</Label>
          <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} />
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="newPassword">{hasPassword ? "New password" : "Password"}</Label>
          <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} />
        </div>
      </div>
      {state?.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-300">
          <Check className="h-4 w-4" /> Password {hasPassword ? "updated" : "set"}
        </p>
      )}
      <Button type="submit" variant="outline" size="sm" disabled={pending} className="mt-1">
        <KeyRound className="h-3.5 w-3.5" />
        {hasPassword ? "Change password" : "Set password"}
      </Button>
    </form>
  );
}