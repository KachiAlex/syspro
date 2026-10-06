export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/sql-client";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

function mapJob(row: any) {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    engineerId: row.engineer_id,
    engineerName: row.engineer_name,
    title: row.title,
    siteAddress: row.site_address,
    assignedAt: row.assigned_at,
    startedAt: row.started_at,
    arrivedAt: row.arrived_at,
    completedAt: row.completed_at,
    workLog: row.work_log,
    images: row.images || [],
    customerSignoff: row.customer_signoff,
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = validateTenantContext(request, "write");
  const { id } = await params;
  const body = await request.json();

  const setClauses: string[] = [];
  const values: any[] = [];
  let i = 1;
  const set = (col: string, v: any) => { setClauses.push(`${col} = $${i++}`); values.push(v); };

  if (body.workLog !== undefined) set("work_log", body.workLog);
  if (body.customerSignoff !== undefined) set("customer_signoff", !!body.customerSignoff);
  if (body.startedAt !== undefined) set("started_at", body.startedAt);
  if (body.arrivedAt !== undefined) set("arrived_at", body.arrivedAt);
  if (body.completedAt !== undefined) set("completed_at", body.completedAt);
  if (body.siteAddress !== undefined) set("site_address", body.siteAddress);

  // Image upload: { image: "data:<mime>;base64,..." } appends to images[]
  if (body.image !== undefined) {
    const img = String(body.image);
    if (!img.startsWith("data:image/") || img.length > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "image must be a data:image/* URL under 5MB" },
        { status: 400 }
      );
    }
    setClauses.push(`images = coalesce(images, '[]'::jsonb) || $${i++}::jsonb`);
    values.push(JSON.stringify(img));
  }

  if (!setClauses.length) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  setClauses.push(`updated_at = now()`);
  values.push(id, context.tenantSlug);

  const res = await db.query(
    `update it_field_jobs set ${setClauses.join(", ")} where id = $${i++} and tenant_slug = $${i++} returning *`,
    values
  );
  const row = res.rows[0] as any;
  if (!row) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json({ data: mapJob(row) });
}
