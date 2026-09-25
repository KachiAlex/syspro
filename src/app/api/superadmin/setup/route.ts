import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import bcrypt from 'bcryptjs';

const sql = getSql();

/**
 * One-time bootstrap: creates the first superadmin account.
 * Requires the SUPERADMIN_SETUP_SECRET env var to be set and supplied via the
 * x-setup-secret header. Credentials come from the request body — never
 * hardcoded. Returns 403 when no setup secret is configured.
 */
export async function POST(request: NextRequest) {
  try {
    const setupSecret = process.env.SUPERADMIN_SETUP_SECRET;
    if (!setupSecret || request.headers.get('x-setup-secret') !== setupSecret) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { email, password, name } = body as { email?: string; password?: string; name?: string };

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'email, password, and name are required' },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await sql`SELECT id FROM superadmins WHERE email = ${normalizedEmail}`;
    if (existing.length > 0) {
      return NextResponse.json({ message: 'Superadmin account already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await sql`
      INSERT INTO superadmins (email, name, password_hash)
      VALUES (${normalizedEmail}, ${name}, ${hashedPassword})
      RETURNING id, email, name, created_at
    `;

    return NextResponse.json({
      message: 'Superadmin account created successfully',
      account: result[0]
    });
  } catch (error) {
    console.error('Error creating superadmin account:', error);
    return NextResponse.json({ error: 'Failed to create superadmin account' }, { status: 500 });
  }
}
