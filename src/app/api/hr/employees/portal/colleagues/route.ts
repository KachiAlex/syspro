import { NextRequest, NextResponse } from "next/server";
import { decodeEmployeeToken } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";

/**
 * GET /api/hr/employees/portal/colleagues?q=...&departmentId=...&role=...
 * Search colleagues by name, department, or role (excluding self).
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("employee_session")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const session = decodeEmployeeToken(token);
  if (!session) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() || "";
    const departmentId = url.searchParams.get("departmentId")?.trim() || "";
    const role = url.searchParams.get("role")?.trim() || "";

    // If no departmentId provided, auto-detect from the caller's profile (for HODs)
    let effectiveDeptId = departmentId;
    if (!effectiveDeptId) {
      try {
        const selfInfo = await SQL`
          SELECT department_id, role FROM admin_employees
          WHERE id = ${session.id} AND tenant_slug = ${session.tenantSlug}
          LIMIT 1
        `;
        const selfRole = (selfInfo[0]?.role || 'staff').toLowerCase();
        const isHOD = selfRole === 'hod' || selfRole === 'head_of_department';
        if (isHOD && selfInfo[0]?.department_id) {
          effectiveDeptId = selfInfo[0].department_id;
        }
      } catch (e) {
        console.error('colleagues self-lookup failed:', (e as any)?.message);
      }
    }

    let rows: any[] = [];
    try {
      if (q) {
        rows = await SQL`
          SELECT e.id, e.name, e.email, e.job_title, e.role, e.department_id,
                 d.name as department_name
          FROM admin_employees e
          LEFT JOIN admin_departments d ON e.department_id = d.id AND d.tenant_slug = e.tenant_slug
          WHERE e.tenant_slug = ${session.tenantSlug}
            AND e.id != ${session.id}
            AND e.status = 'active'
            AND (e.name ILIKE ${'%' + q + '%'} OR e.email ILIKE ${'%' + q + '%'} OR e.job_title ILIKE ${'%' + q + '%'})
          ORDER BY e.name ASC
          LIMIT 20
        `;
      } else if (effectiveDeptId) {
        rows = await SQL`
          SELECT e.id, e.name, e.email, e.job_title, e.role, e.department_id,
                 d.name as department_name
          FROM admin_employees e
          LEFT JOIN admin_departments d ON e.department_id = d.id AND d.tenant_slug = e.tenant_slug
          WHERE e.tenant_slug = ${session.tenantSlug}
            AND e.id != ${session.id}
            AND e.status = 'active'
            AND e.department_id = ${effectiveDeptId}
          ORDER BY e.name ASC
          LIMIT 50
        `;
      } else if (role) {
        rows = await SQL`
          SELECT e.id, e.name, e.email, e.job_title, e.role, e.department_id,
                 d.name as department_name
          FROM admin_employees e
          LEFT JOIN admin_departments d ON e.department_id = d.id AND d.tenant_slug = e.tenant_slug
          WHERE e.tenant_slug = ${session.tenantSlug}
            AND e.id != ${session.id}
            AND e.status = 'active'
            AND e.role = ${role}
          ORDER BY e.name ASC
          LIMIT 50
        `;
      } else {
        // Return all active colleagues (limited)
        rows = await SQL`
          SELECT e.id, e.name, e.email, e.job_title, e.role, e.department_id,
                 d.name as department_name
          FROM admin_employees e
          LEFT JOIN admin_departments d ON e.department_id = d.id AND d.tenant_slug = e.tenant_slug
          WHERE e.tenant_slug = ${session.tenantSlug}
            AND e.id != ${session.id}
            AND e.status = 'active'
          ORDER BY e.name ASC
          LIMIT 50
        `;
      }
    } catch (e) {
      console.error("colleagues query failed:", (e as any)?.message);
      // Fallback without department join
      try {
        if (q) {
          rows = await SQL`
            SELECT id, name, email, job_title, role, department_id
            FROM admin_employees
            WHERE tenant_slug = ${session.tenantSlug}
              AND id != ${session.id}
              AND status = 'active'
              AND name ILIKE ${'%' + q + '%'}
            ORDER BY name ASC
            LIMIT 20
          `;
        } else if (effectiveDeptId) {
          rows = await SQL`
            SELECT id, name, email, job_title, role, department_id
            FROM admin_employees
            WHERE tenant_slug = ${session.tenantSlug}
              AND id != ${session.id}
              AND status = 'active'
              AND department_id = ${effectiveDeptId}
            ORDER BY name ASC
            LIMIT 50
          `;
        } else {
          rows = await SQL`
            SELECT id, name, email, job_title, role, department_id
            FROM admin_employees
            WHERE tenant_slug = ${session.tenantSlug}
              AND id != ${session.id}
              AND status = 'active'
            ORDER BY name ASC
            LIMIT 50
          `;
        }
      } catch (e2) {
        console.error("colleagues fallback failed:", (e2 as any)?.message);
      }
    }

    return NextResponse.json({ colleagues: rows });
  } catch (error: any) {
    console.error("Colleagues search error:", error?.message);
    return NextResponse.json({ error: "Failed to search colleagues" }, { status: 500 });
  }
}
