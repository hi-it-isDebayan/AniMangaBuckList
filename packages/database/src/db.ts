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
    client = postgres(connectionString, { max: 5, prepare: false });
  }
  _db = drizzle(client, { schema });
  return _db;
}