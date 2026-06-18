import { NextRequest, NextResponse } from "next/server";

import { addFieldJob, listFieldJobs } from "@/lib/support-db";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

type RouteContext = {
  params: { ticketId: string };
};

export async function GET(request: NextRequest, context: any) {
  const ctx = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  const tenantSlug = ctx.tenantSlug;
  const fieldJobs = await listFieldJobs(tenantSlug, context.params.ticketId);
  return NextResponse.json({ fieldJobs });
}

export async function POST(request: NextRequest, context: any) {
  const ctx = validateTenantContext(request, "write");
  const body = (await request.json()) as {
    tenantSlug?: string;
    engineerId?: string;
    scheduledAt?: string;
    location?: Record<string, unknown>;
    createdBy?: string;
  };

  const tenantSlug = ctx.tenantSlug;
  const job = await addFieldJob({
    tenantSlug,
    ticketId: context.params.ticketId,
    engineerId: body.engineerId,
    scheduledAt: body.scheduledAt,
    location: body.location,
    createdBy: body.createdBy,
  });

  if (!job) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  return NextResponse.json({ fieldJob: job }, { status: 201 });
}
