import { NextRequest, NextResponse } from "next/server";
import { decodeEmployeeToken } from "@/lib/hr/auth";
import { getEmployeeById } from "@/lib/hr/db";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("employee_session")?.value;

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const session = decodeEmployeeToken(token);
  if (!session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  try {
    const employee = await getEmployeeById(session.id, session.tenantSlug);
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    return NextResponse.json({
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        jobTitle: employee.jobTitle,
        role: employee.role,
        departmentId: employee.departmentId,
        employmentType: employee.employmentType,
        status: employee.status,
        hireDate: employee.hireDate,
        salary: employee.salary,
        lastLogin: employee.lastLogin,
      },
    });
  } catch (error) {
    console.error("Employee /me error:", error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}
