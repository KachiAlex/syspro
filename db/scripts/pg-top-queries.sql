-- pg_stat_statements hotspot ranking for syspro_erp
--
-- Run against production Postgres:
--   ssh -L 5433:172.22.0.2:5432 -N pisairtel-vps
--   psql "postgresql://syspro:syspro_secure_pass_2026@localhost:5433/syspro_erp?sslmode=disable" -f db/scripts/pg-top-queries.sql
-- or inside the container:
--   ssh pisairtel-vps 'docker cp db/scripts/pg-top-queries.sql syspro-erp-db:/tmp/t.sql && docker exec syspro-erp-db psql -U syspro -d syspro_erp -f /tmp/t.sql'
--
-- Meaningful only after real traffic has accumulated post-reset.

\echo '=== Top 20 by total time (overall hotspots) ==='
select calls,
       round(total_exec_time::numeric, 1) as total_ms,
       round(mean_exec_time::numeric, 2) as mean_ms,
       rows,
       left(regexp_replace(query, '[[:space:]]+', ' ', 'g'), 140) as query
from pg_stat_statements
where query not ilike '%pg_stat_statements%'
order by total_exec_time desc
limit 20;

\echo '=== Top 20 by mean time (per-call slowest) ==='
select calls,
       round(mean_exec_time::numeric, 2) as mean_ms,
       round(max_exec_time::numeric, 1) as max_ms,
       left(regexp_replace(query, '[[:space:]]+', ' ', 'g'), 140) as query
from pg_stat_statements
where query not ilike '%pg_stat_statements%'
  and calls >= 3
order by mean_exec_time desc
limit 20;

\echo '=== Top 20 by calls (highest frequency) ==='
select calls,
       round(mean_exec_time::numeric, 2) as mean_ms,
       round(total_exec_time::numeric, 1) as total_ms,
       left(regexp_replace(query, '[[:space:]]+', ' ', 'g'), 140) as query
from pg_stat_statements
where query not ilike '%pg_stat_statements%'
order by calls desc
limit 20;

\echo '=== Tables with high seq_scan vs idx_scan ratio (>100 rows) ==='
select relname, n_live_tup as rows, seq_scan, idx_scan,
       case when idx_scan = 0 then 'ALL SEQ'
            else round(seq_scan::numeric / greatest(idx_scan, 1), 1)::text end as seq_per_idx
from pg_stat_user_tables
where n_live_tup > 100 and seq_scan > 10
order by seq_scan desc
limit 20;
