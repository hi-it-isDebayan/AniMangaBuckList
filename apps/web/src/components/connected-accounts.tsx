"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, LogOut, Unlink, KeyRound } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { logoutAllSessionsAction } from "@/actions/settings";
import { setPasswordAction, unlinkProviderAction, type OAuthActionState } from "@/actions/oauth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const emptyState: OAuthActionState = {};

export function ConnectedAccounts({ linkedGoogle, hasPassword }: { linkedGoogle: boolean; hasPassword: boolean }) {
  return (
    <div className="space-y-4">
      <ProviderRow
        name="Google"
        detail={linkedGoogle ? "Signed in with Google" : "Use your Google account to sign in"}
        connected={linkedGoogle}
        href="/api/auth/google?mode=link"
      />

      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Password</p>
            <p className="text-sm text-muted-foreground">
              {hasPassword
                ? "You can sign in with your email and password."
                : "Set a password so you can keep signing in without Google or MAL."}
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
}: {
  name: string;
  detail: string;
  connected: boolean;
  href: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const provider = name === "Google" ? "google" : "mal";

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      {connected ? (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await unlinkProviderAction({ provider });
              if (!res.ok) setError(res.error ?? "Could not unlink.");
              else setError(null);
            })
          }
        >
          <Unlink className="h-3.5 w-3.5" /> Disconnect
        </Button>
      ) : (
        <a href={href}>
          <Button variant="outline" size="sm">
            Connect
          </Button>
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