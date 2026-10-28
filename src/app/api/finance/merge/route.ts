export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess, requireDocAccess } from "@/lib/api-auth";
import { gateOrRun } from "@/lib/finance/gated-actions";
import { sql as SQL } from "@/lib/sql-client";

const postSchema = z.object({
  docType: z.enum(["customer", "vendor"]),
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  let rows: any[] = [];
  try {
    rows = (await SQL`
      select * from document_merges where tenant_slug = ${context.tenantSlug}
      order by created_at desc limit 200
    `) as any[];
  } catch { /* table may not exist yet */ }
  return NextResponse.json({ merges: rows });
}

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const gate = await requireDocAccess(request, "customer", "edit", "finance", "write");
  if (!gate.ok) return gate.response;
  const parsed = postSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "docType, sourceId and targetId are required" }, { status: 400 });
  }
  const { docType, sourceId, targetId } = parsed.data;
  try {
    const gated = await gateOrRun(
      context.tenantSlug,
      docType === "customer" ? "customer_merge" : "vendor_merge",
      { sourceId, targetId },
      { requestedBy: context.userId ?? "unknown" }
    );
    if (gated.status === "pending") {
      return NextResponse.json({ approvalId: (gated as any).approvalId, pendingApproval: true }, { status: 202 });
    }
    if (gated.status === "denied") {
      return NextResponse.json({ error: (gated as any).error ?? "Denied" }, { status: 403 });
    }
    return NextResponse.json({ merged: (gated as any).result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
