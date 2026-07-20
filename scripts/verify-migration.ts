import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(connectionString);

async function main() {
  console.log("=== FINAL VERIFICATION ===\n");

  // 1. Tenants
  const tenants = await sql`select id, name, slug from tenants order by id`;
  console.log("1. Tenants:");
  for (const t of tenants) console.log(`   id=${t.id} | name=${t.name} | slug=${t.slug}`);
  console.log(`   Count: ${tenants.length} (expected: 2)`);

  // 2. Employee counts per tenant
  const empCounts = await sql`
    select tenant_slug, count(*)::int as cnt from admin_employees
    group by tenant_slug order by tenant_slug
  `;
  console.log("\n2. Employee counts:");
  for (const c of empCounts) console.log(`   ${c.tenant_slug}: ${c.cnt}`);
  console.log(`   Total: ${empCounts.reduce((s, c) => s + c.cnt, 0)} (expected: 105 under kreatixtech)`);

  // 3. Duplicate check
  const dups = await sql`
    select count(*)::int as cnt from (
      select tenant_slug, email from admin_employees
      group by tenant_slug, email having count(*) > 1
    ) sub
  `;
  console.log(`\n3. Duplicate (tenant_slug, email) groups: ${dups[0].cnt} (expected: 0)`);

  // 4. Unique constraint
  const constraints = await sql`
    select constraint_name from information_schema.table_constraints
    where table_name = 'admin_employees' and constraint_type = 'UNIQUE'
  `;
  console.log("\n4. Unique constraints on admin_employees:");
  for (const c of constraints) console.log(`   ${c.constraint_name}`);

  // 5. Users table
  const users = await sql`select tenant_id, count(*)::int as cnt from users group by tenant_id order by tenant_id`;
  console.log("\n5. Users by tenant_id:");
  for (const u of users) console.log(`   tenant_id=${u.tenant_id}: ${u.cnt} users`);

  // 6. Tenant admins
  const admins = await sql`
    select ta.id, ta.email, ta.name, ta.role, t.slug as tenant_slug
    from tenant_admins ta
    join tenants t on t.id = ta.tenant_id
    order by ta.created_at
  `;
  console.log("\n6. Tenant admins:");
  for (const a of admins) console.log(`   ${a.email} | name=${a.name} | role=${a.role} | tenant=${a.tenant_slug}`);

  // 7. Check no rows remain in fake tenants across all tables
  const fakeSlugs = ['gmail-com', 'kreatixtech-com', 'demo'];
  for (const slug of fakeSlugs) {
    const empCheck = await sql`select count(*)::int as cnt from admin_employees where tenant_slug = ${slug}`;
    if (empCheck[0].cnt > 0) {
      console.log(`\n⚠️  WARNING: ${empCheck[0].cnt} employees still in '${slug}'!`);
    }
  }

  // 8. Departments
  const deptCounts = await sql`
    select tenant_slug, count(*)::int as cnt from admin_departments
    group by tenant_slug order by tenant_slug
  `;
  console.log("\n7. Department counts:");
  for (const c of deptCounts) console.log(`   ${c.tenant_slug}: ${c.cnt}`);

  console.log("\n=== VERIFICATION COMPLETE ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
