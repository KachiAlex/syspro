/**
 * Migration script: Fix department_id values in admin_employees
 *
 * Scans all employees whose department_id is NOT a valid UUID (i.e. raw text
 * from bulk import), resolves each to a real admin_departments record (creating
 * one if needed), and updates the employee row.
 *
 * Usage:
 *   node --import tsx scripts/migrate-employee-departments.ts            # all tenants
 *   node --import tsx scripts/migrate-employee-departments.ts --tenant=acme  # specific tenant
 *   node --import tsx scripts/migrate-employee-departments.ts --dry-run       # preview only
 */

import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Add it to .env.local or your environment.");
  process.exit(1);
}

const sql = neon(connectionString);

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const tenantArg = args.find((a) => a.startsWith("--tenant="));
const tenantFilter = tenantArg ? tenantArg.split("=")[1] : null;

async function main() {
  console.log(`\n=== Department Migration Script ===`);
  console.log(`Mode: ${dryRun ? "DRY RUN (preview only)" : "LIVE (will update database)"}`);
  if (tenantFilter) console.log(`Tenant filter: ${tenantFilter}`);
  console.log();

  // 1. Find all distinct non-UUID department_id values
  const employees: Array<{
    id: string;
    name: string;
    email: string;
    department_id: string;
    tenant_slug: string;
  }> = await sql`
    select id, name, email, department_id, tenant_slug
    from admin_employees
    where department_id is not null
      and department_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    order by tenant_slug, created_at
  `;

  if (employees.length === 0) {
    console.log("✓ All employees already have proper UUID department links. Nothing to migrate.");
    process.exit(0);
  }

  // Filter by tenant if specified
  const filtered = tenantFilter ? employees.filter((e) => e.tenant_slug === tenantFilter) : employees;

  if (filtered.length === 0) {
    console.log(`✓ No employees with raw-text department IDs found${tenantFilter ? ` for tenant "${tenantFilter}"` : ""}.`);
    process.exit(0);
  }

  console.log(`Found ${filtered.length} employee(s) with raw-text department IDs.\n`);

  // Group by tenant_slug + department name for efficient resolution
  const deptCache = new Map<string, string>(); // key: "tenantSlug::deptName" -> deptId

  let repaired = 0;
  let created = 0;
  let errors = 0;

  for (const emp of filtered) {
    const rawDept = emp.department_id;
    const cacheKey = `${emp.tenant_slug}::${rawDept.toLowerCase()}`;

    let deptId = deptCache.get(cacheKey);

    if (!deptId) {
      // Check if a department with this name already exists (case-insensitive)
      const existing: Array<{ id: string }> = await sql`
        select id from admin_departments
        where tenant_slug = ${emp.tenant_slug}
          and lower(name) = lower(${rawDept})
        limit 1
      `;

      if (existing.length > 0) {
        deptId = existing[0].id;
        console.log(`  [resolved] "${rawDept}" -> existing dept ${deptId}`);
      } else {
        // Create a new department
        deptId = randomUUID();
        if (!dryRun) {
          await sql`
            insert into admin_departments (id, tenant_slug, name, description)
            values (${deptId}, ${emp.tenant_slug}, ${rawDept}, null)
          `;
        }
        created++;
        console.log(`  [created]  "${rawDept}" -> new dept ${deptId}`);
      }
      deptCache.set(cacheKey, deptId);
    }

    // Update the employee record
    if (!dryRun) {
      await sql`
        update admin_employees
        set department_id = ${deptId}, updated_at = now()
        where id = ${emp.id} and tenant_slug = ${emp.tenant_slug}
      `;
    }

    repaired++;
    console.log(`  ${dryRun ? "[would fix] " : "[fixed]     "} ${emp.name} (${emp.email}) — tenant: ${emp.tenant_slug}`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Scanned:    ${filtered.length}`);
  console.log(`Repaired:   ${repaired}${dryRun ? " (would be)" : ""}`);
  console.log(`Created:    ${created} new department(s)${dryRun ? " (would be)" : ""}`);
  console.log(`Errors:     ${errors}`);
  console.log();

  if (dryRun) {
    console.log("This was a dry run. Re-run without --dry-run to apply changes.");
  } else {
    console.log("✓ Migration complete. All employees now have proper department links.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
