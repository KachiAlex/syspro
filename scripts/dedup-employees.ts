/**
 * Deduplicate admin_employees table.
 *
 * For each (tenant_slug, email) group with multiple records, keeps the
 * oldest record (by created_at) and deletes the rest. Also cleans up
 * related tables (attendance, leave, payroll_entries, payroll_adjustments)
 * that reference the deleted employee IDs.
 *
 * Usage:
 *   $env:DATABASE_URL = "your-connection-string"
 *   npx tsx scripts/dedup-employees.ts          # dry run (default)
 *   npx tsx scripts/dedup-employees.ts --apply  # actually delete
 */
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(connectionString);
const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY (will delete records)" : "DRY RUN (no changes)"}\n`);

  // Step 1: Find all duplicate groups
  const dupGroups = await sql`
    select tenant_slug, email,
           array_agg(id order by created_at asc) as ids
    from admin_employees
    group by tenant_slug, email
    having count(*) > 1
    order by tenant_slug, email
  `;

  console.log(`Found ${dupGroups.length} duplicate groups`);

  // Collect all IDs to delete (all except the first/oldest in each group)
  const idsToDelete: string[] = [];
  for (const group of dupGroups) {
    // Keep ids[0] (oldest), delete the rest
    idsToDelete.push(...group.ids.slice(1));
  }

  console.log(`Total duplicate records to remove: ${idsToDelete.length}\n`);

  if (idsToDelete.length === 0) {
    console.log("No duplicates found. Nothing to do.");
    process.exit(0);
  }

  // Step 2: Check related tables for references to the IDs being deleted
  const idList = idsToDelete.map((id) => `'${id}'`).join(",");

  // We can't use parameterized IN with neon template tags easily for large arrays,
  // so we'll check in batches
  const batchSize = 100;
  let attendanceCount = 0;
  let leaveCount = 0;
  let payrollEntriesCount = 0;
  let payrollAdjustmentsCount = 0;

  for (let i = 0; i < idsToDelete.length; i += batchSize) {
    const batch = idsToDelete.slice(i, i + batchSize);
    const placeholders = batch.map((_, idx) => `$${idx + 1}`).join(",");

    const attRes = await sql(
      `select count(*)::int as cnt from admin_attendance where employee_id in (${placeholders})`,
      batch
    );
    attendanceCount += attRes[0]?.cnt || 0;

    const leaveRes = await sql(
      `select count(*)::int as cnt from admin_leave where employee_id in (${placeholders})`,
      batch
    );
    leaveCount += leaveRes[0]?.cnt || 0;

    const peRes = await sql(
      `select count(*)::int as cnt from admin_payroll_entries where employee_id in (${placeholders})`,
      batch
    );
    payrollEntriesCount += peRes[0]?.cnt || 0;

    const paRes = await sql(
      `select count(*)::int as cnt from admin_payroll_adjustments where employee_id in (${placeholders})`,
      batch
    );
    payrollAdjustmentsCount += paRes[0]?.cnt || 0;
  }

  console.log("Related records referencing duplicate employee IDs:");
  console.log(`  admin_attendance: ${attendanceCount}`);
  console.log(`  admin_leave: ${leaveCount}`);
  console.log(`  admin_payroll_entries: ${payrollEntriesCount}`);
  console.log(`  admin_payroll_adjustments: ${payrollAdjustmentsCount}`);

  if (!APPLY) {
    console.log("\nDry run complete. Run with --apply to actually delete duplicates.");
    process.exit(0);
  }

  // Step 3: Delete related records and duplicate employees
  console.log("\nApplying changes...");

  for (let i = 0; i < idsToDelete.length; i += batchSize) {
    const batch = idsToDelete.slice(i, i + batchSize);
    const placeholders = batch.map((_, idx) => `$${idx + 1}`).join(",");

    if (attendanceCount > 0) {
      await sql(`delete from admin_attendance where employee_id in (${placeholders})`, batch);
    }
    if (leaveCount > 0) {
      await sql(`delete from admin_leave where employee_id in (${placeholders})`, batch);
    }
    if (payrollEntriesCount > 0) {
      await sql(`delete from admin_payroll_entries where employee_id in (${placeholders})`, batch);
    }
    if (payrollAdjustmentsCount > 0) {
      await sql(`delete from admin_payroll_adjustments where employee_id in (${placeholders})`, batch);
    }

    // Delete the duplicate employee records
    await sql(`delete from admin_employees where id in (${placeholders})`, batch);

    process.stdout.write(`  Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(idsToDelete.length / batchSize)}\r`);
  }

  console.log("\n\nDeletion complete.");

  // Step 4: Verify results
  const remaining = await sql`select count(*)::int as cnt from admin_employees`;
  console.log(`Remaining employees: ${remaining[0].cnt}`);

  const remainingDups = await sql`
    select count(*)::int as cnt from (
      select tenant_slug, email
      from admin_employees
      group by tenant_slug, email
      having count(*) > 1
    ) sub
  `;
  console.log(`Remaining duplicate groups: ${remainingDups[0].cnt}`);

  // Step 5: Add unique constraint to prevent future duplicates
  console.log("\nAdding unique constraint on (tenant_slug, email)...");
  try {
    await sql`alter table admin_employees add constraint if not exists unique_employee_email unique (tenant_slug, email)`;
    console.log("Unique constraint added successfully.");
  } catch (err: any) {
    console.error("Failed to add unique constraint:", err.message);
    console.error("This may happen if there are still duplicates. Run the script again.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
