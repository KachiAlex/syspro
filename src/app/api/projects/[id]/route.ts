import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const context = validateTenantContext(request, "read");
  return NextResponse.json({ project: null });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  validateTenantContext(request, "delete");
  return NextResponse.json(
    { message: "Project deleted successfully" },
    { status: 200 }
  );
}
