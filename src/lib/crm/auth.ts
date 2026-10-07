import { NextRequest, NextResponse } from "next/server";
import { resolveEmployeeSession, type EmployeeSession } from "@/lib/hr/auth";
import { loadPortalPermissions } from "@/lib/api-auth";
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
const ADMIN_ROLES = ["admin", "tenant_admin", "administrator", "superadmin", "hr", "hr_admin", "hr_manager"];

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

/**
 * Enforce an authenticated session bound to the claimed tenant.
 * Resolves employee_session or pisairtel_session (tenant admins get scope
 * "all" via their roleId). Use this at the top of every CRM route instead of
 * treating auth as optional — routes must never fall through to unscoped
 * queries on a claimed tenantSlug.
 */
export async function requireCrmAuth(
  request: NextRequest,
  tenantSlug: string
): Promise<
  | { ok: true; auth: CrmAuthResult }
  | { ok: false; response: NextResponse }
> {
  const auth = await resolveCrmAuth(request);
  if (!auth) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }
  if (auth.session.tenantSlug !== tenantSlug) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 403 }),
    };
  }

  // Module grant: portal_permissions is the per-user kill-switch. Once any
  // permissions are set, every module not explicitly enabled is denied —
  // same semantics as requireModuleAccess.
  const modulePerms = await loadPortalPermissions(tenantSlug, {
    id: auth.employeeId,
    email: auth.session.email,
  } as any);
  if (Object.keys(modulePerms).length > 0 && modulePerms.crm !== true) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Insufficient permissions for crm access" }, { status: 403 }),
    };
  }

  return { ok: true, auth };
}

/**
 * Record-level scope check — mirrors list scoping so direct-ID reads and
 * writes cannot widen visibility. all → any record; team → records owned
 * by a department member (fallback: own); mine → records the session owns
 * (created by or assigned to them).
 */
export async function canAccessCrmRecord(
  auth: CrmAuthResult,
  record: { createdBy?: string | null; assignedOfficerId?: string | null; assignedTo?: string | null }
): Promise<boolean> {
  if (auth.scope === "all") return true;
  const owners = [record.createdBy, record.assignedOfficerId, record.assignedTo].filter(
    (v): v is string => Boolean(v)
  );
  if (auth.scope === "team" && auth.departmentId) {
    const teamIds = await getTeamMemberIds(auth.session.tenantSlug, auth.departmentId);
    if (!teamIds.includes(auth.employeeId)) teamIds.push(auth.employeeId);
    return owners.some((o) => teamIds.includes(o));
  }
  return owners.includes(auth.employeeId);
}

/**
 * Clamp a client-requested viewMode to what the session's scope permits.
 * Staff (mine) can never list team/all records; HODs (team) cap at team.
 */
export function effectiveViewMode(
  requested: string | undefined,
  scope: CrmVisibilityScope
): CrmVisibilityScope {
  if (scope === "all") {
    return requested === "mine" || requested === "team" ? requested : "all";
  }
  if (scope === "team") {
    return requested === "mine" ? "mine" : "team";
  }
  return "mine";
}

export async function getTeamMemberIds(tenantSlug: string, departmentId: string): Promise<string[]> {
  if (!departmentId) return [];
  const rows = await SQL`
    select id from admin_employees
    where tenant_slug = ${tenantSlug} and department_id = ${departmentId} and status = 'active'
  `;
  return (rows as any[]).map(r => r.id);
}
