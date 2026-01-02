import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Basic validation
    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: 'Email and password are required',
          errors: [
            {
              field: !email ? 'email' : 'password',
              message: `${!email ? 'Email' : 'Password'} is required`,
              code: 'REQUIRED_FIELD_MISSING'
            }
          ]
        },
        { status: 400 }
      );
    }

    // For now, return a mock response
    // Later this will connect to the actual authentication service
    if (email === 'demo@syspro.com' && password === 'demo123') {
      return NextResponse.json({
        success: true,
        data: {
          accessToken: 'mock-jwt-token',
          refreshToken: 'mock-refresh-token',
          expiresIn: 86400,
          user: {
            id: '1',
            email: 'demo@syspro.com',
            firstName: 'Demo',
            lastName: 'User',
            tenantId: 'demo-tenant',
            roles: ['user'],
            permissions: ['read']
          }
        },
        message: 'Login successful'
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid credentials',
          errors: [
            {
              field: 'credentials',
              message: 'Invalid email or password',
              code: 'INVALID_CREDENTIALS'
            }
          ]
        },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Login failed:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Login failed',
        errors: [
          {
            field: 'system',
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'INTERNAL_SERVER_ERROR'
          }
        ]
      },
      { status: 500 }
    );
  }
}