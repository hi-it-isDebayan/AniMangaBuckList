import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { refreshStaleLibraryMetadata } from "@/lib/metadata-refresh";

export const dynamic = "force-dynamic";

/**
 * Refresh a small batch of the signed-in user's stale title metadata. The app
 * calls this once when it opens so chapter/episode counts stay current.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshStaleLibraryMetadata(user.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Metadata refresh failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not refresh metadata." },
      { status: 500 },
    );
  }
}
