import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { eq } from "drizzle-orm";
import { users } from "@ambl/database";
import { SettingsForm } from "@/components/settings-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const db = getDb();
  const [row] = await db
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const prefs = row?.preferences ?? { notifications: { episodes: false, chapters: false } };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

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
    </div>
  );
}