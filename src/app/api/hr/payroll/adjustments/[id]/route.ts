import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  updatePayrollAdjustmentStatus,
  deletePayrollAdjustment,
} from "@/lib/hr/db";

const patchSchema = z.object({
  status: z.enum(["applied", "rejected"]),
  approvedBy: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const tenantSlug = request.headers.get("x-tenant-slug");
    if (!tenantSlug) {
      return NextResponse.json({ error: "x-tenant-slug header required" }, { status: 400 });
    }

    await updatePayrollAdjustmentStatus(
      tenantSlug,
      params.id,
      parsed.data.status,
      parsed.data.approvedBy
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update adjustment:", error);
    return NextResponse.json(
      { error: "Failed to update adjustment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantSlug = request.headers.get("x-tenant-slug");
    if (!tenantSlug) {
      return NextResponse.json({ error: "x-tenant-slug header required" }, { status: 400 });
    }

    await deletePayrollAdjustment(tenantSlug, params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete adjustment:", error);
    return NextResponse.json(
      { error: "Failed to delete adjustment" },
      { status: 500 }
    );
  }
}
