#!/usr/bin/env node
/*
  Simple migration runner for SQL files in db/migrations
  - Requires `DATABASE_URL` env var
  - Tracks applied migrations in `schema_migrations`
*/
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

async function main() {
  const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set. Export DATABASE_URL and try again.');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id serial PRIMARY KEY,
        filename text NOT NULL UNIQUE,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const full = path.join(migrationsDir, file);
      const sql = fs.readFileSync(full, 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');

      const res = await client.query('SELECT checksum FROM schema_migrations WHERE filename = $1', [file]);
      if (res.rowCount > 0) {
        const existing = res.rows[0].checksum;
        if (existing === checksum) {
          console.log(`skip  ${file} (already applied)`);
          continue;
        } else {
          console.log(`warning: checksum mismatch for ${file}, applying anyway`);
        }
      }

      console.log(`apply  ${file}`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2) ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = now()',
          [file, checksum]
        );
        await client.query('COMMIT');
        console.log(`applied ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`failed ${file}:`, err.message || err);
        throw err;
      }
    }

    console.log('migrations complete');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration runner error:', err);
  process.exit(1);
});
