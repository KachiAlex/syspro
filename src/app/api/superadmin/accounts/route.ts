export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { requireSuperAdmin } from "@/lib/api-auth";
import { getPagination } from "@/lib/pagination";

const sql = getSql();

export async function GET(request: NextRequest) {
    const _auth = await requireSuperAdmin(request);
    if (!_auth.ok) return _auth.response;

  try {
    const { limit, offset } = getPagination(request);
    const superadmins = await sql`SELECT id, email, name, created_at FROM superadmins ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    return NextResponse.json(superadmins);
  } catch (error) {
    console.error('Error fetching superadmins:', error);
    return NextResponse.json({ error: 'Failed to fetch superadmins' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
    const _auth = await requireSuperAdmin(request);
    if (!_auth.ok) return _auth.response;

  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Missing required fields: email, password, name' }, { status: 400 });
    }

    // Check if superadmin already exists
    const existing = await sql`SELECT id FROM superadmins WHERE email = ${email}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Superadmin with this email already exists' }, { status: 409 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await sql`
      INSERT INTO superadmins (email, name, password_hash)
      VALUES (${email}, ${name}, ${hashedPassword})
      RETURNING id, email, name, created_at
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating superadmin:', error);
    return NextResponse.json({ error: 'Failed to create superadmin' }, { status: 500 });
  }
}