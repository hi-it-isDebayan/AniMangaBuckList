import type { Metadata } from "next";
import { Fingerprint, MonitorSmartphone, KeyRound } from "lucide-react";
import { requireUser, listSessions, getCurrentSessionId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { eq } from "drizzle-orm";
import { publicApiKeys, userOauthAccounts, users } from "@ambl/database";
import { getCredentialsForUser } from "@/lib/passkeys";
import { SettingsForm } from "@/components/settings-form";
import { PasskeyManager } from "@/components/passkey-manager";
import { ConnectedAccounts } from "@/components/connected-accounts";
import { countMangabakaEntries, mangabakaLastSynced } from "@/lib/provider-sync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await requireUser();
  const db = getDb();
  const [row] = await db
    .select({ preferences: users.preferences, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const prefs = row?.preferences ?? { notifications: { episodes: false, chapters: false } };
  const hasPassword = !!row?.passwordHash;

  const authAccounts = await db
    .select({ provider: userOauthAccounts.provider })
    .from(userOauthAccounts)
    .where(eq(userOauthAccounts.userId, user.id));

  const linkedProviders = new Set(authAccounts.map((a) => a.provider));

  const [sessionRows, currentSessionId, passkeys, mangabakaCount, mangabakaSyncedAt] =
    await Promise.all([
      listSessions(user.id),
      getCurrentSessionId(),
      getCredentialsForUser(user.id),
      countMangabakaEntries(user.id),
      mangabakaLastSynced(user.id),
    ]);

  const mangabakaConfigured = !!process.env.MANGABAKA_API_KEY?.trim();

  const apiKeys = await db
    .select({
      id: publicApiKeys.id,
      name: publicApiKeys.name,
      lastFour: publicApiKeys.lastFour,
      createdAt: publicApiKeys.createdAt,
      lastUsedAt: publicApiKeys.lastUsedAt,
    })
    .from(publicApiKeys)
    .where(eq(publicApiKeys.userId, user.id));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {!user.emailVerifiedAt && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
          <p className="flex items-center gap-2 text-sm text-destructive">
            <span className="h-4 w-4">⚠️</span>
            <span>Verify your email to use password recovery and keep recovery emails secure.</span>
          </p>
        </div>
      )}

      <div className="rounded-lg border bg-card p-4 space-y-4">
        <h2 className="text-lg font-semibold">Profile</h2>
        <SettingsForm
          email={user.email}
          displayName={user.displayName}
          notifyEpisodes={prefs.notifications?.episodes ?? false}
          notifyChapters={prefs.notifications?.chapters ?? false}
        />
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Fingerprint className="h-4 w-4 text-primary" />
          Passkeys
        </h2>
        <PasskeyManager
          credentials={passkeys.map((p) => ({
            ...p,
            createdAt: p.createdAt.toISOString(),
            lastUsedAt: p.lastUsedAt ? p.lastUsedAt.toISOString() : null,
          }))}
        />
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <MonitorSmartphone className="h-4 w-4 text-primary" />
          Devices & Sessions
        </h2>
        <div className="space-y-2">
          {sessionRows.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between p-2 rounded-lg border"
            >
              <div>
                <p className="font-medium">{s.deviceLabel ?? "Unknown device"}</p>
                <p className="text-xs text-muted-foreground">
                  {s.ipAddress ?? "Unknown IP"} · {new Date(s.createdAt).toLocaleString()}
                </p>
              </div>
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full",
                  s.id === currentSessionId
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {s.id === currentSessionId ? "Current" : "Active"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <MonitorSmartphone className="h-4 w-4 text-primary" />
          Connected Accounts
        </h2>
        <ConnectedAccounts
          linkedGoogle={linkedProviders.has("google")}
          hasPassword={hasPassword}
          mangabakaConfigured={mangabakaConfigured}
          mangabakaCount={mangabakaCount}
          mangabakaLastSynced={mangabakaSyncedAt ? mangabakaSyncedAt.toISOString() : null}
        />
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <KeyRound className="h-4 w-4 text-primary" />
          API Keys
        </h2>
        {apiKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No API keys created yet.</p>
        ) : (
          <div className="space-y-2">
            {apiKeys.map((k) => (
              <div key={k.id} className="flex items-center justify-between p-2 rounded-lg border">
                <div>
                  <p className="font-medium">{k.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {k.lastFour} · Created {new Date(k.createdAt).toLocaleDateString()}
                    {k.lastUsedAt ? " · Last used " + new Date(k.lastUsedAt).toLocaleDateString() : ""}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { /* delete action */ }}>
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}