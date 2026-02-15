#!/usr/bin/env node
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

async function main(){
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString, max: 2 });
  const client = await pool.connect();
  try {
    const tenantSlug = process.argv[2] || 'syscomptech';
    const firstName = process.argv[3] || 'Redemption';
    const lastName = process.argv[4] || 'Anyanwu';
    const email = process.argv[5] || 'admin@syscomptech.com';
    const password = process.argv[6] || 'admin123';

    const t = await client.query('select id from tenants where slug = $1 limit 1', [tenantSlug]);
    if (!t.rows.length) {
      console.error('Tenant not found:', tenantSlug);
      process.exit(1);
    }
    const tenantId = t.rows[0].id;

    // find or create a branch
    let b = await client.query('select id from branches where tenant_id = $1 limit 1', [tenantId]);
    let branchId;
    if (b.rows.length) {
      branchId = b.rows[0].id;
    } else {
      branchId = randomUUID();
      await client.query('insert into branches (id, tenant_id, name, code, base_currency, timezone, created_at, updated_at) values ($1,$2,$3,$4,$5,$6, now(), now())', [branchId, tenantId, 'Default Branch', `${tenantSlug.toUpperCase()}-001`, 'NGN', 'Africa/Lagos']);
      console.log('Created branch', branchId);
    }

    // upsert user
    const found = await client.query('select id from users where email = $1 limit 1', [email.toLowerCase()]);
    const passwordHash = bcrypt.hashSync(password, 12);
    if (found.rows.length) {
      const userId = found.rows[0].id;
      await client.query('update users set "tenantId"=$1, "firstName"=$2, "lastName"=$3, password=$4, "isActive"=$5, "emailVerified"=$6, "updatedAt"=now() where id = $7', [tenantId, firstName, lastName, passwordHash, true, true, userId]);
      console.log('Updated existing user', userId);
      // set branch admin
      await client.query('update branches set branch_admin_id = $1 where id = $2', [userId, branchId]);
    } else {
      const userId = randomUUID();
      await client.query('insert into users (id, email, "firstName", "lastName", password, "tenantId", "organizationId", "isActive", "emailVerified", "createdAt", "updatedAt") values ($1,$2,$3,$4,$5,$6,$7,$8,$9, now(), now())', [userId, email.toLowerCase(), firstName, lastName, passwordHash, tenantId, null, true, true]);
      console.log('Inserted user', userId);
      await client.query('update branches set branch_admin_id = $1 where id = $2', [userId, branchId]);
      console.log('Assigned branch admin to', branchId);
    }

    console.log('Admin creation complete for tenant', tenantSlug);
  } catch (err) {
    console.error('Error:', err);
    process.exitCode = 2;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
