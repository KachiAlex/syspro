import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import bcrypt from 'bcryptjs';

const sql = getSql();

export async function POST(request: NextRequest) {
  try {
    // Only allow this in development or with a special header
    if (process.env.NODE_ENV === 'production' && !request.headers.get('x-setup-superadmin')) {
      return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
    }

    const email = 'onyedika.akoma@gmail.com';
    const password = 'dikaoliver2660';
    const name = 'Onyedika Akoma';

    console.log('Creating superadmin account...');

    // Check if superadmin already exists
    const existing = await sql`SELECT id FROM superadmins WHERE email = ${email}`;
    if (existing.length > 0) {
      return NextResponse.json({ message: 'Superadmin account already exists', account: existing[0] });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await sql`
      INSERT INTO superadmins (email, name, password_hash)
      VALUES (${email}, ${name}, ${hashedPassword})
      RETURNING id, email, name, created_at
    `;

    console.log('Superadmin account created successfully!');
    return NextResponse.json({
      message: 'Superadmin account created successfully',
      account: result[0]
    });

  } catch (error) {
    console.error('Error creating superadmin account:', error);
    return NextResponse.json({ error: 'Failed to create superadmin account' }, { status: 500 });
  }
}