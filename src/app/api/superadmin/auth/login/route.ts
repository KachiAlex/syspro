import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSql } from '@/lib/db';
import { signSession } from '@/lib/session';
import bcrypt from 'bcryptjs';
import { checkRateLimitAsync, getRateLimitKey } from '@/lib/rate-limit';

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Superadmin login API route is deployed and reachable.' });
}

export async function POST(request: NextRequest) {
  // Rate limit: 5 login attempts per minute per IP
  const rateKey = `admin-login:${getRateLimitKey(request)}`;
  const { allowed, retryAfter } = await checkRateLimitAsync(rateKey, 5, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many login attempts. Try again in ${retryAfter}s.` },
      { status: 429, headers: { 'Retry-After': retryAfter.toString() } }
    );
  }

  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const sql = getSql();
    const lowerEmail = String(email).toLowerCase();

    // Find superadmin by email (case-insensitive)
    const superadmins = await sql`SELECT * FROM superadmins WHERE lower(email) = lower(${lowerEmail})`;
    if (!Array.isArray(superadmins) || superadmins.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const superadmin = superadmins[0];

    // Verify password — guard against missing/null password_hash
    if (!superadmin.password_hash) {
      return NextResponse.json(
        { error: 'Password not set for this account. Please contact the system administrator.' },
        { status: 403 }
      );
    }
    const isValidPassword = await bcrypt.compare(password, superadmin.password_hash);
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Set a secure signed-token cookie (not just 'true')
    const now = Date.now();
    const maxAge = 60 * 60 * 24; // 24 hours
    const token = signSession({
      id: String(superadmin.id),
      email: superadmin.email,
      name: superadmin.name,
      roleId: 'superadmin',
      iat: now,
      exp: now + maxAge * 1000,
    });

    const cookieStore = await cookies();
    cookieStore.set('superadmin_auth', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge,
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
