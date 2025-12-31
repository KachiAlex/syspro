import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    // Simple health check
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Syspro ERP API is running',
      version: '1.0.0'
    });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Health check failed',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}