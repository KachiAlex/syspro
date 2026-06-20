/**
 * Employee Authentication Helpers
 * Handles employee login, password hashing, and session management.
 */

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { sql as SQL } from "@/lib/sql-client";
import { ensureHrTables } from "./db";

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
 * Generate a secure random password
 */
export function generatePassword(length = 10): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
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
    where tenant_slug = ${tenantSlug} and email = ${email}
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
}

/**
 * Bulk activate portal accounts for all active employees in a tenant
 * Returns a map of employeeId -> generatedPassword for distribution
 */
export async function bulkActivateEmployees(
  tenantSlug: string
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
    const password = generatePassword();
    await setEmployeePassword(tenantSlug, emp.id, password);
    result.set(emp.id, { name: emp.name, email: emp.email, password });
  }

  return result;
}

/**
 * Build a simple JWT-like token for employee sessions
 * (In production, consider using jose or next-auth)
 */
export function createEmployeeToken(session: EmployeeSession): string {
  const payload = JSON.stringify(session);
  const signature = randomUUID().replace(/-/g, "");
  return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

/**
 * Decode an employee token back to a session
 */
export function decodeEmployeeToken(token: string): EmployeeSession | null {
  try {
    const [payload] = token.split(".");
    if (!payload) return null;
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    return JSON.parse(decoded) as EmployeeSession;
  } catch {
    return null;
  }
}
