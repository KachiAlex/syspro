# Migrations

This folder contains SQL migration files for the Vendors & Procurement module.

How to run a migration (example with psql):

```powershell
setx DATABASE_URL "postgresql://user:pass@host:5432/dbname"
psql "%DATABASE_URL%" -f 20260202_create_vendors_procurement.sql
```

Or using a standard psql environment variable on Unix-like shells:

```bash
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
psql "$DATABASE_URL" -f 20260202_create_vendors_procurement.sql
```

Notes:
- The SQL uses `gen_random_uuid()` from `pgcrypto`; ensure the extension is allowed in your Postgres environment (Neon supports it via SQL). 
- For automated runs, integrate with your migration runner (Flyway, Sqitch, node-pg-migrate, or a simple script).
- After running, implement application-level triggers or jobs to maintain `vendor_balances`.
