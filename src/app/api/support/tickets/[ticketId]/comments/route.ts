import { NextRequest, NextResponse } from "next/server";

import { addTicketComment, listTicketComments } from "@/lib/support-data";

type RouteContext = {
  params: { ticketId: string };
};

export async function GET(request: NextRequest, context: any) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug") || "default";
  const comments = listTicketComments(tenantSlug, context.params.ticketId);
  return NextResponse.json({ comments });
}

export async function POST(request: NextRequest, context: any) {
  const body = (await request.json()) as {
    tenantSlug?: string;
    body: string;
    authorId?: string;
    commentType?: "internal" | "customer" | "system";
    visibility?: "internal" | "external";
  };

  if (!body.body) {
    return NextResponse.json({ error: "Comment body is required" }, { status: 400 });
  }

  const tenantSlug = body.tenantSlug || "default";
  const comment = addTicketComment({
    tenantSlug,
    ticketId: context.params.ticketId,
    body: body.body,
    authorId: body.authorId,
    commentType: body.commentType,
    visibility: body.visibility,
  });

  if (!comment) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  return NextResponse.json({ comment }, { status: 201 });
}
