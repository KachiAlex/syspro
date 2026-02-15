#!/usr/bin/env node
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const v = args[i+1] && !args[i+1].startsWith('--') ? args[++i] : 'true';
    out[k] = v;
  }
  return out;
}

async function upsertTenant(client, opts){
  const tenantId = require('crypto').randomUUID();
  const computedDomain = `${opts.companySlug}.syspro.local`;
  const computedSchema = `${opts.companySlug.replace(/-/g,'_')}_schema`;

  const base = opts.companySlug.toUpperCase();
  let candidate = base;
  let counter = 1;
  while (true) {
    const r = await client.query('select 1 from tenants where code = $1 limit 1', [candidate]);
    if (r.rows.length === 0) break;
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  const passwordHash = bcrypt.hashSync(opts.adminPassword || 'changeme', 12);

  const q = `
    insert into tenants (
      id, name, slug, code, domain, "isActive", settings, "schemaName", region, industry, seats, admin_name, admin_email, admin_password_hash, admin_notes
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    on conflict (slug) do update set
      name = excluded.name,
      code = excluded.code,
      domain = excluded.domain,
      "isActive" = excluded."isActive",
      settings = excluded.settings,
      "schemaName" = excluded."schemaName",
      region = excluded.region,
      industry = excluded.industry,
      seats = excluded.seats,
      admin_name = excluded.admin_name,
      admin_email = excluded.admin_email,
      admin_password_hash = excluded.admin_password_hash,
      admin_notes = excluded.admin_notes
    returning id
  `;

  const res = await client.query(q, [
    tenantId,
    opts.companyName,
    opts.companySlug,
    candidate,
    computedDomain,
    true,
    JSON.stringify({ base_currency: null, timezone: null }),
    computedSchema,
    opts.region || null,
    opts.industry || null,
    opts.seats ? parseInt(opts.seats, 10) : null,
    `${opts.adminFirst || ''} ${opts.adminLast || ''}`.trim(),
    (opts.adminEmail || '').toLowerCase(),
    passwordHash,
    opts.adminNotes || ''
  ]);

  return res.rows[0]?.id || tenantId;
}

async function main(){
  const opts = parseArgs();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Aborting.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString, max: 2 });
  const client = await pool.connect();
  try {
    console.log('Connected to DB');
    await client.query(`
      create table if not exists tenants (
        id uuid primary key,
        name text not null,
        code text,
        domain text,
        "isActive" boolean default false,
        settings jsonb,
        "schemaName" text,
        region text,
        industry text,
        seats integer,
        slug text,
        admin_name text,
        admin_email text,
        admin_password_hash text,
        admin_notes text,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
    `);

    const tenantId = await upsertTenant(client, opts);
    console.log('Upserted tenant', opts.companySlug, tenantId);
  } catch (err) {
    console.error('Error:', err);
    process.exitCode = 2;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
