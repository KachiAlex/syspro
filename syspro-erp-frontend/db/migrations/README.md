## Migrations

This folder contains SQL migration files. A new migration was added: `2026_03_13_create_reports_summary_mv.sql`.

How to run a migration (example with psql):

```powershell
setx DATABASE_URL "postgresql://user:pass@host:5432/dbname"
psql "%DATABASE_URL%" -f 2026_03_13_create_reports_summary_mv.sql
```

Or using a standard psql environment variable on Unix-like shells:

```bash
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
psql "$DATABASE_URL" -f 2026_03_13_create_reports_summary_mv.sql
```

Refresh and scheduling
- Best: run a scheduled job that calls the refresh endpoint using an internal token.

Example cron (every 5 minutes) using `curl` and an environment variable `REPORTS_REFRESH_TOKEN`:

```
*/5 * * * * REPORTS_REFRESH_TOKEN=supersecret /usr/bin/curl -s -X POST -H "x-internal-refresh-token: $REPORTS_REFRESH_TOKEN" https://example.com/api/reports/summary/refresh
```

Or use the included Node script `scripts/refresh-reports-summary.mjs` (preferred for robust retries):

```
*/5 * * * * REPORTS_REFRESH_TOKEN=supersecret REPORTS_REFRESH_ENDPOINT=https://example.com/api/reports/summary/refresh /usr/bin/node /path/to/repo/scripts/refresh-reports-summary.mjs
```

Notes:
- For production, set `REPORTS_REFRESH_TOKEN` to a strong secret in your CI/CD or secret manager.
- The endpoint also requires admin auth for interactive calls; the token bypass is only for internal scheduled runs.
- Prefer `REFRESH MATERIALIZED VIEW CONCURRENTLY reports_summary_mv;` where supported to avoid blocking reads.
