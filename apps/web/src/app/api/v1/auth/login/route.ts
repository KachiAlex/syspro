import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function POST(request: NextRequest) {
  try {
    const { email, password, tenantId } = await request.json();

    if (!email || !password || !tenantId) {
      return NextResponse.json(
        { message: 'Email, password, and tenant ID are required' },
        { status: 400 }
      );
    }

    // Get user from database
    const userQuery = `
      SELECT 
        u.id,
        u.email,
        u."firstName",
        u."lastName",
        u.password,
        u.status,
        u."isActive",
        u."tenantId",
        t.name as "tenantName",
        t.code as "tenantCode"
      FROM users u
      JOIN tenants t ON u."tenantId" = t.id
      WHERE u.email = $1 AND u."tenantId" = $2 AND u."isActive" = true
    `;

    const userResult = await pool.query(userQuery, [email, tenantId]);

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const user = userResult.rows[0];

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (user.status !== 'active') {
      return NextResponse.json(
        { message: 'Account is not active' },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        tenantId: user.tenantId,
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    // Update last login
    await pool.query(
      'UPDATE users SET "lastLoginAt" = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tenantId: user.tenantId,
        tenantName: user.tenantName,
        tenantCode: user.tenantCode,
      },
      token,
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}