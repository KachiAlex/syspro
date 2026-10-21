export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  createRecurringTemplate,
  generateDueInvoices,
  listRecurringTemplates,
  setRecurringStatus,
} from "@/lib/finance/recurring";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

const createSchema = z.object({
  customerName: z.string().min(1),
  customerCode: z.string().optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  template: z.object({
    lineItems: z.array(z.object({
      description: z.string().min(1),
      quantity: z.coerce.number().positive(),
      unitPrice: z.coerce.number().min(0),
      taxRate: z.coerce.number().min(0).optional(),
      accountCode: z.string().optional(),
    })).min(1),
    currency: z.string().optional(),
    paymentTerms: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export async function GET(request: NextRequest) {
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  const templates = await listRecurringTemplates(context.tenantSlug, {
    status: searchParams.get("status") ?? undefined,
  });
  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
  const gate = await requireModuleAccess(request, "finance", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const body = await request.json();

  // Action endpoint: POST { action: "generate", asOfDate? } creates due invoices.
  if (body?.action === "generate") {
    const result = await generateDueInvoices(context.tenantSlug, body.asOfDate);
    return NextResponse.json(result);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const template = await createRecurringTemplate(context.tenantSlug, parsed.data);
    return NextResponse.json({ template }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 422 });
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requireModuleAccess(request, "finance", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const { id, status } = body ?? {};
  if (!id || !["active", "paused", "completed"].includes(status)) {
    return NextResponse.json({ error: "id and status (active|paused|completed) are required" }, { status: 400 });
  }
  await setRecurringStatus(context.tenantSlug, id, status);
  return NextResponse.json({ ok: true });
}
