# Project notes

## VPS access (three independent paths)

1. `pisairtel-vps` — direct SSH on port 22 (key-only; UFW allows 22 to all — do NOT re-add per-IP allow rules: the admin IP is dynamic and whitelist rules caused the Oct-21 lockout)
2. `pisairtel-vps-ts` — SSH over Tailscale (100.103.180.105); works when port 22 is filtered since Tailscale tunnels outbound
3. `tailscale ssh root@100.103.180.105` — keyless Tailscale SSH; survives even sshd failure (served by tailscaled, not OpenSSH)
4. Out-of-band: provider noVNC console via the hosting panel

## Deployment (VPS)

- Production runs in Docker on the VPS (`pisairtel-vps` SSH alias, host 162.35.104.28).
- App container: `syspro-erp-app` (image `syspro-erp-app:patched`), DB: `syspro-erp-db` (postgres:17-alpine). Compose project dir: `/opt/syspro-erp`.
- `docker-compose.yml` and `Dockerfile` ARE tracked in this repo — keep them in sync; secrets live in `/opt/syspro-erp/.env` (untracked, see `.env.example`).
- Deploy: `scripts/deploy-vps.sh` (packages source, backs up server dir to `/root/syspro-erp-backup-*`, rsyncs, builds with `--build-arg DATABASE_URL`, tags `patched`, recreates, health-checks).
- The `next build` requires `DATABASE_URL` as a build arg — page-data collection queries the DB at build time.
- `syspro-erp-net` is declared `external` in compose because `pisairtel-nginx` is attached to it. NEVER let compose manage/remove it — `docker compose up` on a managed version tears the network down and strands nginx + db with empty network configs (happened 2026-10-21; fix: reconnect via `docker network connect` or recreate with the external declaration).
- Server-only dirs that must never be deleted by syncs: `/opt/shared-nginx/conf.d` (shared nginx vhosts), `/opt/syspro-erp/.env`, `/opt/pisairtel-sms/docker-compose.override.yml` (nginx mounts + external networks).

## Database access for tests/migrations

- The production DB is the VPS Docker Postgres, not Neon. Reach it via SSH tunnel:
  `ssh -L 5433:172.22.0.2:5432 -N pisairtel-vps` then
  `DATABASE_URL=postgresql://syspro:syspro_secure_pass_2026@localhost:5433/syspro_erp?sslmode=disable`
- Finance suites are skipped without `DATABASE_URL` set. Apply migrations through the same connection (`psql` is not installed on the host; run from a client or inside the container).

## Conventions

- Canonical GL posting goes through `src/lib/finance/gl.ts` `postGLEntry` — never write journal_entries/journal_entry_lines directly.
- Tables are provisioned at runtime via idempotent `ensure*Tables` (`CREATE TABLE IF NOT EXISTS`, `ALTER ... ADD COLUMN IF NOT EXISTS`); migrations in `db/migrations/` mirror them and must stay idempotent.
- Postgres `date` columns come back as JS `Date` at local midnight — cast to `::text` in SQL before slicing, or WAT shifts the date back a day.
- `journal_entry_lines` has no `tenant_slug` — tenant filtering joins through `journal_entries`.
- Test data uses `__<prefix>_<ts>__` tenant slugs; clean them after runs.
