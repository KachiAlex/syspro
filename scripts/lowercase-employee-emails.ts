import { getSql } from '../src/lib/db';

async function main() {
  const sql = getSql();

  // Lowercase all employee emails
  const result = await sql`
    UPDATE admin_employees
    SET email = LOWER(email)
    WHERE email != LOWER(email)
    RETURNING id, email
  `;

  console.log(`Lowercased ${result.length} employee email(s):`);
  result.forEach((r: any) => console.log(`  ${r.id}: ${r.email}`));

  if (result.length === 0) {
    console.log('All employee emails were already lowercase.');
  }

  // Verify the specific employee
  const emp = await sql`
    SELECT id, name, email, is_portal_active, !!password_hash as has_pwd
    FROM admin_employees
    WHERE email = 'onyedika.akoma@gmail.com'
  `;
  console.log('\nEmployee onyedika.akoma@gmail.com:', emp[0] || 'NOT FOUND');

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
