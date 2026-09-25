import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { eq } from "drizzle-orm";
import { publicApiKeys, userOauthAccounts, users } from "@ambl/database";
import { SettingsForm } from "@/components/settings-form";
import { ConnectedAccounts } from "@/components/connected-accounts";
import { ApiKeyManager } from "@/components/api-key-manager";
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

  const authAccounts = await db
    .select({ provider: userOauthAccounts.provider })
    .from(userOauthAccounts)
    .where(eq(userOauthAccounts.userId, user.id));

  const linkedProviders = new Set(authAccounts.map((a) => a.provider));

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
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
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
          <CardTitle>Connected accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <ConnectedAccounts
            linkedGoogle={linkedProviders.has("google")}
            hasPassword={hasPassword}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Browser extension API key</CardTitle>
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