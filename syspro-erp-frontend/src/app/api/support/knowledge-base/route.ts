import { NextRequest, NextResponse } from "next/server";

import { createKnowledgeBaseArticle, listKnowledgeBaseArticles } from "@/lib/support-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug") || "default";
  const articles = listKnowledgeBaseArticles(tenantSlug);
  return NextResponse.json({ articles });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    tenantSlug?: string;
    title?: string;
    content?: string;
    audience?: "internal" | "customer" | "field";
    category?: string;
    summary?: string;
    tags?: string[];
    relatedTicketIds?: string[];
    solutionSteps?: Record<string, unknown>;
    attachments?: Record<string, unknown>;
    createdBy?: string;
  };

  if (!body.title || !body.content) {
    return NextResponse.json({ error: "title and content are required" }, { status: 400 });
  }

  const tenantSlug = body.tenantSlug || "default";
  const article = createKnowledgeBaseArticle({
    tenantSlug,
    title: body.title,
    content: body.content,
    audience: body.audience,
    category: body.category,
    summary: body.summary,
    tags: body.tags,
    relatedTicketIds: body.relatedTicketIds,
    solutionSteps: body.solutionSteps,
    attachments: body.attachments,
    createdBy: body.createdBy,
  });

  return NextResponse.json({ article }, { status: 201 });
}
