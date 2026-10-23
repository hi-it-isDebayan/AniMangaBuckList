import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let client: postgres.Sql | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to apps/web/.env and configure it first.");
  }
  if (!client) {
    // Serverless platforms (Vercel) freeze and clone function instances, so keep
    // one connection per instance and let the Neon pooler multiplex the rest.
    const max = process.env.VERCEL ? 1 : 5;
    client = postgres(connectionString, { max, prepare: false });
  }
  _db = drizzle(client, { schema });
  return _db;
}

/**
 * Close the pooled connection and drop the cached client. Useful for scripts
 * and tests that must let the Node process exit cleanly. Safe to call when no
 * connection has been opened yet.
 */
export async function closeDb(): Promise<void> {
  const active = client;
  client = null;
  _db = null;
  if (active) await active.end();
}