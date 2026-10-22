const fs = require("node:fs");
const path = require("node:path");
const p = path.resolve("apps/web/.env");
for (const raw of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(raw);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const postgres = require("postgres");
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

(async () => {
  const mode = process.argv[2] || "report";

  if (mode === "vacuum") {
    await sql.unsafe("VACUUM (ANALYZE) mangabaka_series");
    console.log("vacuum done");
  }

  const r = await sql.unsafe(
    "select pg_size_pretty(pg_total_relation_size('mangabaka_series')) as table_size, " +
      "pg_size_pretty(pg_database_size(current_database())) as db_size, " +
      "(select count(*)::int from mangabaka_series) as rows",
  );
  console.table(r);

  const vec = await sql.unsafe(
    "select count(*)::int as n from mangabaka_series " +
      "where coalesce(year, extract(year from start_date)::int) >= 2017 and state = 'active'",
  );
  console.log("in-window active now:", vec[0].n);

  await sql.end();
})().catch(async (e) => {
  console.error("ERR", e.message);
  await sql.end();
  process.exit(1);
});
