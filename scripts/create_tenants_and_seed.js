#!/usr/bin/env node
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

async function ensureStructureTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS structure_nodes (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL,
      name text NOT NULL,
      tier_level integer NOT NULL,
      tier_type text NOT NULL,
      parent_id uuid,
      path text NOT NULL,
      depth integer NOT NULL,
      branch_id uuid,
      currency text,
      timezone text,
      compliance_profile_id uuid,
      is_active boolean DEFAULT true,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_structure_tenant ON structure_nodes(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_structure_parent ON structure_nodes(parent_id);
    CREATE INDEX IF NOT EXISTS idx_structure_tier ON structure_nodes(tier_type);
    CREATE INDEX IF NOT EXISTS idx_structure_path ON structure_nodes USING btree (path text_pattern_ops);

    CREATE TABLE IF NOT EXISTS branches (
      id uuid PRIMARY KEY,
      tenant_id uuid NOT NULL,
      name text NOT NULL,
      code text NOT NULL,
      base_currency text,
      timezone text,
      working_calendar_id uuid,
      branch_admin_id uuid,
      is_active boolean DEFAULT true,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      UNIQUE (tenant_id, code)
    );

    CREATE INDEX IF NOT EXISTS idx_branches_tenant ON branches(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_branches_admin ON branches(branch_admin_id);
  `);
}

async function upsertTenant(client, { companyName, companySlug, region, industry, seats, adminName, adminEmail, adminPassword, adminNotes }){
  const tenantId = randomUUID();
  const computedDomain = `${companySlug}.syspro.local`;
  const computedSchema = `${companySlug.replace(/-/g,'_')}_schema`;

  // generate unique code
  const base = companySlug.toUpperCase();
  let candidate = base;
  let counter = 1;
  while (true) {
    const r = await client.query('select 1 from tenants where code = $1 limit 1', [candidate]);
    if (r.rows.length === 0) break;
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  const passwordHash = bcrypt.hashSync(adminPassword, 12);

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
    companyName,
    companySlug,
    candidate,
    computedDomain,
    true,
    JSON.stringify({ base_currency: null, timezone: null }),
    computedSchema,
    region,
    industry,
    seats ?? null,
    adminName,
    adminEmail.toLowerCase(),
    passwordHash,
    adminNotes ?? ''
  ]);

  return res.rows[0].id || tenantId;
}

function slugify(name){
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g,'');
}

async function createNode(client, { id, tenant_id, name, tier_level, tier_type, parent_id=null, branch_id=null, currency=null, timezone=null, compliance_profile_id=null }){
  let parentPath = '';
  let depth = 0;
  if (parent_id) {
    const pr = await client.query('select path, depth from structure_nodes where id = $1 limit 1', [parent_id]);
    if (!pr.rows.length) throw new Error('parent_not_found:'+parent_id);
    parentPath = pr.rows[0].path;
    depth = pr.rows[0].depth + 1;
  }
  const slug = slugify(name);
  const path = parentPath ? `${parentPath}/${slug}` : `/${slug}`;
  await client.query(
    `insert into structure_nodes (id, tenant_id, name, tier_level, tier_type, parent_id, path, depth, branch_id, currency, timezone, compliance_profile_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     on conflict (id) do update set name = excluded.name, path = excluded.path, updated_at = now()`,
    [id, tenant_id, name, tier_level, tier_type, parent_id, path, depth, branch_id, currency, timezone, compliance_profile_id]
  );
}

async function createBranch(client, { id, tenant_id, name, code, base_currency, timezone, branch_admin_id=null }){
  await client.query(
    `insert into branches (id, tenant_id, name, code, base_currency, timezone, branch_admin_id)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (tenant_id, code) do update set name = excluded.name, base_currency = excluded.base_currency, timezone = excluded.timezone, updated_at = now()`,
    [id, tenant_id, name, code, base_currency, timezone, branch_admin_id]
  );
}

async function main(){
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString, max: 2 });
  const client = await pool.connect();
  try {
    console.log('Connected to DB');

    // ensure tenant table exists
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

    await ensureStructureTables(client);

    // Tenant 1
    const t1 = {
      companyName: 'Kreatix Technologies',
      companySlug: 'kreatix',
      region: 'WAF',
      industry: 'Software',
      seats: null,
      adminName: 'Akoma',
      adminEmail: 'akoma@kreatixtech.com',
      adminPassword: 'admin123',
      adminNotes: ''
    };

    // Tenant 2 mirrors tenant 1
    const t2 = Object.assign({}, t1, { companyName: 'Syscomptech', companySlug: 'syscomptech' });

    const tenantId1 = await upsertTenant(client, t1);
    console.log('Created tenant', t1.companySlug, tenantId1);

    const tenantId2 = await upsertTenant(client, t2);
    console.log('Created tenant', t2.companySlug, tenantId2);

    // Seed structure for both tenants
    for (const { tenant_id, rootName, baseCurrency, timezone, slug } of [
      { tenant_id: tenantId1, rootName: 'Kreatix Root', baseCurrency: 'NGN', timezone: 'Africa/Lagos', slug: 'kreatix' },
      { tenant_id: tenantId2, rootName: 'Syscomptech Root', baseCurrency: 'NGN', timezone: 'Africa/Lagos', slug: 'syscomptech' }
    ]){
      // create nodes
      const rootId = randomUUID();
      await createNode(client, { id: rootId, tenant_id, name: rootName, tier_level: 0, tier_type: 'TENANT', parent_id: null });

      const regionId = randomUUID();
      await createNode(client, { id: regionId, tenant_id, name: 'EMEA', tier_level: 1, tier_type: 'REGION', parent_id: rootId });

      const countryId = randomUUID();
      await createNode(client, { id: countryId, tenant_id, name: 'Nigeria', tier_level: 2, tier_type: 'COUNTRY', parent_id: regionId });

      const subId = randomUUID();
      await createNode(client, { id: subId, tenant_id, name: 'Subsidiary A', tier_level: 3, tier_type: 'SUBSIDIARY', parent_id: countryId });

      const branchId = randomUUID();
      const branchCode = `${slug.toUpperCase()}-001`;
      await createBranch(client, { id: branchId, tenant_id, name: `${slug} Main Branch`, code: branchCode, base_currency: baseCurrency, timezone });
      await createNode(client, { id: randomUUID(), tenant_id, name: 'Main Branch', tier_level: 4, tier_type: 'BRANCH', parent_id: subId, branch_id: branchId, currency: baseCurrency, timezone });

      console.log('Seeded structure for tenant', tenant_id);
    }

    console.log('All done');
  } catch (err) {
    console.error('Error:', err);
    process.exitCode = 2;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
