#!/usr/bin/env node
const { Pool } = require('pg');

async function main(){
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) { console.error('DATABASE_URL not set'); process.exit(1); }
  const pool = new Pool({ connectionString, max:1 });
  const client = await pool.connect();
  try {
    const slug = process.argv[2] || 'kreatix';
    const res = await client.query('select id, name, slug, admin_email, status from tenants where slug = $1 limit 1', [slug]);
    if (res.rows.length === 0) { console.log('Tenant not found', slug); process.exit(0); }
    console.log(res.rows[0]);
  } finally { client.release(); await pool.end(); }
}

main();
