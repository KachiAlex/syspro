import { NextRequest, NextResponse } from "next/server";

// In-memory storage for departments
const departments: Record<string, Array<{ id: string; name: string; manager: string; headcount: number }>> = {};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug") || "default";

  const tenantDepartments = departments[tenantSlug] || [];
  return NextResponse.json({ departments: tenantDepartments });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenantSlug = "default", name, manager } = body;

  if (!name || !manager) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (!departments[tenantSlug]) {
    departments[tenantSlug] = [];
  }

  const newDepartment = {
    id: `dept-${Date.now()}`,
    name,
    manager,
    headcount: 0,
  };

  departments[tenantSlug].push(newDepartment);

  return NextResponse.json(
    { department: newDepartment, message: "Department created successfully" },
    { status: 201 }
  );
}
