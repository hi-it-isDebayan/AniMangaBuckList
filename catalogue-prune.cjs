const fs = require("node:fs");
const path = require("node:path");

const p = path.resolve("apps/web/.env");
for (const raw of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(raw);
  if (!m || m[1] in process.env) continue;
  process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const postgres = require("postgres");
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

const CUTOFF = new Date().getFullYear() - 10 + 1; // matches --years=10

const candidateCte = (cutoff) => sql`
  select mb.id
  from mangabaka_series mb
  where coalesce(mb.year, extract(year from mb.start_date)::int) < ${cutoff}
    and not exists (
      select 1 from titles t
      where mb.mal_id is not null and t.mal_id = mb.mal_id
    )
    and not exists (
      select 1 from provider_entries pe
      where lower(pe.provider) = 'mangabaka' and pe.external_id = mb.id::text
    )
    and not exists (
      select 1 from provider_entries pe
      where mb.mal_id is not null and pe.mal_id = mb.mal_id
    )
    and not exists (
      select 1 from provider_entries pe
      where mb.anilist_id is not null and pe.anilist_id = mb.anilist_id
    )
    and not exists (
      select 1 from title_external_ids x
      where (x.provider = 'mangabaka' and x.external_id = mb.id::text)
         or (x.provider like 'mal%' and mb.mal_id is not null and x.external_id = mb.mal_id::text)
         or (x.provider = 'anilist' and mb.anilist_id is not null and x.external_id = mb.anilist_id::text)
    )
    and not exists (
      select 1 from title_comments tc
      where tc.series_id = mb.id
    )
`;

(async () => {
  const mode = process.argv[2] || "preview";

  const before = await sql`select count(*)::int as n from mangabaka_series`;
  const sizeBefore = await sql`
    select pg_size_pretty(pg_total_relation_size('mangabaka_series')) as total,
           pg_size_pretty(pg_database_size(current_database())) as db
  `;
  console.log(`[${mode}] cutoffYear=${CUTOFF}`);
  console.log(`before: rows=${before[0].n} total=${sizeBefore[0].total} db=${sizeBefore[0].db}`);

  const cand = await sql`select count(*)::int as n from (${candidateCte(CUTOFF)}) c`;
  console.log(`candidates: ${cand[0].n}`);

  if (mode !== "apply") {
    console.log("preview only. re-run with 'apply' to delete.");
    await sql.end();
    return;
  }

  const EXPECTED_MAX = 100000;
  if (cand[0].n > EXPECTED_MAX) {
    console.error(`ABORT: ${cand[0].n} candidates exceeds safety ceiling ${EXPECTED_MAX}`);
    await sql.end();
    process.exit(2);
  }

  const rows = await sql.begin(async (tx) => {
    const res = await tx`
      with d as (
        delete from mangabaka_series
        where id in (${candidateCte(CUTOFF)})
        returning 1
      )
      select count(*)::int as n from d
    `;
    return res[0].n;
  });
  console.log(`deleted: ${rows}`);

  await sql`analyze mangabaka_series`;
  const after = await sql`select count(*)::int as n from mangabaka_series`;
  const sizeAfter = await sql`
    select pg_size_pretty(pg_total_relation_size('mangabaka_series')) as total,
           pg_size_pretty(pg_database_size(current_database())) as db
  `;
  console.log(`after: rows=${after[0].n} total=${sizeAfter[0].total} db=${sizeAfter[0].db}`);

  const buckets = await sql`
    select
      case
        when coalesce(year, extract(year from start_date)::int) is null then 'unknown_year'
        when coalesce(year, extract(year from start_date)::int) >= ${CUTOFF} then 'in_window'
        else 'out_of_window'
      end as bucket,
      state,
      count(*)::int as n
    from mangabaka_series
    group by 1, 2
    order by 1, 2
  `;
  console.table(buckets);

  await sql.end();
})().catch(async (e) => {
  console.error("ERROR:", e.message);
  await sql.end();
  process.exit(1);
});
