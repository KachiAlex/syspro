import { NextRequest, NextResponse } from "next/server";
import { bulkActivateEmployees } from "@/lib/hr/auth";

export async function GET() {
  return NextResponse.json({ status: "ok", message: "Employee activation API is available." });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantSlug, employeeIds, defaultPassword } = body;

    if (!tenantSlug) {
      return NextResponse.json(
        { error: "tenantSlug is required" },
        { status: 400 }
      );
    }

    // If specific employee IDs are provided, activate only those
    if (Array.isArray(employeeIds) && employeeIds.length > 0) {
      const { setEmployeePassword, generatePassword } = await import("@/lib/hr/auth");
      const results: Array<{ id: string; name: string; email: string; password: string }> = [];

      for (const id of employeeIds) {
        const password = defaultPassword || generatePassword();
        await setEmployeePassword(tenantSlug, id, password);
        // Fetch employee details for response
        const { sql } = await import("@/lib/sql-client");
        const rows = await sql`
          select id, name, email from admin_employees
          where id = ${id} and tenant_slug = ${tenantSlug}
          limit 1
        `;
        if (rows.length > 0) {
          results.push({ id: rows[0].id, name: rows[0].name, email: rows[0].email, password });
        }
      }

      return NextResponse.json({
        success: true,
        activated: results.length,
        employees: results,
        note: "Distribute passwords securely. Consider email integration.",
      });
    }

    // Otherwise, bulk activate all active employees without portal access
    const activated = await bulkActivateEmployees(tenantSlug, defaultPassword);
    const employees = Array.from(activated.entries()).map(([id, data]) => ({
      id,
      ...data,
    }));

    return NextResponse.json({
      success: true,
      activated: employees.length,
      employees,
      note: "Distribute passwords securely. Consider email integration.",
    });
  } catch (error) {
    console.error("Employee activation error:", error);
    return NextResponse.json(
      { error: "Activation failed" },
      { status: 500 }
    );
  }
}
