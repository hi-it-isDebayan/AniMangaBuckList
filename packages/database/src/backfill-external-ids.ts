import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {
  await sql`
    insert into title_external_ids (title_id, provider, external_id)
    select id,
           case when media_type = 'ANIME' then 'mal:anime' else 'mal:manga' end,
           mal_id::text
    from titles
    where mal_id is not null
    on conflict (provider, external_id) do nothing
  `;

  await sql`
    with title_by_mal as (
      select distinct on (mal_id) mal_id, id
      from titles
      where mal_id is not null
      order by mal_id, created_at asc, id asc
    )
    insert into title_external_ids (title_id, provider, external_id)
    select tbm.id, 'mangabaka', ms.id::text
    from mangabaka_series ms
    join title_by_mal tbm on tbm.mal_id = ms.mal_id
    where ms.mal_id is not null
    on conflict (provider, external_id) do nothing
  `;

  await sql`
    with title_by_mal as (
      select distinct on (mal_id) mal_id, id
      from titles
      where mal_id is not null
      order by mal_id, created_at asc, id asc
    )
    insert into title_external_ids (title_id, provider, external_id)
    select tbm.id, 'anilist', ms.anilist_id::text
    from mangabaka_series ms
    join title_by_mal tbm on tbm.mal_id = ms.mal_id
    where ms.mal_id is not null and ms.anilist_id is not null
    on conflict (provider, external_id) do nothing
  `;

  await sql`
    insert into title_external_ids (title_id, provider, external_id)
    select t.id, 'mangabaka', ms.id::text
    from mangabaka_series ms
    join titles t
      on lower(t.primary_title) = lower(ms.primary_title)
     and t.source = 'MANGABAKA'
     and t.mal_id is null
    where ms.mal_id is null
    on conflict (provider, external_id) do nothing
  `;

  const totals = await sql<
    { provider: string; n: number }[]
  >`select provider, count(*)::int as n from title_external_ids group by provider order by provider`;
  console.log("Backfill complete. Links by provider:");
  for (const row of totals) console.log(`  ${row.provider}: ${row.n}`);
}

try {
  await main();
} catch (err) {
  console.error("Backfill failed.", err);
  process.exit(1);
} finally {
  await sql.end();
}
