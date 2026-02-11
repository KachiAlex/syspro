#!/usr/bin/env node
const { Pool } = require('pg');
(async ()=>{
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return console.error('DATABASE_URL not set');
  const pool = new Pool({ connectionString, max:1 });
  const client = await pool.connect();
  try {
    const res = await client.query("select column_name, data_type from information_schema.columns where table_name='users' order by ordinal_position");
    console.log('users table columns:');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) { console.error(e); }
  finally { client.release(); await pool.end(); }
})();
