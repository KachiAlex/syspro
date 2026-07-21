import { getSql } from '../src/lib/db';
import bcrypt from 'bcryptjs';

async function main() {
  const sql = getSql();

  const rows = await sql`
    SELECT id, email, name, role, password_hash
    FROM tenant_admins
    WHERE email = 'akoma@kreatixtech.com'
  `;

  if (rows.length === 0) {
    console.log('Admin not found!');
    process.exit(1);
  }

  const admin = rows[0] as any;
  console.log('Admin:', { id: admin.id, email: admin.email, name: admin.name, role: admin.role });
  console.log('Has password_hash:', !!admin.password_hash);
  console.log('Hash prefix:', admin.password_hash?.substring(0, 25));

  // Test common passwords
  const testPasswords = ['test123', 'password', 'admin123', 'superadmin123', '123456', 'password123'];
  for (const pwd of testPasswords) {
    const match = await bcrypt.compare(pwd, admin.password_hash);
    if (match) {
      console.log(`Password matches: "${pwd}"`);
      break;
    }
  }

  // Force reset to a known password
  const newPassword = 'admin123';
  const hashed = await bcrypt.hash(newPassword, 10);
  await sql`UPDATE tenant_admins SET password_hash = ${hashed} WHERE id = ${admin.id}`;
  console.log(`\nPassword has been reset to: "${newPassword}"`);
  console.log('You can now log in at /access with:');
  console.log(`  Email: ${admin.email}`);
  console.log(`  Password: ${newPassword}`);

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
