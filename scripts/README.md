# Scripts

- `run-migrations.js`: applies SQL files in db/migrations using `DATABASE_URL`, tracking checksums in `schema_migrations`.
- `automation-worker.mjs`: single-run worker that processes `automation_action_queue` and `report_jobs` (queued). Intended for cron or scheduled invocation. Wire real action/report handlers inside the script.
