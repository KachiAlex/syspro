import { getSql } from '../src/lib/db';
import bcrypt from 'bcryptjs';

async function main() {
  const sql = getSql();

  // Find the employee
  const rows = await sql`
    SELECT id, name, email, tenant_slug, role, department_id, job_title,
           password_hash, is_portal_active, status, last_login
    FROM admin_employees
    WHERE email ILIKE '%onyedika%' OR email ILIKE '%akoma%'
  `;

  console.log('Found employees:', rows.length);
  for (const emp of rows) {
    console.log({
      id: emp.id,
      name: emp.name,
      email: emp.email,
      tenant_slug: emp.tenant_slug,
      role: emp.role,
      is_portal_active: emp.is_portal_active,
      status: emp.status,
      has_password_hash: !!emp.password_hash,
      hash_prefix: emp.password_hash?.substring(0, 25),
      last_login: emp.last_login,
    });
  }

  if (rows.length === 0) {
    console.log('\nNo employee found. Listing all employees for kreatixtech:');
    const all = await sql`
      SELECT id, name, email, is_portal_active, status, !!password_hash as has_pwd
      FROM admin_employees
      WHERE tenant_slug = 'kreatixtech'
      ORDER BY name
    `;
    all.forEach(e => console.log(`  ${e.email} | ${e.name} | active=${e.is_portal_active} | status=${e.status} | has_pwd=${e.has_pwd}`));
    process.exit(0);
  }

  // Test if password verification works
  const emp = rows[0] as any;
  if (emp.password_hash) {
    // Try some common passwords
    const testPasswords = ['test123', 'password', 'admin123', 'superadmin123', '123456', 'password123', 'Welcome123'];
    for (const pwd of testPasswords) {
      const match = await bcrypt.compare(pwd, emp.password_hash);
      if (match) {
        console.log(`\nPassword matches: "${pwd}"`);
        break;
      }
    }

    // Force reset to a known password
    const newPassword = 'employee123';
    const hashed = await bcrypt.hash(newPassword, 12);
    await sql`
      UPDATE admin_employees
      SET password_hash = ${hashed}, is_portal_active = true, updated_at = now()
      WHERE id = ${emp.id}
    `;
    console.log(`\nPassword has been reset to: "${newPassword}"`);
    console.log('Employee portal login:');
    console.log(`  Email: ${emp.email}`);
    console.log(`  Password: ${newPassword}`);
    console.log(`  Tenant: ${emp.tenant_slug}`);
  } else {
    // No password set — activate portal with a default password
    const newPassword = 'employee123';
    const hashed = await bcrypt.hash(newPassword, 12);
    await sql`
      UPDATE admin_employees
      SET password_hash = ${hashed}, is_portal_active = true, updated_at = now()
      WHERE id = ${emp.id}
    `;
    console.log(`\nPortal activated with password: "${newPassword}"`);
    console.log(`  Email: ${emp.email}`);
    console.log(`  Tenant: ${emp.tenant_slug}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
