export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  importStatementLines, listStatementLines, statementSummary,
} from "@/lib/finance/bank-statement";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  try {
    if (url.searchParams.get("summary") === "true") {
      const summary = await statementSummary(
        context.tenantSlug, url.searchParams.get("bankAccountCode") ?? undefined);
      return NextResponse.json({ summary });
    }
    const lines = await listStatementLines({
      tenantSlug: context.tenantSlug,
      bankAccountCode: url.searchParams.get("bankAccountCode") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      startDate: url.searchParams.get("startDate") ?? undefined,
      endDate: url.searchParams.get("endDate") ?? undefined,
    });
    return NextResponse.json({ lines });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const schema = z.object({
  bankAccountCode: z.string().min(1),
  lines: z.array(z.object({
    date: z.string().min(8),
    description: z.string().optional(),
    reference: z.string().optional(),
    amount: z.coerce.number(),
  })).min(1),
});

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "finance", "write");
  if (!gate.ok) return gate.response;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const out = await importStatementLines({ tenantSlug: context.tenantSlug, ...parsed.data });
    return NextResponse.json(out, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
