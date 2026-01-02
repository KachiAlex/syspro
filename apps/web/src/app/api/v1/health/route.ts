import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Health check endpoint that matches the backend API structure
    return NextResponse.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        }
      },
      message: 'Service is healthy'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Health check failed',
        errors: [{
          field: 'system',
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'HEALTH_CHECK_FAILED'
        }]
      },
      { status: 500 }
    );
  }
}