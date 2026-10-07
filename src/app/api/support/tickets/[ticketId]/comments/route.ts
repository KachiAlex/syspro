export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { addTicketComment, listTicketComments } from "@/lib/support-db";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";

type RouteContext = {
  params: { ticketId: string };
};

export async function GET(request: NextRequest, context: any) {
  const ctx = validateTenantContext(request, "read");
  const _gate1 = await requireModuleGate(request, "itsupport", "read");
  if (_gate1) return _gate1;
  const { searchParams } = new URL(request.url);
  const tenantSlug = ctx.tenantSlug;
  const comments = await listTicketComments(tenantSlug, context.params.ticketId);
  return NextResponse.json({ comments });
}

export async function POST(request: NextRequest, context: any) {
  const ctx = validateTenantContext(request, "write");
  const _gate2 = await requireModuleGate(request, "itsupport", "write");
  if (_gate2) return _gate2;
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

  const tenantSlug = ctx.tenantSlug;
  const comment = await addTicketComment({
    tenantSlug,
    ticketId: context.params.ticketId,
    body: body.body,
    authorId: ctx.userId !== "unknown" ? ctx.userId : body.authorId,
    commentType: body.commentType,
    visibility: body.visibility,
  });

  if (!comment) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  return NextResponse.json({ comment }, { status: 201 });
}
