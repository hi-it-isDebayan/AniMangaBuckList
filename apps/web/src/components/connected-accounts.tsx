"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Check, LogOut, Unlink, KeyRound, RefreshCw, Link2 } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { logoutAllSessionsAction } from "@/actions/settings";
import {
  connectMangabakaAction,
  disconnectMangabakaAction,
  resyncProviderAction,
  type ProviderActionResult,
} from "@/actions/providers";
import { setPasswordAction, unlinkProviderAction, type OAuthActionState } from "@/actions/oauth";
import type { TokenProvider } from "@/lib/provider-sync";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const emptyState: OAuthActionState = {};
const initialConnect: ProviderActionResult = {};

type SignInProvider = "google" | "mal" | "anilist";

const TRACKER_LABEL: Record<TokenProvider, string> = {
  mal: "MyAnimeList",
  anilist: "AniList",
  mangabaka: "MangaBaka",
};

export function ConnectedAccounts({
  linkedGoogle,
  linkedMal,
  linkedAnilist,
  trackedMal,
  trackedAnilist,
  mangabakaConnected,
  hasPassword,
}: {
  linkedGoogle: boolean;
  linkedMal: boolean;
  linkedAnilist: boolean;
  trackedMal: boolean;
  trackedAnilist: boolean;
  mangabakaConnected: boolean;
  hasPassword: boolean;
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
          providerKey="google"
        />
        <ProviderRow
          name="MyAnimeList"
          detail={
            linkedMal
              ? "Signed in with MyAnimeList"
              : trackedMal
                ? "Progress sync connected — sign in with MAL to manage it here"
                : "Use your MyAnimeList account to sign in and sync progress"
          }
          connected={linkedMal}
          href="/api/auth/mal?mode=link"
          providerKey="mal"
          tracker
          tracked={trackedMal || linkedMal}
        />
        <ProviderRow
          name="AniList"
          detail={
            linkedAnilist
              ? "Signed in with AniList"
              : trackedAnilist
                ? "Progress sync connected — sign in with AniList to manage it here"
                : "Use your AniList account to sign in and sync progress"
          }
          connected={linkedAnilist}
          href="/api/auth/anilist?mode=link"
          providerKey="anilist"
          tracker
          tracked={trackedAnilist || linkedAnilist}
        />
      </div>

      <div className="border-t border-border pt-4">
        <Label>Reading progress source</Label>
        <div className="mt-2">
          <MangabakaPanel connected={mangabakaConnected} />
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Password</p>
            <p className="text-sm text-muted-foreground">
              {hasPassword
                ? "You can sign in with your email and password."
                : "Set a password so you can keep signing in without Google, MAL or AniList."}
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
  providerKey,
  tracker,
  tracked,
  signInLabel,
}: {
  name: string;
  detail: string;
  connected: boolean;
  href: string;
  providerKey: SignInProvider;
  tracker?: boolean;
  tracked?: boolean;
  signInLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [syncing, startSync] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState<number | null>(null);

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
        {tracker && tracked && (
          <p className="mt-0.5 text-xs text-muted-foreground/80">
            Progress (episodes / chapters) shows in search results.
          </p>
        )}
        {connected ? (
          <p className="mt-0.5 text-xs text-muted-foreground/80">
            Disconnecting stops {name} sign-in. This account stays signed in on this device
            until you sign out.
          </p>
        ) : null}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {synced != null && (
          <p className="text-sm text-emerald-600 dark:text-emerald-300">
            Synced {synced} titles.
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {tracker && tracked && (
          <Button
            variant="ghost"
            size="sm"
            disabled={syncing}
            title={`Resync your ${name} progress`}
            onClick={() =>
              startSync(async () => {
                const res = await resyncProviderAction({ provider: providerKey as TokenProvider });
                if (res.success) setSynced(res.count ?? 0);
                else setError(res.error ?? "Could not resync.");
              })
            }
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            Sync
          </Button>
        )}
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
                const res = await unlinkProviderAction({ provider: providerKey });
                if (!res.ok) setError(res.error ?? "Could not unlink.");
                else setError(null);
              });
            }}
          >
            <Unlink className="h-3.5 w-3.5" /> {confirming ? "Confirm?" : "Disconnect"}
          </Button>
        ) : (
          <a href={href}>
            <Button variant="outline" size="sm">
              {signInLabel ?? "Connect"}
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}

function MangabakaPanel({ connected }: { connected: boolean }) {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [disconnectPending, startDisconnect] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const connect = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await connectMangabakaAction({ token });
      if (res.success) {
        setMessage(`Connected — synced ${res.count ?? 0} titles from your MangaBaka library.`);
        setToken("");
      } else {
        setMessage(res.error ?? "Could not connect MangaBaka.");
      }
    });
  };

  const disconnect = () => {
    setMessage(null);
    startDisconnect(async () => {
      const res = await disconnectMangabakaAction();
      if (!res.success) setMessage(res.error ?? "Could not disconnect MangaBaka.");
    });
  };

  const resync = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await resyncProviderAction({ provider: "mangabaka" });
      if (res.success) setMessage(`Resynced — ${res.count ?? 0} titles.`);
      else setMessage(res.error ?? "Could not resync MangaBaka.");
    });
  };

  return (
    <div className="space-y-2">
      {connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">MangaBaka connected</p>
            <p className="text-sm text-muted-foreground">
              Your reading progress and library sync with autohunt using your personal access token.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button variant="ghost" size="sm" disabled={pending} onClick={resync}>
              <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
              Resync
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              disabled={disconnectPending}
              onClick={disconnect}
            >
              <Unlink className="h-3.5 w-3.5" /> Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <form
          ref={formRef}
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            connect();
          }}
        >
          <p className="text-sm text-muted-foreground">
            Connect MangaBaka with a personal access token to show your latest chapter in search
            results and when you add titles.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              className="min-w-52 flex-1"
              placeholder="mb-…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <Button type="submit" variant="outline" size="sm" disabled={pending || token.trim().length < 4}>
              <Link2 className="h-3.5 w-3.5" />
              {pending ? "Connecting…" : "Connect"}
            </Button>
          </div>
        </form>
      )}
      {message && (
        <p
          className={`text-sm ${
            message.startsWith("Synced") || message.startsWith("Resynced") || message.startsWith("Connected")
              ? "text-emerald-600 dark:text-emerald-300"
              : "text-destructive"
          }`}
        >
          {message}
        </p>
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