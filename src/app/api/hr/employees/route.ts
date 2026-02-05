import { NextRequest, NextResponse } from "next/server";

// In-memory storage for employees
const employees: Record<string, Array<{ id: string; name: string; email: string; department: string; position: string; status: "active" | "inactive" }>> = {};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug") || "default";

  const tenantEmployees = employees[tenantSlug] || [];
  return NextResponse.json({ employees: tenantEmployees });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenantSlug = "default", name, email, department, position } = body;

  if (!name || !email || !department || !position) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (!employees[tenantSlug]) {
    employees[tenantSlug] = [];
  }

  const newEmployee = {
    id: `emp-${Date.now()}`,
    name,
    email,
    department,
    position,
    status: "active" as const,
  };

  employees[tenantSlug].push(newEmployee);

  return NextResponse.json(
    { employee: newEmployee, message: "Employee added successfully" },
    { status: 201 }
  );
}
