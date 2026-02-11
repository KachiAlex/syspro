#!/usr/bin/env node
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

async function ensureUsersTable(client) {
  // If an existing users table uses camelCase columns (tenantId, firstName, password), don't modify it.
  // We'll avoid destructive DDL here.
  return;
}

async function main(){
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString, max: 2 });
  const client = await pool.connect();
  try {
    await ensureUsersTable(client);

    const tenants = ['kreatix','syscomptech'];
    for (const slug of tenants) {
      const t = await client.query('select id from tenants where slug = $1 limit 1', [slug]);
      if (!t.rows.length) {
        console.warn('tenant not found', slug); continue;
      }
      const tenantId = t.rows[0].id;

      // find a branch for tenant
      const b = await client.query('select id from branches where tenant_id = $1 limit 1', [tenantId]);
      if (!b.rows.length) {
        console.warn('no branch found for tenant', slug); continue;
      }
      const branchId = b.rows[0].id;

      // create admin user
      const userId = randomUUID();
      const email = slug === 'kreatix' ? 'akoma@kreatixtech.com' : 'akoma@kreatixtech.com';
      const password = 'admin123';
      const passwordHash = bcrypt.hashSync(password, 12);

      // Insert using known column names in this DB (camelCase)
      // Upsert manually (some DBs don't have unique constraint on email)
      const found = await client.query('select id from users where email = $1 limit 1', [email.toLowerCase()]);
      if (found.rows.length) {
        const existingId = found.rows[0].id;
        await client.query('update users set "tenantId"=$1, "firstName"=$2, "lastName"=$3, password=$4, "isActive"=$5, "emailVerified"=$6, "updatedAt"=now() where id = $7', [tenantId, 'Akoma', 'Admin', passwordHash, true, true, existingId]);
        console.log('Updated existing user', existingId, 'for tenant', slug);
      } else {
        await client.query('insert into users (id, email, "firstName", "lastName", password, "tenantId", "organizationId", "isActive", "emailVerified", "createdAt", "updatedAt") values ($1,$2,$3,$4,$5,$6,$7,$8,$9, now(), now())', [userId, email.toLowerCase(), 'Akoma', 'Admin', passwordHash, tenantId, null, true, true]);
        console.log('Inserted user', userId, 'for tenant', slug);
      }

      // set branch admin
      await client.query('update branches set branch_admin_id = $1 where id = $2', [userId, branchId]);

      console.log(`Created admin ${email} for tenant ${slug} -> user ${userId}, branch ${branchId}`);
    }

    console.log('Tenant admin creation complete');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
