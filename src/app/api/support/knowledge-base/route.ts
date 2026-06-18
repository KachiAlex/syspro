import { NextRequest, NextResponse } from "next/server";

import { createKnowledgeBaseArticle, listKnowledgeBaseArticles } from "@/lib/support-db";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  const tenantSlug = context.tenantSlug;
  const articles = await listKnowledgeBaseArticles(tenantSlug);
  return NextResponse.json({ articles });
}

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
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

  const tenantSlug = context.tenantSlug;
  const article = await createKnowledgeBaseArticle({
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
