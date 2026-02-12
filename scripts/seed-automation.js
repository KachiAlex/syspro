#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const dbUrl = process.env.DATABASE_URL || process.argv[2];
  if (!dbUrl) {
    console.error('Usage: DATABASE_URL=postgres://... node scripts/seed-automation.js');
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, '..', 'db', 'seeds', '20260212_seed_automation.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('Seed file not found:', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    console.log('Applying automation seeds...');
    await client.query(sql);
    console.log('Seeds applied successfully.');
  } catch (err) {
    console.error('Error applying seeds:', err.message || err);
    process.exitCode = 2;
  } finally {
    await client.end();
  }
}

if (require.main === module) main();
