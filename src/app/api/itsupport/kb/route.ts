import { NextResponse } from 'next/server';
import type { KnowledgeBaseArticle } from '../../../../lib/itsupport/types';

export const kbArticles = new Map<string, KnowledgeBaseArticle>();

export async function GET() {
  // List all KB articles (stub)
  return NextResponse.json({ data: Array.from(kbArticles.values()) });
}

export async function POST(request: Request) {
  // Create a new KB article (stub)
  const body = await request.json();
  const id = `local-${Math.random().toString(36).slice(2, 10)}`;
  const now = new Date().toISOString();
  const article: KnowledgeBaseArticle = {
    id,
    tenantId: body.tenantId,
    type: body.type,
    title: body.title,
    body: body.body,
    tags: body.tags || [],
    createdBy: body.createdBy,
    createdAt: now,
    relatedTicketIds: body.relatedTicketIds || [],
  };
  kbArticles.set(id, article);
  return NextResponse.json({ data: article }, { status: 201 });
}
