import { getSql } from '../src/lib/db';
import bcrypt from 'bcryptjs';

async function main() {
  const sql = getSql();

  const emp = await sql`
    SELECT id, name, email, is_portal_active, password_hash
    FROM admin_employees
    WHERE email = 'onyedika.akoma@gmail.com'
  `;

  if (emp.length === 0) {
    console.log('Employee NOT FOUND');
  } else {
    const e = emp[0] as any;
    console.log('Employee:', { id: e.id, name: e.name, email: e.email, is_portal_active: e.is_portal_active, has_pwd: !!e.password_hash });

    // Verify the password we set earlier
    const match = await bcrypt.compare('employee123', e.password_hash);
    console.log('Password "employee123" matches:', match);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
