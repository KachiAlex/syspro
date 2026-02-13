import { NextResponse } from 'next/server';
import { kbArticles } from '../route';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const article = kbArticles.get(params.id);
  if (!article) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ data: article });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const article = kbArticles.get(params.id);
  if (!article) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const body = await request.json();
  Object.assign(article, body);
  kbArticles.set(params.id, article);
  return NextResponse.json({ data: article });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!kbArticles.has(params.id)) return NextResponse.json({ error: 'not found' }, { status: 404 });
  kbArticles.delete(params.id);
  return NextResponse.json({ ok: true });
}
