import { NextRequest, NextResponse } from "next/server";
import { getDepartments, addDepartment } from "@/lib/persistent-storage";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug") || "default";

  const departments = await getDepartments();
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

  const newDepartment = {
    id: `dept-${Date.now()}`,
    name,
    manager,
    headcount: 0,
  };

  await addDepartment(tenantSlug, newDepartment);

  return NextResponse.json(
    { department: newDepartment, message: "Department created successfully" },
    { status: 201 }
  );
}
