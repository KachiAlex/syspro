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
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    console.log('Applying automation seeds...');

    // Ensure an automation exists and get its id
    let automationId = null;
    try {
      const a = await client.query("select id from automations where name = 'Sample: Vendor Onboarding' limit 1");
      if (a.rows.length) automationId = a.rows[0].id;
      else {
        const ins = await client.query("insert into automations (id, name, description, owner_id, enabled, metadata) values (gen_random_uuid(), $1, $2, $3, $4, $5) returning id", ['Sample: Vendor Onboarding', 'Example automation to demonstrate rule triggering on vendor.created', null, true, JSON.stringify({ example: true })]);
        automationId = ins.rows[0].id;
      }
    } catch (e) {
      // automations table may differ; try to create a minimal row if possible
      try {
        const ins = await client.query("insert into automations (id, name, description) values (gen_random_uuid(), $1, $2) returning id", ['Sample: Vendor Onboarding', 'Example automation']);
        automationId = ins.rows[0].id;
      } catch (ee) {
        // ignore: fallback to null
      }
    }

    // Inspect automation_rules schema
    const colsRes = await client.query("select column_name from information_schema.columns where table_name='automation_rules'");
    const cols = new Set(colsRes.rows.map(r => r.column_name.toLowerCase()));

    if (cols.has('automation_id')) {
      await client.query(
        `insert into automation_rules (id, automation_id, name, conditions, actions, priority, enabled)
         values (gen_random_uuid(), $1, $2, $3::jsonb, $4::jsonb, $5, $6) on conflict do nothing`,
        [automationId, 'Welcome new vendor', JSON.stringify([{ op: 'eq', path: 'type', value: 'vendor.created' }]), JSON.stringify([{ op: 'log', message: 'Notify: new vendor created' }]), 10, true]
      );
    } else if (cols.has('tenant_slug') && cols.has('event_type')) {
      // insert into tenant-scoped automation_rules
      const tenantSlug = 'global';
      await client.query(
        `insert into automation_rules (id, tenant_slug, name, description, event_type, condition, actions, enabled)
         values (gen_random_uuid(), $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7) on conflict do nothing`,
        [tenantSlug, 'Welcome new vendor', 'Rule for vendor.created', 'vendor.created', JSON.stringify([{ op: 'eq', path: 'type', value: 'vendor.created' }]), JSON.stringify([{ op: 'log', message: 'Notify: new vendor created' }]), true]
      );
    } else {
      console.warn('Unrecognized automation_rules schema; skipping automation rule seed.');
    }

    console.log('Seeds applied successfully.');
  } catch (err) {
    console.error('Error applying seeds:', err.message || err);
    process.exitCode = 2;
  } finally {
    await client.end();
  }
}

if (require.main === module) main();
