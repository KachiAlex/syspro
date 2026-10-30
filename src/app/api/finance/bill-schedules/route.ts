export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import { sql as SQL } from "@/lib/sql-client";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  const sql = SQL;
  let rows: any[] = [];
  try {
    rows = (await sql`
      select s.bill_id, b.bill_number, b.vendor_name, s.due_date::text,
             s.amount, s.paid_amount, s.status, s.installment_no
      from bill_payment_schedule s
      join bills b on b.id = s.bill_id and b.tenant_slug = s.tenant_slug
      where s.tenant_slug = ${context.tenantSlug}
      order by s.due_date asc limit 500
    `) as any[];
  } catch { /* schedule table may not exist */ }
  return NextResponse.json({ schedules: rows });
}
