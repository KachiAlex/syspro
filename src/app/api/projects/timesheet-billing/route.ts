export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  billableTimeSummary,
  generateTimesheetInvoice,
  setProjectBilling,
} from "@/lib/finance/timesheet-billing";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const gate = await requireModuleAccess(request, "projects", "read");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  const summary = await billableTimeSummary(context.tenantSlug, {
    projectId: searchParams.get("projectId") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });
  return NextResponse.json({ projects: summary });
}

const invoiceSchema = z.object({
  action: z.literal("invoice"),
  projectId: z.string().uuid(),
  rate: z.coerce.number().positive().optional(),
  customerName: z.string().optional(),
  customerCode: z.string().optional(),
  issuedDate: z.string().optional(),
  dueDate: z.string().optional(),
  currency: z.string().optional(),
});

const billingSchema = z.object({
  action: z.literal("setBilling"),
  projectId: z.string().uuid(),
  customerName: z.string().optional(),
  customerId: z.string().optional(),
  billingRate: z.coerce.number().positive().optional(),
});

export async function POST(request: NextRequest) {
  const gate = await requireModuleAccess(request, "projects", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const body = await request.json();

  if (body?.action === "setBilling") {
    const parsed = billingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
    }
    await setProjectBilling(context.tenantSlug, parsed.data.projectId, parsed.data);
    return NextResponse.json({ ok: true });
  }

  const parsed = invoiceSchema.safeParse({ ...body, action: "invoice" });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await generateTimesheetInvoice(context.tenantSlug, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    const status = /not found|No billing rate|No customer|No uninvoiced/.test(err.message) ? 422 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
