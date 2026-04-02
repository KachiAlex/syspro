import { NextResponse } from 'next/server';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; allocationId: string } }
) {
  try {
    // Mock data - replace with real database deletion
    return NextResponse.json({ success: true, id: params.allocationId });
  } catch (error) {
    console.error('Failed to delete budget allocation:', error);
    return NextResponse.json({ error: 'Failed to delete budget allocation' }, { status: 500 });
  }
}
