import type { Metadata } from "next";
import { AlertTriangle, KeyRound, Fingerprint, MonitorSmartphone } from "lucide-react";
import { requireUser, listSessions, getCurrentSessionId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { eq } from "drizzle-orm";
import { publicApiKeys, userOauthAccounts, oauthTokens, users } from "@ambl/database";
import { getCredentialsForUser } from "@/lib/passkeys";
import { SettingsForm } from "@/components/settings-form";
import { ConnectedAccounts } from "@/components/connected-accounts";
import { ApiKeyManager } from "@/components/api-key-manager";
import { PasskeyManager } from "@/components/passkey-manager";
import { SessionsCard } from "@/components/sessions-card";
import { ResendVerifyButton } from "@/components/resend-verify-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  const emailVerified = !!user.emailVerifiedAt;

  const authAccounts = await db
    .select({ provider: userOauthAccounts.provider })
    .from(userOauthAccounts)
    .where(eq(userOauthAccounts.userId, user.id));

  const linkedProviders = new Set(authAccounts.map((a) => a.provider));

  const trackerTokens = await db
    .select({ provider: oauthTokens.provider })
    .from(oauthTokens)
    .where(eq(oauthTokens.userId, user.id));
  const trackedProviders = new Set(trackerTokens.map((t) => t.provider));

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

  const [sessionRows, currentSessionId, passkeys] = await Promise.all([
    listSessions(user.id),
    getCurrentSessionId(),
    getCredentialsForUser(user.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {!emailVerified && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Verify your email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Verify your email to use password recovery, and keep recovery emails secure.
            </p>
            <ResendVerifyButton />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsForm
            email={user.email}
            displayName={user.displayName}
            notifyEpisodes={prefs.notifications?.episodes ?? false}
            notifyChapters={prefs.notifications?.chapters ?? false}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-primary" /> Passkeys
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PasskeyManager
            credentials={passkeys.map((p) => ({
              ...p,
              createdAt: p.createdAt.toISOString(),
              lastUsedAt: p.lastUsedAt ? p.lastUsedAt.toISOString() : null,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MonitorSmartphone className="h-4 w-4 text-primary" /> Devices & sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SessionsCard
            sessions={sessionRows.map((s) => ({
              id: s.id,
              deviceLabel: s.deviceLabel,
              ipAddress: s.ipAddress,
createdAt: s.createdAt.toISOString(),
                  lastSeenAt: s.lastSeenAt ? s.lastSeenAt.toISOString() : new Date(0).toISOString(),
                  expiresAt: s.expiresAt.toISOString(),
            }))}
            currentSessionId={currentSessionId}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connected accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <ConnectedAccounts
            linkedGoogle={linkedProviders.has("google")}
            linkedMal={linkedProviders.has("mal")}
            linkedAnilist={linkedProviders.has("anilist")}
            trackedMal={trackedProviders.has("mal")}
            trackedAnilist={trackedProviders.has("anilist")}
            mangabakaConnected={trackedProviders.has("mangabaka")}
            hasPassword={hasPassword}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> Apps & sharing API key
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ApiKeyManager
            keys={apiKeys.map((k) => ({
              ...k,
              createdAt: k.createdAt.toISOString(),
              lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}