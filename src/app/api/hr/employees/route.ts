import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  return NextResponse.json({ employees: [] });
}

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const { name, email, department, position } = body;

  if (!name || !email || !department || !position) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const newEmployee = {
    id: `emp-${Date.now()}`,
    name,
    email,
    department,
    position,
    status: "active" as const,
  };

  return NextResponse.json(
    { employee: newEmployee, message: "Employee added successfully" },
    { status: 201 }
  );
}
