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
  const tables = [
    'tenants', 'users', 'organization', 'organizations',
    'admin_roles', 'admin_employees', 'admin_departments', 'admin_access_controls', 'admin_approval_routes', 'admin_workflows', 'admin_modules',
    'crm_contacts', 'crm_leads', 'crm_customers', 'crm_deals',
    'finance_accounts', 'finance_invoices', 'finance_payments', 'finance_invoice_lines', 'finance_trend_points',
    'org_admin_assignments'
  ];

  try {
    console.log('Checking counts for tables...');
    for (const t of tables) {
      try {
        const res = await client.query(`select count(*) as cnt from "${t}"`);
        const cnt = res.rows[0].cnt;
        console.log(`${t}: ${cnt}`);
      } catch (err) {
        console.log(`${t}: (missing or error)`);
      }
    }
  } catch (err) {
    console.error('Error during checks', err);
    process.exitCode = 2;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
