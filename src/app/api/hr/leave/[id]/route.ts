import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateLeaveStatus } from "@/lib/hr/db";

const updateSchema = z.object({
  tenantSlug: z.string().min(1),
  status: z.enum(["pending", "approved", "rejected", "cancelled"]),
  approvedBy: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const leave = await updateLeaveStatus(id, parsed.data.tenantSlug, parsed.data.status, parsed.data.approvedBy ?? null);
    if (!leave) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }
    return NextResponse.json({ leave });
  } catch (error) {
    console.error("Leave update failed", error);
    return NextResponse.json({ error: "Failed to update leave status" }, { status: 500 });
  }
}
