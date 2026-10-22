diff --git a/scripts/neon-mangabaka-storage.sql b/scripts/neon-mangabaka-storage.sql
new file mode 100644
index 0000000..866e2a3
--- /dev/null
+++ b/scripts/neon-mangabaka-storage.sql
@@ -0,0 +1,84 @@
+-- Read-only diagnostics for Neon/PostgreSQL catalogue storage.
+-- Run in the Neon SQL Editor. No rows are changed.
+-- This reports actual table/index sizes and representative field sizes.
+
+-- 1) Overall catalogue table and index footprint.
+SELECT
+  c.relname AS table_name,
+  pg_size_pretty(pg_relation_size(c.oid)) AS heap_size,
+  pg_size_pretty(pg_indexes_size(c.oid)) AS indexes_size,
+  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
+  (SELECT count(*) FROM public.mangabaka_series) AS exact_rows
+FROM pg_class c
+JOIN pg_namespace n ON n.oid = c.relnamespace
+WHERE n.nspname = 'public'
+  AND c.relname = 'mangabaka_series'
+  AND c.relkind = 'r';
+
+-- 2) Per-index size; helps identify expensive indexes before considering changes.
+SELECT
+  indexrelname AS index_name,
+  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
+  idx_scan AS index_scans,
+  idx_tup_read AS tuples_read,
+  idx_tup_fetch AS tuples_fetched
+FROM pg_stat_user_indexes
+WHERE schemaname = 'public'
+  AND relname = 'mangabaka_series'
+ORDER BY pg_relation_size(indexrelid) DESC;
+
+-- 3) Approximate per-field storage across up to 2,000 representative rows.
+-- Values are average PostgreSQL datum sizes, not exact marginal savings if dropped.
+WITH sample AS (
+  SELECT *
+  FROM public.mangabaka_series
+  ORDER BY id
+  LIMIT 2000
+)
+SELECT field, avg(bytes)::numeric(12,1) AS avg_bytes, max(bytes) AS max_bytes
+FROM sample
+CROSS JOIN LATERAL (VALUES
+  ('primary_title', pg_column_size(primary_title)),
+  ('english_title', pg_column_size(english_title)),
+  ('native_title', pg_column_size(native_title)),
+  ('japanese_title', pg_column_size(japanese_title)),
+  ('synopsis', pg_column_size(synopsis)),
+  ('cover_url', pg_column_size(cover_url)),
+  ('genres', pg_column_size(genres)),
+  ('tags', pg_column_size(tags)),
+  ('authors', pg_column_size(authors)),
+  ('artists', pg_column_size(artists)),
+  ('publishers', pg_column_size(publishers)),
+  ('canonical_url', pg_column_size(canonical_url))
+) AS fields(field, bytes)
+GROUP BY field
+ORDER BY avg(bytes) DESC;
+
+-- 4) Project current total table+index footprint at 200,000 rows.
+-- This is a linear estimate; actual growth varies with text, arrays, TOAST and indexes.
+WITH footprint AS (
+  SELECT
+    pg_total_relation_size('public.mangabaka_series'::regclass)::numeric AS total_bytes,
+    count(*)::numeric AS rows
+  FROM public.mangabaka_series
+)
+SELECT
+  rows AS current_rows,
+  pg_size_pretty(total_bytes::bigint) AS current_total_size,
+  CASE WHEN rows > 0
+    THEN pg_size_pretty((total_bytes * 200000 / rows)::bigint)
+    ELSE 'N/A (empty table)'
+  END AS estimated_total_at_200k_rows,
+  CASE WHEN rows > 0
+    THEN round((total_bytes / rows) / 1024, 2)
+    ELSE NULL
+  END AS current_kib_per_row
+FROM footprint;
+
+-- 5) Database-wide user table/index footprint (context for the plan quota).
+SELECT
+  schemaname,
+  relname AS table_name,
+  pg_size_pretty(pg_total_relation_size(format('%I.%I', schemaname, relname)::regclass)) AS total_size
+FROM pg_stat_user_tables
+ORDER BY pg_total_relation_size(format('%I.%I', schemaname, relname)::regclass) DESC;
