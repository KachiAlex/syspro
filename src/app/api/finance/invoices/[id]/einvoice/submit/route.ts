export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { submitEInvoice, getEInvoiceStatus } from "@/lib/finance/einvoice-submission";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "read");
  const { id } = await params;
  const status = await getEInvoiceStatus(context.tenantSlug, id);
  if (!status) {
    return NextResponse.json({ status: "not_submitted" });
  }
  return NextResponse.json({ submission: status });
}

export async function POST(request: NextRequest, { params }: Params) {
  const gate = await requireModuleAccess(request, "finance", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const submission = await submitEInvoice(context.tenantSlug, id, {
      provider: body.provider,
      submittedBy: body.submittedBy,
      resubmit: body.resubmit === true,
    });
    return NextResponse.json({ submission }, { status: 201 });
  } catch (err: any) {
    const status = /not found/i.test(err.message) ? 404 : 422;
    return NextResponse.json({ error: err.message }, { status });
  }
}
