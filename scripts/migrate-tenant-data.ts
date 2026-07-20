/**
 * Migration script: Reassign all data from fake tenants to real tenants.
 *
 * - gmail-com → kreatixtech
 * - kreatixtech-com → kreatixtech
 * - Then dedup employees (keep oldest per email)
 * - Delete fake tenants (gmail-com, kreatixtech-com, demo)
 * - Update users.tenant_id from 174 → 170
 *
 * Usage:
 *   $env:DATABASE_URL = "..."
 *   npx tsx scripts/migrate-tenant-data.ts          # dry run
 *   npx tsx scripts/migrate-tenant-data.ts --apply   # actually execute
 */
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(connectionString);
const APPLY = process.argv.includes("--apply");

const REAL_SLUG = "kreatixtech";
const FAKE_SLUGS = ["gmail-com", "kreatixtech-com"];

// All tables with tenant_slug column (from find-tenant-tables.ts output)
const TENANT_SLUG_TABLES = [
  "admin_access_controls",
  "admin_applications",
  "admin_approval_routes",
  "admin_attendance",
  "admin_candidates",
  "admin_departments",
  "admin_employees",
  "admin_interviews",
  "admin_job_requisitions",
  "admin_leave",
  "admin_modules",
  "admin_offers",
  "admin_onboarding_tasks",
  "admin_payroll_adjustments",
  "admin_payroll_entries",
  "admin_payroll_runs",
  "admin_requisition_screening_configs",
  "admin_roles",
  "admin_staff_report_templates",
  "admin_staff_reports",
  "admin_staff_tasks",
  "admin_workflows",
  "automation_action_queue",
  "automation_rule_audits",
  "automation_rules",
  "bills",
  "crm_activity_log",
  "crm_contacts",
  "crm_conversions",
  "crm_customers",
  "crm_deals",
  "crm_leads",
  "expenses",
  "finance_accounts",
  "finance_expense_categories",
  "finance_invoices",
  "finance_payments",
  "finance_schedules",
  "finance_subscriptions",
  "finance_trend_points",
  "inventory_products",
  "purchase_orders",
  "report_jobs",
  "reports",
  "sales_orders",
  "suppliers",
  "vendors",
];

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`);

  // Step 1: Drop unique constraint on admin_employees
  if (APPLY) {
    console.log("Step 1: Dropping unique_employee_email constraint...");
    try {
      await sql`alter table admin_employees drop constraint if exists unique_employee_email`;
      console.log("  Dropped.");
    } catch (err: any) {
      console.log(`  Skip (may not exist): ${err.message}`);
    }
  } else {
    console.log("Step 1 (dry run): Would drop unique_employee_email constraint");
  }

  // Step 2: Reassign tenant_slug in all tables
  console.log("\nStep 2: Reassigning tenant_slug in all tables...");
  for (const table of TENANT_SLUG_TABLES) {
    for (const fakeSlug of FAKE_SLUGS) {
      if (APPLY) {
        await sql(`update ${table} set tenant_slug = $1 where tenant_slug = $2`, [REAL_SLUG, fakeSlug]);
      }
      // Count for reporting
      const rows = await sql(`select count(*)::int as cnt from ${table} where tenant_slug = $1`, [REAL_SLUG]);
      if (rows[0].cnt > 0) {
        // Only report if there were rows (post-migration count)
      }
    }
    // Report final count under real slug
    const count = await sql(`select count(*)::int as cnt from ${table} where tenant_slug = $1`, [REAL_SLUG]);
    if (count[0].cnt > 0) {
      console.log(`  ${table}: ${count[0].cnt} rows now under '${REAL_SLUG}'`);
    }
  }

  if (!APPLY) {
    console.log("\n  (dry run: no actual updates performed)");
  }

  // Step 3: Dedup employees (keep oldest per email within kreatixtech)
  console.log("\nStep 3: Deduplicating employees...");
  const dupGroups = await sql`
    select email, array_agg(id order by created_at asc) as ids
    from admin_employees
    where tenant_slug = ${REAL_SLUG}
    group by email
    having count(*) > 1
    order by email
  `;
  console.log(`  Found ${dupGroups.length} duplicate groups`);

  const idsToDelete: string[] = [];
  for (const group of dupGroups) {
    idsToDelete.push(...group.ids.slice(1));
  }
  console.log(`  Records to delete: ${idsToDelete.length}`);

  if (APPLY && idsToDelete.length > 0) {
    const batchSize = 100;
    for (let i = 0; i < idsToDelete.length; i += batchSize) {
      const batch = idsToDelete.slice(i, i + batchSize);
      const placeholders = batch.map((_, idx) => `$${idx + 1}`).join(",");
      await sql(`delete from admin_employees where id in (${placeholders})`, batch);
    }
    console.log("  Deleted duplicates.");
  }

  // Step 4: Re-add unique constraint
  if (APPLY) {
    console.log("\nStep 4: Re-adding unique_employee_email constraint...");
    try {
      await sql`alter table admin_employees add constraint unique_employee_email unique (tenant_slug, email)`;
      console.log("  Added.");
    } catch (err: any) {
      console.error(`  Failed: ${err.message}`);
    }
  } else {
    console.log("\nStep 4 (dry run): Would re-add unique_employee_email constraint");
  }

  // Step 5: Update users.tenant_id from 174 → 170
  if (APPLY) {
    console.log("\nStep 5: Updating users.tenant_id 174 → 170...");
    const result = await sql`update users set tenant_id = 170 where tenant_id = 174`;
    console.log("  Updated.");
  } else {
    console.log("\nStep 5 (dry run): Would update users.tenant_id 174 → 170");
  }

  // Step 6: Delete fake tenants
  if (APPLY) {
    console.log("\nStep 6: Deleting fake tenants...");
    await sql`delete from tenants where slug in ('gmail-com', 'kreatixtech-com', 'demo')`;
    console.log("  Deleted fake tenants.");
  } else {
    console.log("\nStep 6 (dry run): Would delete tenants with slugs: gmail-com, kreatixtech-com, demo");
  }

  // Step 7: Verify
  console.log("\n=== Verification ===");
  const tenants = await sql`select id, name, slug from tenants order by id`;
  console.log("Tenants:");
  for (const t of tenants) console.log(`  id=${t.id} | name=${t.name} | slug=${t.slug}`);

  const empCounts = await sql`
    select tenant_slug, count(*)::int as cnt from admin_employees
    group by tenant_slug order by tenant_slug
  `;
  console.log("Employee counts:");
  for (const c of empCounts) console.log(`  ${c.tenant_slug}: ${c.cnt}`);

  const remainingDups = await sql`
    select count(*)::int as cnt from (
      select tenant_slug, email from admin_employees
      group by tenant_slug, email having count(*) > 1
    ) sub
  `;
  console.log(`Remaining duplicate groups: ${remainingDups[0].cnt}`);

  if (!APPLY) {
    console.log("\nDry run complete. Run with --apply to execute.");
  } else {
    console.log("\nMigration complete.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
