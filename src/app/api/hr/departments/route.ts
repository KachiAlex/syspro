import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  return NextResponse.json({ departments: [] });
}

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const { name, manager } = body;

  if (!name || !manager) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const newDepartment = {
    id: `dept-${Date.now()}`,
    name,
    manager,
    headcount: 0,
  };

  return NextResponse.json(
    { department: newDepartment, message: "Department created successfully" },
    { status: 201 }
  );
}
