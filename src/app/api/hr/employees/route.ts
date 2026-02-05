import { NextRequest, NextResponse } from "next/server";
import { getEmployees, addEmployee } from "@/lib/persistent-storage";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug") || "default";

  const employees = await getEmployees();
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

  const newEmployee = {
    id: `emp-${Date.now()}`,
    name,
    email,
    department,
    position,
    status: "active" as const,
  };

  await addEmployee(tenantSlug, newEmployee);

  return NextResponse.json(
    { employee: newEmployee, message: "Employee added successfully" },
    { status: 201 }
  );
}
