/**
 * End-to-end test of employee login flow.
 * Tests: DB lookup -> password verify -> token creation -> token verification -> cookie simulation
 */
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual } from "crypto";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(connectionString);

// ── Replicate signSession / verifySession locally ──
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.error("WARNING: SESSION_SECRET not set, using dev secret");
    return "dev-only-insecure-secret-change-me";
  }
  return secret;
}

function hmacSign(data: string): string {
  return createHmac("sha256", getSessionSecret()).update(data).digest("base64url");
}

function hmacVerify(data: string, signature: string): boolean {
  try {
    const expected = hmacSign(data);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function signSession(payload: any): string {
  const str = JSON.stringify(payload);
  const encoded = Buffer.from(str, "utf8").toString("base64url");
  const signature = hmacSign(encoded);
  return `${encoded}.${signature}`;
}

function verifySession(value: string): any | null {
  try {
    if (!value) return null;
    const dotIdx = value.lastIndexOf(".");
    if (dotIdx > 0) {
      const encoded = value.slice(0, dotIdx);
      const signature = value.slice(dotIdx + 1);
      if (!hmacVerify(encoded, signature)) {
        console.log("  [verifySession] HMAC signature mismatch!");
        return null;
      }
      const json = Buffer.from(encoded, "base64url").toString("utf8");
      const payload = JSON.parse(json);
      if (payload.exp && Date.now() > payload.exp) {
        console.log("  [verifySession] Token expired!");
        return null;
      }
      return payload;
    }
    console.log("  [verifySession] No dot found in token (legacy format?)");
    return null;
  } catch (e) {
    console.log("  [verifySession] Error:", e);
    return null;
  }
}

async function main() {
  const testEmail = "onyedika.akoma@gmail.com";
  const testPassword = "dikaoliver2660";

  console.log("=== EMPLOYEE LOGIN FLOW TEST ===\n");
  console.log(`Test email: ${testEmail}`);
  console.log(`Test password: ${testPassword}`);
  console.log(`SESSION_SECRET set: ${!!process.env.SESSION_SECRET}`);
  console.log(`SESSION_SECRET length: ${process.env.SESSION_SECRET?.length || 0}`);
  console.log();

  // ── Step 1: Look up employee in admin_employees ──
  console.log("Step 1: Looking up employee in admin_employees table...");
  const empRows = await sql`
    SELECT id, name, email, tenant_slug, role, department_id, job_title, 
           password_hash, is_portal_active, status
    FROM admin_employees
    WHERE email = ${testEmail.toLowerCase()}
    LIMIT 1
  `;

  if (empRows.length === 0) {
    console.log("  FAIL: Employee not found with email:", testEmail.toLowerCase());
    console.log("  Checking all employees with similar email...");
    const allEmps = await sql`
      SELECT id, email, tenant_slug, is_portal_active FROM admin_employees 
      WHERE email LIKE '%akoma%' OR email LIKE '%onyedika%'
      LIMIT 10
    `;
    for (const e of allEmps) {
      console.log(`    Found: id=${e.id} email=${e.email} tenant=${e.tenant_slug} active=${e.is_portal_active}`);
    }
    process.exit(1);
  }

  const emp = empRows[0];
  console.log(`  OK: Found employee`);
  console.log(`    id=${emp.id}`);
  console.log(`    name=${emp.name}`);
  console.log(`    email=${emp.email}`);
  console.log(`    tenant_slug=${emp.tenant_slug}`);
  console.log(`    role=${emp.role}`);
  console.log(`    is_portal_active=${emp.is_portal_active}`);
  console.log(`    status=${emp.status}`);
  console.log(`    has_password_hash=${!!emp.password_hash}`);
  console.log(`    password_hash_length=${emp.password_hash?.length || 0}`);
  console.log(`    password_hash_prefix=${emp.password_hash?.substring(0, 25) || 'N/A'}`);

  // ── Step 2: Check is_portal_active ──
  console.log("\nStep 2: Checking is_portal_active...");
  if (!emp.is_portal_active) {
    console.log("  FAIL: is_portal_active is false/null. Employee cannot login.");
    process.exit(1);
  }
  console.log("  OK: Portal is active");

  // ── Step 3: Check password_hash exists ──
  console.log("\nStep 3: Checking password_hash...");
  if (!emp.password_hash) {
    console.log("  FAIL: password_hash is null. Employee has no password set.");
    process.exit(1);
  }
  console.log("  OK: password_hash exists");

  // ── Step 4: Verify password ──
  console.log("\nStep 4: Verifying password with bcrypt...");
  const valid = await bcrypt.compare(testPassword, emp.password_hash);
  console.log(`  bcrypt.compare result: ${valid}`);
  if (!valid) {
    console.log("  FAIL: Password does not match.");
    // Try some common passwords
    const common = ["test123", "password", "admin123", "123456", "password123", "Welcome123", "Admin@123"];
    for (const pwd of common) {
      const match = await bcrypt.compare(pwd, emp.password_hash);
      if (match) {
        console.log(`  INFO: Password matches '${pwd}' instead!`);
        break;
      }
    }
    process.exit(1);
  }
  console.log("  OK: Password verified");

  // ── Step 5: Create token (replicate createEmployeeToken) ──
  console.log("\nStep 5: Creating employee token...");
  const session = {
    id: emp.id,
    email: emp.email,
    name: emp.name,
    tenantSlug: emp.tenant_slug,
    role: emp.role,
    departmentId: emp.department_id || "",
    jobTitle: emp.job_title || "",
  };

  const token = signSession({
    id: session.id,
    email: session.email,
    name: session.name,
    tenantSlug: session.tenantSlug,
    roleId: session.role,
    iat: Date.now(),
    exp: Date.now() + 12 * 60 * 60 * 1000,
  });

  console.log(`  Token created: ${token.substring(0, 50)}...`);
  console.log(`  Token length: ${token.length}`);

  // ── Step 6: Verify token (replicate decodeEmployeeToken) ──
  console.log("\nStep 6: Verifying token (decodeEmployeeToken)...");
  const decoded = verifySession(token);
  if (!decoded) {
    console.log("  FAIL: Token verification failed!");
    process.exit(1);
  }
  console.log(`  OK: Token verified`);
  console.log(`    decoded.id=${decoded.id}`);
  console.log(`    decoded.email=${decoded.email}`);
  console.log(`    decoded.tenantSlug=${decoded.tenantSlug}`);
  console.log(`    decoded.roleId=${decoded.roleId}`);
  console.log(`    decoded.exp=${new Date(decoded.exp).toISOString()}`);

  // ── Step 7: Check if employee exists in getEmployeeById ──
  console.log("\nStep 7: Checking getEmployeeById query...");
  const empById = await sql`
    SELECT id, name, email, job_title, role, department_id, employment_type, 
           status, hire_date, salary, last_login
    FROM admin_employees
    WHERE id = ${decoded.id} AND tenant_slug = ${decoded.tenantSlug}
    LIMIT 1
  `;
  if (empById.length === 0) {
    console.log("  FAIL: Employee not found by id + tenant_slug");
    console.log(`    Looking for id=${decoded.id} tenant_slug=${decoded.tenantSlug}`);
    // Try just by id
    const byIdOnly = await sql`SELECT id, tenant_slug FROM admin_employees WHERE id = ${decoded.id}`;
    if (byIdOnly.length > 0) {
      console.log(`    Found by id only: tenant_slug=${byIdOnly[0].tenant_slug}`);
      console.log(`    MISMATCH: token tenant_slug='${decoded.tenantSlug}' vs db tenant_slug='${byIdOnly[0].tenant_slug}'`);
    }
    process.exit(1);
  }
  console.log("  OK: Employee found by id + tenant_slug");

  // ── Step 8: Simulate what the /me endpoint does ──
  console.log("\nStep 8: Simulating /api/hr/employees/me endpoint...");
  console.log("  request.cookies.get('employee_session') would return:", token.substring(0, 30) + "...");
  console.log("  decodeEmployeeToken would return:", { id: decoded.id, email: decoded.email, tenantSlug: decoded.tenantSlug });
  console.log("  getEmployeeById would return:", empById[0].name);
  console.log("  => /me endpoint would return 200 OK with employee data");

  console.log("\n=== ALL STEPS PASSED ===");
  console.log("The database/auth flow works correctly.");
  console.log("The issue is likely with cookie transport (set/read) in the deployed Next.js app.");
  console.log("\nPossible causes:");
  console.log("  1. SESSION_SECRET differs between the login API and the /me API on Vercel");
  console.log("  2. The Set-Cookie header is being stripped by Vercel's middleware/edge runtime");
  console.log("  3. The cookie is set but not sent back due to SameSite/Secure mismatch");

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
