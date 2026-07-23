/**
 * Employee Authentication Helpers
 * Handles employee login, password hashing, and session management.
 */

import { randomUUID, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { sql as SQL } from "@/lib/sql-client";
import { ensureHrTables } from "./db";
import { signSession, verifySession } from "@/lib/session";

const SALT_ROUNDS = 12;

export interface EmployeeSession {
  id: string;
  email: string;
  name: string;
  tenantSlug: string;
  role: string;
  departmentId: string;
  jobTitle: string;
}

/**
 * Generate a secure random password using crypto.randomBytes
 */
export function generatePassword(length = 12): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const bytes = randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(bytes[i] % charset.length);
  }
  return password;
}

/**
 * Hash a plain-text password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a plain-text password with a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Authenticate an employee by email and password
 */
export async function authenticateEmployee(
  tenantSlug: string,
  email: string,
  password: string
): Promise<EmployeeSession | null> {
  const sql = SQL;
  await ensureHrTables(sql);

  const rows = await sql`
    select id, name, email, tenant_slug, role, department_id, job_title, password_hash, is_portal_active
    from admin_employees
    where tenant_slug = ${tenantSlug} and email = ${email.toLowerCase()}
    limit 1
  `;

  if (rows.length === 0) return null;

  const emp = rows[0];
  if (!emp.is_portal_active) return null;
  if (!emp.password_hash) return null;

  const valid = await verifyPassword(password, emp.password_hash);
  if (!valid) return null;

  // Update last_login
  await sql`
    update admin_employees set last_login = now() where id = ${emp.id}
  `;

  return {
    id: emp.id,
    email: emp.email,
    name: emp.name,
    tenantSlug: emp.tenant_slug,
    role: emp.role,
    departmentId: emp.department_id,
    jobTitle: emp.job_title,
  };
}

/**
 * Set (or reset) an employee's password and activate their portal account
 */
export async function setEmployeePassword(
  tenantSlug: string,
  employeeId: string,
  password: string
): Promise<void> {
  const sql = SQL;
  await ensureHrTables(sql);

  const hash = await hashPassword(password);

  await sql`
    update admin_employees
    set password_hash = ${hash},
        is_portal_active = true,
        updated_at = now()
    where id = ${employeeId} and tenant_slug = ${tenantSlug}
  `;

  // Auto-set default portal permissions if none exist yet
  const empRows = await sql`
    select role, portal_permissions from admin_employees
    where id = ${employeeId} and tenant_slug = ${tenantSlug}
    limit 1
  `;
  const emp = (empRows as any[])[0];
  if (emp && !emp.portal_permissions) {
    const r = (emp.role || "staff").toLowerCase();
    const isHOD = r === "hod" || r === "head_of_department";
    const isHR = r === "hr" || r === "hr_admin" || r === "hr_manager";
    const isAdmin = r === "admin" || r === "administrator";
    const defaults: Record<string, boolean> = {
      self_service: true,
      crm: false,
      finance: isHR || isAdmin,
      people: isHR || isAdmin,
      projects: isHOD || isAdmin,
      sales: false,
      analytics: isHOD || isHR || isAdmin,
      automation: isAdmin,
      admin: isAdmin,
    };
    await sql`
      update admin_employees
      set portal_permissions = ${JSON.stringify(defaults)}::jsonb,
          updated_at = now()
      where id = ${employeeId} and tenant_slug = ${tenantSlug}
    `;
  }
}

/**
 * Bulk activate portal accounts for all active employees in a tenant
 * If defaultPassword is provided, all employees get that password.
 * Otherwise generates random secure passwords.
 * Returns a map of employeeId -> {name, email, password} for distribution.
 */
export async function bulkActivateEmployees(
  tenantSlug: string,
  defaultPassword?: string
): Promise<Map<string, { name: string; email: string; password: string }>> {
  const sql = SQL;
  await ensureHrTables(sql);

  const employees = await sql`
    select id, name, email
    from admin_employees
    where tenant_slug = ${tenantSlug}
      and status = 'active'
      and (is_portal_active is null or is_portal_active = false)
  `;

  const result = new Map<string, { name: string; email: string; password: string }>();

  for (const emp of employees) {
    const password = defaultPassword || generatePassword();
    await setEmployeePassword(tenantSlug, emp.id, password);
    result.set(emp.id, { name: emp.name, email: emp.email, password });
  }

  return result;
}

/**
 * Build an HMAC-signed token for employee sessions
 */
export function createEmployeeToken(session: EmployeeSession): string {
  return signSession({
    id: session.id,
    email: session.email,
    name: session.name,
    tenantSlug: session.tenantSlug,
    roleId: session.role,
    iat: Date.now(),
    exp: Date.now() + 12 * 60 * 60 * 1000, // 12 hours
  });
}

/**
 * Decode and verify an employee token
 */
export function decodeEmployeeToken(token: string): EmployeeSession | null {
  const payload = verifySession(token);
  if (!payload) return null;
  return {
    id: payload.id,
    email: payload.email,
    name: payload.name || "",
    tenantSlug: payload.tenantSlug || "",
    role: payload.roleId || "staff",
    departmentId: "",
    jobTitle: "",
  };
}

/**
 * Resolve an employee session from either the employee_session or syspro_session cookie.
 * This allows HOD/staff users authenticated via the tenant admin portal to access
 * employee self-service APIs without needing a separate employee login.
 */
export function resolveEmployeeSession(request: Request): EmployeeSession | null {
  // Try employee_session first (direct employee portal login)
  const empToken = request.cookies.get("employee_session")?.value;
  if (empToken) {
    const session = decodeEmployeeToken(empToken);
    if (session) return session;
  }

  // Fall back to syspro_session (tenant admin portal login)
  const adminToken = request.cookies.get("syspro_session")?.value;
  if (adminToken) {
    const payload = verifySession(adminToken);
    if (payload) {
      return {
        id: payload.id,
        email: payload.email,
        name: payload.name || "",
        tenantSlug: payload.tenantSlug || "",
        role: payload.roleId || "staff",
        departmentId: "",
        jobTitle: "",
      };
    }
  }

  return null;
}
