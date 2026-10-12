-- Catalogue retention preview for AniMangaBuckList.
-- Default policy: current calendar year minus 9 (2026 => 2017 onward).
-- This file is intentionally READ-ONLY. Inspect candidates and storage estimate
-- before running any DELETE manually. User-owned tables are never modified here.
-- Requires the title_external_ids table (identity migration 0011) and title_comments.

WITH policy AS (
  SELECT EXTRACT(YEAR FROM CURRENT_DATE)::integer - 9 AS cutoff_year
),
candidates AS (
  SELECT
    mb.id,
    COALESCE(mb.year, EXTRACT(YEAR FROM mb.start_date)::integer) AS release_year,
    pg_column_size(mb) AS row_bytes
  FROM mangabaka_series AS mb
  CROSS JOIN policy
  WHERE COALESCE(mb.year, EXTRACT(YEAR FROM mb.start_date)::integer) < policy.cutoff_year
    -- Preserve any title already represented in the app's title table.
    AND NOT EXISTS (
      SELECT 1 FROM titles AS t
      WHERE mb.mal_id IS NOT NULL AND t.mal_id = mb.mal_id
    )
    -- Preserve IDs already present in imported provider lists.
    AND NOT EXISTS (
      SELECT 1 FROM provider_entries AS pe
      WHERE lower(pe.provider) = 'mangabaka'
        AND pe.external_id = mb.id::text
    )
    AND NOT EXISTS (
      SELECT 1 FROM provider_entries AS pe
      WHERE mb.mal_id IS NOT NULL AND pe.mal_id = mb.mal_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM provider_entries AS pe
      WHERE mb.anilist_id IS NOT NULL AND pe.anilist_id = mb.anilist_id
    )
    -- Preserve IDs already mapped through the identity link table.
    AND NOT EXISTS (
      SELECT 1 FROM title_external_ids AS x
      WHERE (x.provider = 'mangabaka' AND x.external_id = mb.id::text)
        OR (x.provider LIKE 'mal%' AND mb.mal_id IS NOT NULL AND x.external_id = mb.mal_id::text)
        OR (x.provider = 'anilist' AND mb.anilist_id IS NOT NULL AND x.external_id = mb.anilist_id::text)
    )
    -- Preserve any series a user has commented on. title_comments.series_id is an
    -- unconstrained integer key into mangabaka_series.id.
    AND NOT EXISTS (
      SELECT 1 FROM title_comments AS tc
      WHERE tc.series_id = mb.id
    )
)
SELECT
  (SELECT cutoff_year FROM policy) AS cutoff_year,
  COUNT(*) AS candidate_rows,
  pg_size_pretty(COALESCE(SUM(row_bytes), 0)::bigint) AS approximate_row_payload,
  MIN(release_year) AS oldest_candidate_year,
  MAX(release_year) AS newest_candidate_year
FROM candidates;

-- Deliberately not included as an executable statement:
-- Review the preview and take a database backup before pruning. If/when approved,
-- run a DELETE using exactly the candidate predicates above inside a transaction,
-- inspect the affected-row count, and ROLLBACK if it differs from expectations.
-- Do not delete from titles, user_library, user_progress, ratings, notes, or comments.
