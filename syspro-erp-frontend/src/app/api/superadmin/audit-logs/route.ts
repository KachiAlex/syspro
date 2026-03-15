import { NextRequest, NextResponse } from 'next/server';
import { getAuditLogs } from '@/lib/audit';
import { AuditLogsQuerySchema, safeParse } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '50',
      action: searchParams.get('action') || undefined,
      entitySlug: searchParams.get('entitySlug') || undefined,
    };

    // Validate query parameters
    const validation = safeParse(AuditLogsQuerySchema, queryParams);
    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Invalid query parameters', 
        details: validation.error.errors 
      }, { status: 400 });
    }

    const { page, limit } = validation.data;
    const offset = (page - 1) * limit;
    const logs = await getAuditLogs(limit, offset);

    return NextResponse.json(
      {
        items: logs,
        page,
        limit,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
