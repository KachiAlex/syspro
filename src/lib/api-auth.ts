/**
 * Route-level authentication & tenant-scoping helpers.
 *
 * These run inside Node.js route handlers (unlike middleware, which is edge
 * runtime and cannot verify sessions against Node crypto or query Postgres).
 * Middleware provides the first-line gate; use these for defense-in-depth on
 * sensitive routes.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "./session";
import { validateTenantAccess, type SessionUser } from "./auth-helpers";
import { db, sql as SQL } from "./sql-client";
import { getTenantUserPermissions } from "./tenant-admin/permissions";

// Route handlers may type the param as `Request` or `NextRequest` — at runtime
// it is always a NextRequest (has .cookies/.nextUrl).
type Req = NextRequest | Request;
const asNext = (r: Req) => r as NextRequest;

export type AuthResult =
  | { ok: true; user: SessionUser }
  | { ok: false; response: NextResponse };

function unauthorized(message = "Unauthorized"): AuthResult {
  return { ok: false, response: NextResponse.json({ error: message }, { status: 401 }) };
}

function forbidden(message = "Forbidden"): AuthResult {
  return { ok: false, response: NextResponse.json({ error: message }, { status: 403 }) };
}

/**
 * Resolve the signed-in user from signed session cookies only.
 * Returns null when no valid session exists.
 */
export function getSessionUser(request: Req): SessionUser | null {
  const req = asNext(request);
  for (const cookieName of ["pisairtel_session", "employee_session", "superadmin_auth"]) {
    const value = req.cookies.get(cookieName)?.value;
    if (!value) continue;
    const session = verifySession(value);
    if (session?.id) {
      return {
        id: session.id,
        email: session.email,
        name: session.name,
        tenantSlug: session.tenantSlug,
        roleId: session.roleId || "viewer",
        isEmployee: cookieName === "employee_session",
      };
    }
  }
  return null;
}

/**
 * Require a valid superadmin session (superadmin_auth cookie with
 * roleId === "superadmin"). Usage:
 *
 *   const auth = await requireSuperAdmin(request);
 *   if (!auth.ok) return auth.response;
 */
export async function requireSuperAdmin(request: Req): Promise<AuthResult> {
  const cookie = asNext(request).cookies.get("superadmin_auth")?.value;
  if (!cookie) return unauthorized();

  const session = verifySession(cookie);
  if (!session?.id || session.roleId !== "superadmin") return unauthorized();

  return {
    ok: true,
    user: {
      id: session.id,
      email: session.email,
      name: session.name,
      roleId: "superadmin",
    },
  };
}

async function resolveRequestedTenant(request: Req, explicit?: string | null): Promise<string | undefined> {
  if (explicit) return explicit;
  const req = asNext(request);
  const fromQuery =
    req.nextUrl?.searchParams.get("tenantSlug") ||
    req.nextUrl?.searchParams.get("tenantId") ||
    req.nextUrl?.searchParams.get("tenant_id") ||
    req.headers.get("x-tenant-slug");
  if (fromQuery) return fromQuery;
  // Clone before reading so the downstream handler can still consume the body
  try {
    const body = await req.clone().json();
    if (body && typeof body === "object") {
      const slug = body.tenantSlug ?? body.tenantId ?? body.tenant_id;
      if (typeof slug === "string" && slug) return slug;
    }
  } catch {
    // no JSON body / no tenantSlug — nothing to bind
  }
  return undefined;
}

/**
 * Require any valid session AND that it is scoped to the requested tenant.
 * Rejects cross-tenant access even for otherwise-authenticated users.
 * Superadmin sessions (no tenantSlug) are allowed through.
 *
 * tenantSlug is optional: when omitted it is resolved from the query param,
 * x-tenant-slug header, or the JSON body (via clone — safe to call before the
 * handler reads the body).
 *
 *   const auth = await requireTenantScope(request);
 *   if (!auth.ok) return auth.response;
 */
export async function requireTenantScope(
  request: Req,
  tenantSlug?: string | null
): Promise<AuthResult> {
  const requested = await resolveRequestedTenant(request, tenantSlug);
  const user = getSessionUser(request);
  if (!user) return unauthorized();

  // Superadmin tokens carry no tenant scope and may cross tenants
  if (user.roleId === "superadmin") return { ok: true, user };

  if (!requested) {
    // No tenant hinted on the request — the session tenant is the only tenant
    // this user can legitimately act on; handlers that take a record id must
    // still verify the record's tenant_slug matches user.tenantSlug.
    if (!user.tenantSlug) {
      return { ok: false, response: NextResponse.json({ error: "tenantSlug is required" }, { status: 400 }) };
    }
    return { ok: true, user };
  }

  // Fast path: session tenant matches requested tenant
  if (user.tenantSlug === requested) return { ok: true, user };

  // Otherwise verify tenant membership in the database
  const allowed = await validateTenantAccess(user, requested);
  if (!allowed) return forbidden("Cross-tenant access denied");

  return { ok: true, user };
}

/**
 * Governed module keys — matches TenantUserPermissions / portal_permissions.
 * Route trees not governed by the permission model (inventory, manufacturing,
 * tenant-admin internals, …) are mapped to "admin" so only unrestricted
 * tenant admins (or users explicitly granted admin module access) can call them.
 */
export type GovernedModule =
  | "crm" | "finance" | "people" | "projects" | "sales"
  | "analytics" | "automation" | "admin" | "billing" | "integrations";

export type ModuleAccessLevel = "read" | "write";

/**
 * Load the caller's portal_permissions (per-user module toggles) from
 * admin_employees — by employee id, falling back to email for tenant_admins
 * whose employee record has a different id. Mirrors /api/tenant/user/modules.
 */
async function loadPortalPermissions(
  tenant: string,
  user: SessionUser
): Promise<Record<string, boolean>> {
  try {
    const sql = SQL;
    let rows = await sql`
      SELECT portal_permissions FROM admin_employees
      WHERE id = ${user.id} AND tenant_slug = ${tenant} LIMIT 1
    `;
    let row = (Array.isArray(rows) ? rows : [])[0] as any;
    if (!row && user.email) {
      rows = await sql`
        SELECT portal_permissions FROM admin_employees
        WHERE lower(email) = lower(${user.email}) AND tenant_slug = ${tenant} LIMIT 1
      `;
      row = (Array.isArray(rows) ? rows : [])[0] as any;
    }
    const pp = row?.portal_permissions;
    if (!pp) return {};
    const parsed = typeof pp === "string" ? JSON.parse(pp) : pp;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Session + tenant scope + module-level permission enforcement.
 * Mirrors the effective-permissions logic of /api/tenant/user/modules:
 *
 *   - tenant_admins.role is re-read from the DB (login defaults NULL → "admin")
 *   - role permissions come from admin_user_roles/admin_roles via
 *     getTenantUserPermissions (roleId "admin" → full, unknown roles → none)
 *   - admin_employees.portal_permissions then restrict modules: a module not
 *     explicitly enabled drops to "none"; employee sessions get "write" on
 *     enabled modules.
 *
 *   const auth = await requireModuleAccess(request, "finance", "write");
 *   if (!auth.ok) return auth.response;
 */
export async function requireModuleAccess(
  request: Req,
  module: GovernedModule,
  required: ModuleAccessLevel = "write"
): Promise<AuthResult> {
  const scope = await requireTenantScope(request);
  if (!scope.ok) return scope;
  const user = scope.user;
  if (user.roleId === "superadmin") return scope;

  const tenant = (await resolveRequestedTenant(request)) || user.tenantSlug;
  if (!tenant) {
    return { ok: false, response: NextResponse.json({ error: "tenantSlug is required" }, { status: 400 }) };
  }

  // Re-resolve the real role for tenant-admin sessions — the login route
  // defaults a NULL tenant_admins.role to "admin", which would otherwise
  // grant unrestricted access. Mirror the modules endpoint's behavior.
  let effectiveRole = user.roleId || "viewer";
  if (!user.isEmployee && user.email) {
    try {
      const sql = SQL;
      const rows = await sql`
        SELECT role FROM tenant_admins
        WHERE lower(email) = lower(${user.email}) AND tenant_slug = ${tenant}
        LIMIT 1
      `;
      const row = (Array.isArray(rows) ? rows : [])[0] as any;
      if (row) effectiveRole = row.role || "viewer";
    } catch {
      // lookup failure — keep session role
    }
  }

  const perms = await getTenantUserPermissions(tenant, user.id, effectiveRole);
  const modulePerms = await loadPortalPermissions(tenant, user);
  const hasRestrictions = Object.keys(modulePerms).length > 0;
  const wasFullAdmin = effectiveRole?.toLowerCase() === "admin" || perms.isAdmin;

  let isAdmin = perms.isAdmin;
  let level: string = (perms as any)[module] ?? "none";

  if (hasRestrictions) {
    if (user.isEmployee) {
      level = modulePerms[module] === true ? "write" : "none";
      isAdmin = false;
    } else {
      if (modulePerms[module] !== true) level = "none";
      if (wasFullAdmin || modulePerms["admin"] !== true) isAdmin = false;
    }
  }

  if (isAdmin) return scope;

  const allowed =
    required === "read"
      ? level === "read" || level === "write" || level === "admin"
      : level === "write" || level === "admin";

  if (!allowed) {
    return forbidden(`Insufficient permissions for ${required} access to ${module}`);
  }
  return scope;
}

/**
 * Verify that a row in a tenant-owned table belongs to the given tenant.
 * Returns false for missing rows — callers should respond 404.
 *
 * `table`/`idColumn` are interpolated into SQL — only pass compile-time
 * constants from trusted code, never request input.
 */
export async function recordBelongsToTenant(
  table: string,
  idColumn: string,
  id: string,
  tenantSlug: string
): Promise<boolean> {
  try {
    const res = await db.query(
      `select tenant_slug from ${table} where ${idColumn} = $1 limit 1`,
      [id]
    );
    return res.rows[0]?.tenant_slug === tenantSlug;
  } catch {
    return false;
  }
}

/**
 * Tenant-check guard for [id] routes: verifies the record's tenant_slug
 * matches the authenticated session tenant (skipped for superadmin).
 * Returns a 404-shaped response when the record is missing/foreign.
 */
export async function requireRecordTenant(
  table: string,
  id: string,
  user: SessionUser
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  if (!user.tenantSlug) return { ok: true }; // superadmin — global access
  const owned = await recordBelongsToTenant(table, "id", id, user.tenantSlug);
  if (!owned) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }
  return { ok: true };
}
