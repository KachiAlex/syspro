#!/usr/bin/env node
const { Pool } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString, max: 1 });
  const client = await pool.connect();

  try {
    console.log('Connected to DB');

    // Find candidate tables to truncate by prefix or specific names
    const res = await client.query(
      `select table_name from information_schema.tables where table_schema = 'public' and (
         table_name like 'admin_%' or
         table_name like 'crm_%' or
         table_name like 'finance_%' or
         table_name like 'tenants' or
         table_name like 'auth_%' or
         table_name like 'users%' or
         table_name like 'session%' or
         table_name like 'people_%' or
         table_name like 'org_%' or
         table_name like 'payments_%' or
         table_name like 'invoice%' or
         table_name like 'admin_%' or
         table_name like 'crm_%' or
         table_name like 'finance_%'
       )`);

    const tables = res.rows.map(r => r.table_name).filter(Boolean);

    if (tables.length === 0) {
      console.log('No matching tables found to truncate.');
      return;
    }

    console.log('Tables found to clear:', tables.join(', '));

    // Run truncate in a transaction
    await client.query('BEGIN');
    const escaped = tables.map(t => '"' + t.replace(/"/g, '""') + '"').join(', ');
    const sql = `TRUNCATE TABLE ${escaped} RESTART IDENTITY CASCADE`;
    console.log('Executing:', sql);
    await client.query(sql);
    await client.query('COMMIT');

    console.log('Truncate completed successfully');
  } catch (err) {
    console.error('Error while truncating tables:', err);
    try { await client.query('ROLLBACK'); } catch(e){}
    process.exitCode = 2;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
