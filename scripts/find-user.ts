import { getSql } from '../src/lib/db';

async function main() {
  const sql = getSql();

  // Check tenant_admins with LIKE (case-insensitive)
  console.log('=== tenant_admins (case-insensitive) ===');
  const admins = await sql`
    SELECT ta.id, ta.email, ta.name, ta.role, ta.tenant_id, t.slug as tenant_slug
    FROM tenant_admins ta
    JOIN tenants t ON t.id = ta.tenant_id
    WHERE ta.email ILIKE '%onyedika%' OR ta.email ILIKE '%akoma%'
  `;
  admins.forEach((r: any) => console.log(r));

  // Check users table
  console.log('\n=== users table ===');
  try {
    const users = await sql`
      SELECT id, email, name, tenant_slug FROM users
      WHERE email ILIKE '%onyedika%' OR email ILIKE '%akoma%'
    `;
    users.forEach((r: any) => console.log(r));
  } catch (e) {
    console.log('users table error:', (e as any).message);
  }

  // Check employees table
  console.log('\n=== employees table ===');
  try {
    const emps = await sql`
      SELECT id, email, first_name, last_name, tenant_slug FROM employees
      WHERE email ILIKE '%onyedika%' OR email ILIKE '%akoma%'
    `;
    emps.forEach((r: any) => console.log(r));
  } catch (e) {
    console.log('employees table error:', (e as any).message);
  }

  // List all tenant_admins
  console.log('\n=== all tenant_admins ===');
  const allAdmins = await sql`
    SELECT ta.id, ta.email, ta.name, ta.role, t.slug as tenant_slug, t.name as tenant_name
    FROM tenant_admins ta
    JOIN tenants t ON t.id = ta.tenant_id
    ORDER BY ta.created_at DESC
  `;
  allAdmins.forEach((r: any) => console.log(r));

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
