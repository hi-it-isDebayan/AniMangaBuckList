import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { eq } from "drizzle-orm";
import { userOauthAccounts, users } from "@ambl/database";
import { SettingsForm } from "@/components/settings-form";
import { ConnectedAccounts } from "@/components/connected-accounts";
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
            linkedMal={linkedProviders.has("mal")}
            hasPassword={hasPassword}
          />
        </CardContent>
      </Card>
    </div>
  );
}