import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok", ts: new Date().toISOString() });
  } catch {
    return Response.json(
      { status: "error", error: "database unavailable" },
      { status: 503 },
    );
  }
}
