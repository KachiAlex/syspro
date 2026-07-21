import { getSql } from '../src/lib/db';
import bcrypt from 'bcryptjs';

async function main() {
  const sql = getSql();

  // Check the tenant_admins row for this email
  const rows = await sql`
    SELECT ta.id, ta.email, ta.name, ta.role, ta.password_hash, ta.tenant_id, t.slug as tenant_slug
    FROM tenant_admins ta
    JOIN tenants t ON t.id = ta.tenant_id
    WHERE ta.email = 'onyedika.akoma@gmail.com' OR ta.email = 'Onyedika.Akoma@gmail.com'
  `;

  console.log('Found rows:', rows.length);
  for (const r of rows) {
    console.log({
      id: r.id,
      email: r.email,
      name: r.name,
      role: r.role,
      tenant_slug: r.tenant_slug,
      has_password_hash: !!r.password_hash,
      hash_prefix: r.password_hash?.substring(0, 20),
    });
  }

  // Try verifying a test password against the hash
  if (rows.length > 0 && rows[0].password_hash) {
    const testMatch = await bcrypt.compare('test123', rows[0].password_hash);
    console.log('Test "test123" matches:', testMatch);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
