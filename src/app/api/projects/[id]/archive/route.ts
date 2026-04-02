import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { tenantSlug } = body;

    // Mock archive operation - replace with real database update
    console.log(`Archiving project: ${params.id}`);

    return NextResponse.json({ 
      success: true, 
      id: params.id,
      message: 'Project archived successfully'
    });
  } catch (error) {
    console.error('Failed to archive project:', error);
    return NextResponse.json({ error: 'Failed to archive project' }, { status: 500 });
  }
}
