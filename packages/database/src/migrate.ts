import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

try {
  await client.unsafe("CREATE EXTENSION IF NOT EXISTS pg_trgm");
} catch (err) {
  console.error("Could not enable pg_trgm extension (ignoring).", err);
}

try {
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Migrations applied successfully.");
} catch (err) {
  console.error("Migration failed.", err);
  process.exit(1);
} finally {
  await client.end();
}