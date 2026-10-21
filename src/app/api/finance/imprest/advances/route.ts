export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { issueAdvance } from "@/lib/finance/imprest";
import { db } from "@/lib/sql-client";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const params: any[] = [context.tenantSlug];
  const cond = status ? `and status = $2` : "";
  if (status) params.push(status);
  try {
    const advances = (await db.query<any>(
      `select * from staff_advances where tenant_slug = $1 ${cond}
       order by issue_date desc, created_at desc`,
      params
    )).rows;
    return NextResponse.json({ advances });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const issueSchema = z.object({
  employeeName: z.string().min(1),
  employeeId: z.string().optional(),
  fundId: z.string().uuid().optional(),
  amount: z.coerce.number().positive(),
  purpose: z.string().optional(),
  issueDate: z.string().min(8),
});

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "finance", "write");
  if (!gate.ok) return gate.response;
  const body = await request.json().catch(() => null);
  const parsed = issueSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const out = await issueAdvance({ tenantSlug: context.tenantSlug, ...parsed.data });
    return NextResponse.json(out, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
