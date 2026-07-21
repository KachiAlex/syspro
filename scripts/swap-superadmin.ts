import { getSql } from '../src/lib/db';
import bcrypt from 'bcryptjs';

async function main() {
  const sql = getSql();

  // 1. Create new superadmin
  const email = 'superadmin@sysproerp.com';
  const password = 'superadmin123';
  const name = 'System Superadmin';

  const existing = await sql`SELECT id FROM superadmins WHERE email = ${email}`;
  if (existing.length > 0) {
    console.log(`Superadmin ${email} already exists, updating password...`);
    const hashed = await bcrypt.hash(password, 12);
    await sql`UPDATE superadmins SET password_hash = ${hashed}, name = ${name} WHERE email = ${email}`;
    console.log('Password updated.');
  } else {
    const hashed = await bcrypt.hash(password, 12);
    const result = await sql`
      INSERT INTO superadmins (email, name, password_hash)
      VALUES (${email}, ${name}, ${hashed})
      RETURNING id, email, name
    `;
    console.log('Created new superadmin:', result[0]);
  }

  // 2. Remove old superadmin
  const oldEmail = 'onyedika.akoma@gmail.com';
  const deleted = await sql`DELETE FROM superadmins WHERE email = ${oldEmail} RETURNING id, email`;
  if (deleted.length > 0) {
    console.log('Removed old superadmin:', deleted[0]);
  } else {
    console.log(`No superadmin found with email ${oldEmail}`);
  }

  // 3. List remaining superadmins
  const remaining = await sql`SELECT id, email, name FROM superadmins ORDER BY created_at`;
  console.log('\nRemaining superadmins:');
  remaining.forEach((s: any) => console.log(`  - ${s.email} (${s.name})`));

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
