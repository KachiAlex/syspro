import { getSql } from '@/lib/db';
import bcrypt from 'bcryptjs';

const sql = getSql();

async function createSuperadminAccount() {
  const email = 'onyedika.akoma@gmail.com';
  const password = 'dikaoliver2660';
  const name = 'Onyedika Akoma';

  try {
    console.log('Creating superadmin account...');

    // Check if superadmin already exists
    const existing = await sql`SELECT id FROM superadmins WHERE email = ${email}`;
    if (existing.length > 0) {
      console.log('Superadmin account already exists!');
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await sql`
      INSERT INTO superadmins (email, name, password_hash)
      VALUES (${email}, ${name}, ${hashedPassword})
      RETURNING id, email, name, created_at
    `;

    console.log('Superadmin account created successfully!');
    console.log('Account details:', result[0]);

  } catch (error) {
    console.error('Error creating superadmin account:', error);
  }
}

createSuperadminAccount();