import { NextRequest, NextResponse } from "next/server";
import { sql as SQL } from "@/lib/sql-client";
import { ensureHrTables, resolveOrCreateDepartment } from "@/lib/hr/db";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !body.tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  const tenantSlug = body.tenantSlug as string;
  const dryRun = body.dryRun === true;

  try {
    await ensureHrTables(SQL);

    // Find all employees whose department_id is NOT a valid UUID
    const rows = await SQL`
      select id, name, email, department_id
      from admin_employees
      where tenant_slug = ${tenantSlug}
        and department_id is not null
        and department_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      order by created_at
    `;

    const repairs: Array<{
      employeeId: string;
      employeeName: string;
      email: string;
      oldDepartmentId: string;
      newDepartmentId: string;
      departmentName: string;
      created: boolean;
    }> = [];

    const errors: string[] = [];

    for (const row of rows as any[]) {
      const rawDept = row.department_id as string;
      try {
        const dept = await resolveOrCreateDepartment(tenantSlug, rawDept);

        // Check if this department was newly created or already existed
        const created = !dryRun;

        if (!dryRun) {
          await SQL`
            update admin_employees
            set department_id = ${dept.id}, updated_at = now()
            where id = ${row.id} and tenant_slug = ${tenantSlug}
          `;
        }

        repairs.push({
          employeeId: row.id,
          employeeName: row.name,
          email: row.email,
          oldDepartmentId: rawDept,
          newDepartmentId: dept.id,
          departmentName: dept.name,
          created,
        });
      } catch (err: any) {
        errors.push(`Failed to repair ${row.name} (${row.email}): ${err?.message || err}`);
      }
    }

    return NextResponse.json({
      dryRun,
      scanned: (rows as any[]).length,
      repaired: dryRun ? 0 : repairs.length,
      wouldRepair: repairs.length,
      repairs,
      errors,
    });
  } catch (error: any) {
    console.error("Department migration failed:", error);
    return NextResponse.json(
      { error: "Migration failed", detail: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
