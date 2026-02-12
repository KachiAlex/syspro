#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const dbUrl = process.env.DATABASE_URL || process.argv[2];
  if (!dbUrl) {
    console.error('Usage: DATABASE_URL=postgres://... node scripts/seed-admin.js');
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, '..', 'db', 'seeds', '20260212_seed_admin.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('Seed file not found:', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    console.log('Applying admin seeds...');

    // Adapt to existing `permissions` table schema if columns differ.
    const colsRes = await client.query("select column_name from information_schema.columns where table_name='permissions'");
    const cols = new Set(colsRes.rows.map(r => r.column_name));
    const colsLower = new Set(colsRes.rows.map(r => r.column_name.toLowerCase()));

    // If the permissions table uses (resource, action) style, insert into those columns.
    const perms = [
      { resource: 'admin', action: 'all', name: 'Super Admin', description: 'Full system access' },
      { resource: 'tenant.admin', action: 'users:view', name: 'View users' },
      { resource: 'tenant.admin', action: 'users:create', name: 'Create users' },
      { resource: 'tenant.admin', action: 'users:edit', name: 'Edit users' },
      { resource: 'tenant.admin', action: 'roles:manage', name: 'Manage roles' },
    ];

    // Find or create a role to attach permissions to when roleId is required
    let roleId = null;
    try {
      const roleRes = await client.query("select id from roles where name = 'Super Admin' limit 1");
      if (roleRes.rows.length) roleId = roleRes.rows[0].id;
      else {
        const ins = await client.query("insert into roles (id, tenant_id, name, description, is_predefined) values (gen_random_uuid(), NULL, 'Super Admin', 'Platform super administrator', true) returning id");
        roleId = ins.rows[0].id;
      }
    } catch (err) {
      // roles table may have different schema; leave roleId null
    }

    // If roleId is still null try to pick any existing role id
    if (!roleId) {
      try {
        const r = await client.query('select id from roles limit 1');
        if (r.rows.length) roleId = r.rows[0].id;
      } catch (e) {
        // ignore
      }
    }

    // If permissions.roleId exists but roles.id is not uuid, skip permission seeding to avoid type mismatch
    let rolesIdType = null;
    try {
      const rc = await client.query("select udt_name from information_schema.columns where table_name='roles' and column_name='id' limit 1");
      if (rc.rows.length) rolesIdType = rc.rows[0].udt_name;
    } catch (e) {
      // ignore
    }

    if (cols.has('resource') && cols.has('action')) {
      for (const p of perms) {
        const params = [p.resource, p.action, p.name, p.description];
        if (colsLower.has('roleid')) {
          if (rolesIdType && rolesIdType !== 'uuid') {
            console.warn('permissions.roleId exists but roles.id is not uuid; skipping permission inserts that require roleId');
            continue;
          }
          // include roleId
          await client.query(
            'insert into permissions (id, resource, action, name, description, "roleId") values (gen_random_uuid(), $1, $2, $3, $4, $5) on conflict do nothing',
            [p.resource, p.action, p.name, p.description, roleId]
          );
        } else {
          await client.query(
            'insert into permissions (id, resource, action, name, description) values (gen_random_uuid(), $1, $2, $3, $4) on conflict do nothing',
            params
          );
        }
      }
      console.log('Admin permissions seeded (resource/action style).');
    } else if (cols.has('key')) {
      // fallback to key/module/action style
      const perms2 = [
        { key: 'superadmin:*', module: 'admin', action: 'all', description: 'Full system access' },
        { key: 'tenant.admin:users:view', module: 'admin', action: 'view', description: 'View users' },
      ];
      for (const p of perms2) {
        if (colsLower.has('roleid')) {
          if (rolesIdType && rolesIdType !== 'uuid') {
            console.warn('permissions.roleId exists but roles.id is not uuid; skipping permission inserts that require roleId');
            continue;
          }
          await client.query(
            'insert into permissions (id, key, module, action, description, "roleId") values (gen_random_uuid(), $1, $2, $3, $4, $5) on conflict do nothing',
            [p.key, p.module, p.action, p.description, roleId]
          );
        } else {
          await client.query(
            'insert into permissions (id, key, module, action, description) values (gen_random_uuid(), $1, $2, $3, $4) on conflict do nothing',
            [p.key, p.module, p.action, p.description]
          );
        }
      }
      console.log('Admin permissions seeded (key style).');
    } else {
      // Unknown schema: attempt to insert a minimal row into any available columns
      console.warn('Unrecognized permissions schema; skipping permissions seed.');
    }

    // Roles: insert names if table has name column
    const roleCols = await client.query("select column_name from information_schema.columns where table_name='roles'");
    const rcols = new Set(roleCols.rows.map(r => r.column_name));
    const roles = ['Super Admin','Admin','Finance Manager','HR Manager','HOD','Staff'];
    if (rcols.has('name')) {
      for (const rn of roles) {
        if (rcols.has('tenant_id')) {
          await client.query('insert into roles (id, tenant_id, name, description, is_predefined) values (gen_random_uuid(), NULL, $1, $2, true) on conflict do nothing', [rn, rn+' role']);
        } else if (rcols.has('permissions')) {
          // older schema: id text, name, description, permissions jsonb
          const id = 'role_' + Math.random().toString(36).slice(2,8);
          const permsObj = { modules: {}, features: ['all'] };
          await client.query('insert into roles (id, name, description, permissions, created_at, updated_at) values ($1, $2, $3, $4, now(), now()) on conflict do nothing', [id, rn, rn + ' role', JSON.stringify(permsObj)]);
        } else {
          // fallback
          await client.query('insert into roles (id, name, description) values (gen_random_uuid(), $1, $2) on conflict do nothing', [rn, rn+' role']);
        }
      }
      console.log('Predefined roles seeded.');
    } else {
      console.warn('Roles table has unexpected schema; skipped role seeding.');
    }

    console.log('Admin seeds applied successfully.');
  } catch (err) {
    console.error('Error applying admin seeds:', err.message || err);
    process.exitCode = 2;
  } finally {
    await client.end();
  }
}

if (require.main === module) main();
