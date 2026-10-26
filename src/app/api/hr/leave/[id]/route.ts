export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateLeaveStatus } from "@/lib/hr/db";
import { requireModuleAccess } from "@/lib/api-auth";

const updateSchema = z.object({
  tenantSlug: z.string().min(1),
  status: z.enum(["pending", "approved", "rejected", "cancelled"]),
  approvedBy: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const _scope = await requireModuleAccess(request, "people", "write");
    if (!_scope.ok) return _scope.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    // Requests inside an approval workflow are decided by the chain, not here.
    if (["approved", "rejected"].includes(parsed.data.status)) {
      const { sql } = await import("@/lib/sql-client");
      const [row] = (await sql`
        select approval_id from admin_leave
        where id = ${id} and tenant_slug = ${parsed.data.tenantSlug} limit 1
      `) as any[];
      if (row?.approval_id) {
        const [ap] = (await sql`
          select status from approvals where id = ${row.approval_id} limit 1
        `) as any[];
        if (ap?.status === "pending") {
          return NextResponse.json(
            { error: "This leave request is in the approval workflow — decide it from the approvals inbox" },
            { status: 409 }
          );
        }
      }
    }
    const leave = await updateLeaveStatus(id, parsed.data.tenantSlug, parsed.data.status, _scope.user.id);
    if (!leave) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }
    return NextResponse.json({ leave });
  } catch (error) {
    console.error("Leave update failed", error);
    return NextResponse.json({ error: "Failed to update leave status" }, { status: 500 });
  }
}
