export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Superadmin login API route is deployed and reachable.' });
}
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSql } from '@/lib/db';
import bcrypt from 'bcryptjs';

const sql = getSql();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Find superadmin by email
    const superadmins = await sql`SELECT * FROM superadmins WHERE email = ${email}`;
    if (superadmins.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const superadmin = superadmins[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, superadmin.password_hash);
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Set a secure cookie
    const cookieStore = await cookies();
    cookieStore.set('superadmin_auth', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return NextResponse.json({
      success: true,
      user: {
        id: superadmin.id,
        email: superadmin.email,
        name: superadmin.name
      }
    });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}