export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  importStatementLines, listStatementLines, statementSummary,
  clearStatementLines, unclearStatementLines, clearanceSummary,
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
    if (url.searchParams.get("view") === "clearance") {
      const clearance = await clearanceSummary(
        context.tenantSlug, url.searchParams.get("bankAccountCode") ?? undefined);
      return NextResponse.json({ clearance });
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

const actionSchema = z.object({
  action: z.enum(["clear", "unclear"]),
  lineIds: z.array(z.string().min(1)).min(1),
  clearanceDate: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "finance", "write");
  if (!gate.ok) return gate.response;
  const body = await request.json().catch(() => null);
  if (body && typeof body === "object" && "action" in (body as any)) {
    const ap = actionSchema.safeParse(body);
    if (!ap.success)
      return NextResponse.json({ error: ap.error.flatten() }, { status: 400 });
    try {
      const fn = ap.data.action === "clear" ? clearStatementLines : unclearStatementLines;
      const out = await fn({ tenantSlug: context.tenantSlug, lineIds: ap.data.lineIds, clearanceDate: ap.data.clearanceDate });
      return NextResponse.json(out);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }
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
