import { NextResponse } from 'next/server';
import { fieldJobs } from '../route';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const job = fieldJobs.get(params.id);
  if (!job) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ data: job });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const job = fieldJobs.get(params.id);
  if (!job) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const body = await request.json();
  Object.assign(job, body);
  fieldJobs.set(params.id, job);
  return NextResponse.json({ data: job });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!fieldJobs.has(params.id)) return NextResponse.json({ error: 'not found' }, { status: 404 });
  fieldJobs.delete(params.id);
  return NextResponse.json({ ok: true });
}
