import type { Metadata } from "next";
import { Fingerprint, MonitorSmartphone, KeyRound, Settings as SettingsIcon } from "lucide-react";
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
import { ApiKeysList } from "@/components/api-keys-list";
import { PageHeader } from "@/components/page-header";
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
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        subtitle="Profile, security, connected accounts and API keys."
      />

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {!user.emailVerifiedAt && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3">
          <p className="flex items-center gap-2 text-sm text-destructive">
            <span className="h-4 w-4">⚠️</span>
            <span>Verify your email to use password recovery and keep recovery emails secure.</span>
          </p>
        </div>
      )}

      <div className="space-y-4 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm shadow-black/[0.03]">
        <h2 className="font-display text-base font-bold tracking-tight">Profile</h2>
        <SettingsForm
          email={user.email}
          displayName={user.displayName}
          notifyEpisodes={prefs.notifications?.episodes ?? false}
          notifyChapters={prefs.notifications?.chapters ?? false}
        />
      </div>

      <div className="space-y-4 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm shadow-black/[0.03]">
        <h2 className="flex items-center gap-2.5 font-display text-base font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <Fingerprint className="h-4 w-4" />
          </span>
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

      <div className="space-y-4 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm shadow-black/[0.03]">
        <h2 className="flex items-center gap-2.5 font-display text-base font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <MonitorSmartphone className="h-4 w-4" />
          </span>
          Devices &amp; sessions
        </h2>
        <div className="space-y-2">
          {sessionRows.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-xl border border-border/70 bg-background/50 p-2.5"
            >
              <div>
                <p className="text-sm font-medium">{s.deviceLabel ?? "Unknown device"}</p>
                <p className="text-xs text-muted-foreground">
                  {s.ipAddress ?? "Unknown IP"} · {new Date(s.createdAt).toLocaleString()}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  s.id === currentSessionId
                    ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {s.id === currentSessionId ? "Current" : "Active"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm shadow-black/[0.03]">
        <h2 className="flex items-center gap-2.5 font-display text-base font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <MonitorSmartphone className="h-4 w-4" />
          </span>
          Connected accounts
        </h2>
        <ConnectedAccounts
          linkedGoogle={linkedProviders.has("google")}
          hasPassword={hasPassword}
          mangabakaConfigured={mangabakaConfigured}
          mangabakaCount={mangabakaCount}
          mangabakaLastSynced={mangabakaSyncedAt ? mangabakaSyncedAt.toISOString() : null}
        />
      </div>

      <div className="space-y-4 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm shadow-black/[0.03]">
        <h2 className="flex items-center gap-2.5 font-display text-base font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <KeyRound className="h-4 w-4" />
          </span>
          API keys
        </h2>
        {apiKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No API keys created yet.</p>
        ) : (
          <ApiKeysList
            items={apiKeys.map((k) => ({
              id: k.id,
              name: k.name,
              lastFour: k.lastFour,
              createdAt: k.createdAt.toISOString(),
              lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
            }))}
          />
        )}
      </div>
    </div>
  );
}