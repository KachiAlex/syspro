import type { NextRequest } from "next/server";
import { resolveEmployeeSession, type EmployeeSession } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";

export type CrmVisibilityScope = "all" | "team" | "mine";

export interface CrmAuthResult {
  session: EmployeeSession;
  scope: CrmVisibilityScope;
  employeeId: string;
  isHOD: boolean;
  isAdmin: boolean;
  departmentId: string;
}

const HOD_ROLES = ["hod", "head_of_department"];
const ADMIN_ROLES = ["admin", "administrator", "hr", "hr_admin", "hr_manager"];

export async function resolveCrmAuth(request: NextRequest): Promise<CrmAuthResult | null> {
  const session = resolveEmployeeSession(request);
  if (!session) return null;

  const role = (session.role || "staff").toLowerCase();
  const isHOD = HOD_ROLES.includes(role);
  const isAdmin = ADMIN_ROLES.includes(role);

  let departmentId = session.departmentId || "";

  if (!departmentId) {
    try {
      const rows = await SQL`
        select department_id from admin_employees
        where id = ${session.id} and tenant_slug = ${session.tenantSlug}
        limit 1
      `;
      departmentId = (rows as any[])[0]?.department_id || "";
    } catch {}
  }

  let scope: CrmVisibilityScope = "mine";
  if (isAdmin) {
    scope = "all";
  } else if (isHOD) {
    scope = "team";
  }

  return {
    session,
    scope,
    employeeId: session.id,
    isHOD,
    isAdmin,
    departmentId,
  };
}
