import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

const sql = getSql();

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { type, seats, expiry } = body;

    const result = await sql`
      UPDATE licenses
      SET type = COALESCE(${type}, type),
          seats = COALESCE(${seats}, seats),
          expiry = COALESCE(${expiry}, expiry),
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating license:', error);
    return NextResponse.json({ error: 'Failed to update license' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const result = await sql`DELETE FROM licenses WHERE id = ${id} RETURNING *`;

    if (result.length === 0) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'License deleted' }, { status: 204 });
  } catch (error) {
    console.error('Error deleting license:', error);
    return NextResponse.json({ error: 'Failed to delete license' }, { status: 500 });
  }
}