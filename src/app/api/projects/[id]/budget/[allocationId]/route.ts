import { NextResponse } from 'next/server';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; allocationId: string } }
) {
  try {
    return NextResponse.json(
      { error: "Not implemented: budget allocation deletion requires database integration" },
      { status: 501 }
    );
  } catch (error) {
    console.error('Failed to delete budget allocation:', error);
    return NextResponse.json({ error: 'Failed to delete budget allocation' }, { status: 500 });
  }
}
