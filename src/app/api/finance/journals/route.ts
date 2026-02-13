import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createJournalEntry, postJournalEntry } from '@/lib/finance/service';

export async function GET() {
  return NextResponse.json({ journals: [] });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const created = createJournalEntry(body);
    return NextResponse.json({ journal: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const posted = postJournalEntry(body);
    return NextResponse.json({ journal: posted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 400 });
  }
}
